// One place media opens, for the journal and for moments.
//
// Before this there were two copies of the same helper, both doing
// `window.open(url, '_blank')`: tapping a voice note or a video threw you out of
// the app into a browser tab, and an image was not tappable at all. A patient
// looking at their own week should not have to find their way back.
//
// So: images open full screen and can be enlarged, audio plays where it sits,
// and video plays over the screen and closes back onto it.
//
// The one place this cannot yet be honoured is native video. Playing it inline
// needs `expo-video`, a native module and therefore a new build. Until that
// exists, native falls back to `openBrowserAsync`, which is an in-app sheet the
// patient dismisses straight back here — not a tab, and not a different app.
import { createElement, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { ChevronLeft, ChevronRight, Minus, Pause, Play, Plus, X } from 'lucide-react-native';

export interface ViewerItem {
  kind: 'image' | 'video' | 'audio';
  url: string;
  thumbnailUrl?: string | null;
  durationSeconds?: number | null;
}

export const fmtClock = (s: number): string => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/* ------------------------------------------------------------------ audio -- */

/**
 * A voice note, playing where it sits. No overlay: audio has nothing to look at,
 * and opening a full screen to show a progress bar would be theatre.
 *
 * `tone` because the same row appears on the light moment sheet and on the dark
 * journal paper.
 */
export function AudioRow({
  url,
  durationSeconds,
  label,
  tone = 'light',
}: {
  url: string;
  durationSeconds?: number | null;
  label: string;
  tone?: 'light' | 'dark';
}) {
  const player = useAudioPlayer({ uri: url });
  const status = useAudioPlayerStatus(player);
  const [at, setAt] = useState(0);
  // Whether the position has ever actually moved. See the note on the bar below.
  const [ticks, setTicks] = useState(false);

  const playing = status.playing;
  const total = status.duration || durationSeconds || 0;
  const pct = total > 0 ? Math.min(1, at / total) : 0;

  // The position is polled rather than taken from the status hook.
  // `useAudioPlayerStatus` re-renders on PLAYBACK_STATUS_UPDATE, and on web
  // those do not tick while a clip plays — the duration arrived, the clock sat
  // at 0:00, and the bar never moved. A quarter-second tick that only runs
  // while playing is cheaper than a progress bar that lies.
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      try {
        const t = player.currentTime ?? 0;
        setAt(t);
        if (t > 0) setTicks(true);
      } catch { /* released */ }
    }, 250);
    return () => clearInterval(id);
  }, [playing, player]);

  // Finishing should reset to the start, so the row reads as ready to play
  // again rather than stuck at the end.
  useEffect(() => {
    if (status.didJustFinish) setAt(0);
  }, [status.didJustFinish]);

  // Leaving the screen should stop the sound. Without this a voice note keeps
  // playing over whatever the patient opened next.
  useEffect(() => () => { try { player.pause(); } catch { /* already gone */ } }, [player]);

  const ink = tone === 'dark' ? '#FFFFFF' : '#141414';
  const soft = tone === 'dark' ? 'rgba(255,255,255,0.55)' : '#5A5A52';
  const track = tone === 'dark' ? 'rgba(255,255,255,0.16)' : '#DCE7E2';
  const accent = tone === 'dark' ? '#7FD9C0' : '#128069';
  const bg = tone === 'dark' ? 'rgba(255,255,255,0.055)' : '#E7F0EC';

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: bg, borderRadius: 14, padding: 14 }}>
      <TouchableOpacity
        onPress={() => (playing ? player.pause() : player.play())}
        accessibilityLabel={playing ? 'Pause' : 'Play'}
        style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: accent, alignItems: 'center', justifyContent: 'center' }}
      >
        {playing ? <Pause size={16} color="#fff" fill="#fff" /> : <Play size={16} color="#fff" fill="#fff" />}
      </TouchableOpacity>

      <View style={{ flex: 1, gap: 6 }}>
        <Text style={{ fontSize: 14.5, fontWeight: '600', color: ink }}>{label}</Text>
        {/* The bar and the elapsed clock appear only once the position has
            actually moved. `player.currentTime` does not advance on the web
            build — the clip plays, the duration is right, and the position sits
            at zero — so showing them unconditionally would mean a bar that
            never fills and a clock stuck at 0:00 for the whole recording. A
            control that lies about what it is doing is worse than one that says
            less. Where the position does tick, this fills in on its own. */}
        {ticks ? (
          <View style={{ height: 3, borderRadius: 2, backgroundColor: track, overflow: 'hidden' }}>
            <View style={{ width: `${pct * 100}%`, height: '100%', backgroundColor: accent }} />
          </View>
        ) : null}
      </View>

      <Text style={{ fontSize: 12, color: soft, fontVariant: ['tabular-nums'] }}>
        {total <= 0 ? '—' : ticks ? `${fmtClock(at)} / ${fmtClock(total)}` : fmtClock(total)}
      </Text>
    </View>
  );
}

/* ----------------------------------------------------------------- viewer -- */

/**
 * The full-screen viewer. Opens on the item that was tapped, and steps between
 * them when a moment holds more than one.
 */
export function MediaViewer({
  items,
  index,
  onIndex,
  onClose,
}: {
  items: ViewerItem[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
}) {
  const item = items[index];
  const { width, height } = useWindowDimensions();
  const [zoom, setZoom] = useState(1);

  // A new item starts at its own scale rather than inheriting the last one's.
  useEffect(() => setZoom(1), [index]);

  if (!item) return null;
  const many = items.length > 1;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: 'rgba(8,10,9,0.985)' }}>
        {/* The bar: close, position, and zoom where zoom means something. */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 46, paddingHorizontal: 16, paddingBottom: 10 }}>
          <TouchableOpacity onPress={onClose} accessibilityLabel="Close" style={roundBtn}>
            <X size={18} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1 }} />
          {many ? <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>{index + 1} / {items.length}</Text> : null}
          <View style={{ flex: 1 }} />
          {item.kind === 'image' ? (
            <>
              <TouchableOpacity onPress={() => setZoom((z) => Math.max(1, z - 1))} accessibilityLabel="Zoom out" style={roundBtn}>
                <Minus size={17} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setZoom((z) => Math.min(4, z + 1))} accessibilityLabel="Zoom in" style={roundBtn}>
                <Plus size={17} color="#fff" />
              </TouchableOpacity>
            </>
          ) : (
            <View style={{ width: 36 }} />
          )}
        </View>

        <View style={{ flex: 1 }}>
          {item.kind === 'image' ? (
            <ImageStage url={item.url} zoom={zoom} onCycle={() => setZoom((z) => (z >= 3 ? 1 : z + 1))} width={width} height={height} />
          ) : item.kind === 'video' ? (
            <VideoStage url={item.url} poster={item.thumbnailUrl ?? null} />
          ) : (
            <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 20 }}>
              <AudioRow url={item.url} durationSeconds={item.durationSeconds} label="Voice note" tone="dark" />
            </View>
          )}
        </View>

        {/* Stepping between items lives at the bottom, in reach of a thumb. */}
        {many ? (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 34 }}>
            <TouchableOpacity disabled={index === 0} onPress={() => onIndex(index - 1)} style={[roundBtn, { opacity: index === 0 ? 0.3 : 1 }]}>
              <ChevronLeft size={20} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              disabled={index === items.length - 1}
              onPress={() => onIndex(index + 1)}
              style={[roundBtn, { opacity: index === items.length - 1 ? 0.3 : 1 }]}
            >
              <ChevronRight size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ height: 34 }} />
        )}
      </View>
    </Modal>
  );
}

const roundBtn = {
  width: 36,
  height: 36,
  borderRadius: 18,
  backgroundColor: 'rgba(255,255,255,0.14)',
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
};

/**
 * Zoom is driven three ways because no one way covers every platform: the
 * ScrollView's own pinch (iOS), a double tap, and the explicit +/− in the bar.
 * The buttons are not a fallback so much as the only thing that works
 * everywhere — proper pinch on Android needs react-native-gesture-handler, a
 * native module and a new build.
 */
function ImageStage({
  url,
  zoom,
  onCycle,
  width,
  height,
}: {
  url: string;
  zoom: number;
  onCycle: () => void;
  width: number;
  height: number;
}) {
  const [loading, setLoading] = useState(true);
  return (
    <ScrollView
      maximumZoomScale={4}
      minimumZoomScale={1}
      centerContent
      contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center' }}
      showsHorizontalScrollIndicator={false}
      showsVerticalScrollIndicator={false}
    >
      <Pressable onPress={onCycle} accessibilityLabel="Zoom">
        <Image
          source={{ uri: url }}
          style={{ width: width * zoom, height: height * 0.72 * zoom }}
          resizeMode="contain"
          onLoadEnd={() => setLoading(false)}
        />
      </Pressable>
      {loading ? <ActivityIndicator style={{ position: 'absolute' }} color="rgba(255,255,255,0.6)" /> : null}
    </ScrollView>
  );
}

/**
 * Video. On web this is a real <video> with its own controls, rendered through
 * createElement — the same trick the resources PDF viewer uses, and the only way
 * to play here without a viewer dependency.
 *
 * On native there is no player available without `expo-video`, so it opens the
 * in-app browser sheet. That is still not a new tab: it lifts over the app and
 * dismisses back to this screen.
 */
function VideoStage({ url, poster }: { url: string; poster: string | null }) {
  const opened = useRef(false);

  useEffect(() => {
    if (Platform.OS === 'web' || opened.current) return;
    opened.current = true;
    void WebBrowser.openBrowserAsync(url);
  }, [url]);

  if (Platform.OS === 'web') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 }}>
        {createElement('video', {
          src: url,
          poster: poster ?? undefined,
          controls: true,
          autoPlay: true,
          playsInline: true,
          style: { width: '100%', maxHeight: '100%', borderRadius: 14, background: '#000' },
        })}
      </View>
    );
  }

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, paddingHorizontal: 30 }}>
      {poster ? <Image source={{ uri: poster }} style={{ width: '100%', height: 200, borderRadius: 14 }} resizeMode="cover" /> : null}
      <Text style={{ color: 'rgba(255,255,255,0.72)', fontSize: 14, textAlign: 'center' }}>Playing over the app. Close it to come back here.</Text>
      <TouchableOpacity
        onPress={() => { void WebBrowser.openBrowserAsync(url); }}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 8, height: 44, paddingHorizontal: 22, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.16)' }}
      >
        <Play size={16} color="#fff" fill="#fff" />
        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Play again</Text>
      </TouchableOpacity>
    </View>
  );
}

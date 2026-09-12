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
// Native video used to be the exception: with no player available it opened the
// in-app browser instead, which asked a patient to watch their own journal
// through a web sheet. `expo-video` closes that hole — it plays here now, with
// the platform's own controls, on both halves.
import { createElement, useEffect, useState } from 'react';
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
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEvent } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';
import { ChevronLeft, ChevronRight, Maximize2, Minimize2, Minus, Pause, Play, Plus, X } from 'lucide-react-native';

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
  // Video only: the chrome steps out of the way and the picture takes the whole
  // screen. It is a mode and not a separate screen, so leaving it puts
  // everything back exactly as it was.
  const [full, setFull] = useState(false);
  // 46 and 34 were an iPhone's notch and home indicator, written down as
  // numbers. This modal is `statusBarTranslucent`, so on Android it draws under
  // both system bars and those two numbers were the only thing keeping the
  // close button off the clock and the stepper off the navigation bar.
  const insets = useSafeAreaInsets();
  const topInset = Math.max(insets.top + 8, 20);
  const bottomInset = Math.max(insets.bottom + 10, 20);

  // A new item starts at its own scale rather than inheriting the last one's.
  useEffect(() => setZoom(1), [index]);
  // And never inherits the last one's full screen: stepping from a video to a
  // photograph with the chrome hidden leaves no way back.
  useEffect(() => setFull(false), [index]);

  if (!item) return null;
  const many = items.length > 1;
  const video = item.kind === 'video';
  const showChrome = !full;

  return (
    // Android's back button steps OUT of full screen before it closes the
    // viewer, which is what "back" means to someone who just expanded a video.
    <Modal visible transparent animationType="fade" onRequestClose={() => (full ? setFull(false) : onClose())} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: 'rgba(8,10,9,0.985)' }}>
        {/* The bar: close, position, and zoom where zoom means something. */}
        {showChrome ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: topInset, paddingHorizontal: 16, paddingBottom: 10 }}>
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
          ) : video ? (
            <TouchableOpacity onPress={() => setFull(true)} accessibilityLabel="Full screen" style={roundBtn}>
              <Maximize2 size={17} color="#fff" />
            </TouchableOpacity>
          ) : (
            <View style={{ width: 36 }} />
          )}
        </View>
        ) : null}

        <View style={{ flex: 1 }}>
          {item.kind === 'image' ? (
            <ImageStage url={item.url} zoom={zoom} onCycle={() => setZoom((z) => (z >= 3 ? 1 : z + 1))} width={width} height={height} />
          ) : item.kind === 'video' ? (
            <VideoStage url={item.url} poster={item.thumbnailUrl ?? null} full={full} />
          ) : (
            <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 20 }}>
              <AudioRow url={item.url} durationSeconds={item.durationSeconds} label="Voice note" tone="dark" />
            </View>
          )}
        </View>

        {/* Stepping between items lives at the bottom, in reach of a thumb. */}
        {!showChrome ? null : many ? (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: bottomInset }}>
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
          <View style={{ height: bottomInset }} />
        )}

        {/* Full screen hides everything else, so ONE control stays: without it
            an iPhone has no way back out, having no system back button. */}
        {full ? (
          <TouchableOpacity
            onPress={() => setFull(false)}
            accessibilityLabel="Exit full screen"
            style={[roundBtn, { position: 'absolute', top: topInset, left: 16 }]}
          >
            <Minimize2 size={17} color="#fff" />
          </TouchableOpacity>
        ) : null}
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
 * Video.
 *
 * WEB keeps the browser's own <video>, through createElement — the same trick
 * the resources PDF viewer uses. It already knows about captions, picture in
 * picture and the controls a person expects from their own browser, and there
 * is nothing to be gained by replacing it.
 *
 * NATIVE plays here, with `expo-video`. It used to open the in-app browser
 * because no player was installed, which asked a patient to watch their own
 * journal through a web sheet — and left them staring at a poster with a "play
 * again" button if anything about that handoff failed.
 */
/**
 * A video, at the size it actually is.
 *
 * THE BUG THIS REPLACES: the stage was a box of `aspectRatio: 16/9` with the
 * video contained inside it. Every video taken on a phone is PORTRAIT, so a
 * 9:16 picture was fitted into a 16:9 hole and came out as a small strip in the
 * middle of the screen with black either side — a quarter of the height the web
 * app gives it. The web build never had a forced ratio (`<video>` uses the
 * file's own), which is the whole of "it is bigger on the web".
 *
 * So the shape comes from the FILE. `sourceLoad` reports the track's real size;
 * the box is then the largest rectangle of that shape which fits the stage, so
 * a portrait video fills the height and a landscape one fills the width. Until
 * the size is known the video simply fills the stage, which is already the
 * right answer and merely un-rounded — so there is no wrong-shaped first frame.
 *
 * Fitting the box to the picture is also what makes the corners mean anything:
 * a radius on a full-bleed black rectangle rounds the background, not the film.
 */
function VideoStage({ url, poster, full }: { url: string; poster: string | null; full: boolean }) {
  const web = Platform.OS === 'web';
  // `null` on web: the hook still has to run — hooks cannot be conditional —
  // but there is nothing for it to load, and the browser element below does the
  // playing instead.
  const player = useVideoPlayer(web ? null : { uri: url }, (p) => {
    p.loop = false;
    // Plays on arrival: opening a video IS the intent of the tap that got here.
    p.play();
  });

  // The stage, measured rather than assumed: it is what is left after the bar
  // and the stepper, and both of them come and go with full screen.
  const [stage, setStage] = useState({ w: 0, h: 0 });
  const loaded = useEvent(player, 'sourceLoad', null);
  const size = loaded?.availableVideoTracks?.[0]?.size ?? null;
  const ratio = size && size.width > 0 && size.height > 0 ? size.width / size.height : null;

  if (web) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: full ? 0 : 12 }}>
        {createElement('video', {
          src: url,
          poster: poster ?? undefined,
          controls: true,
          autoPlay: true,
          playsInline: true,
          style: { width: '100%', maxHeight: '100%', borderRadius: full ? 0 : 10, background: '#000' },
        })}
      </View>
    );
  }

  // The largest box of the video's own shape that fits. Both fall back to the
  // whole stage before the size is known.
  const boxW = ratio && stage.w && stage.h ? Math.min(stage.w, stage.h * ratio) : stage.w || undefined;
  const boxH = ratio && stage.w && stage.h ? Math.min(stage.h, stage.w / ratio) : stage.h || undefined;

  return (
    <View
      style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: full ? 0 : 12 }}
      onLayout={(e) => setStage({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
    >
      <VideoView
        player={player}
        style={{ width: boxW, height: boxH, borderRadius: full ? 0 : 10, backgroundColor: '#000' }}
        contentFit="contain"
        nativeControls
      />
    </View>
  );
}


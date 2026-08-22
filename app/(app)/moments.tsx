// Moments — v2. "Your line": one vertical timeline instead of a day-picker over
// a list.
//
// The v1 screen made you choose a date and then showed that day's moments, so a
// week was something you had to reconstruct by tapping through it. The line
// shows the week at once: time runs down, valence runs across (heavier left,
// lighter right), and a stretch of hard days leans visibly to one side.
//
// Scrolling UP goes back in time — the foot of the line is today, which is where
// a person starts.
//
// Which is also what makes the paging here the mirror image of the usual thing:
// the next page is OLDER, so it arrives at the TOP and pushes everything the
// reader is looking at downward. Every page therefore has to be followed with a
// matching scroll correction, or the line silently walks them backwards through
// their own week. See `onContentSize`.
import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text, TouchableOpacity, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect, useRouter } from 'expo-router';
import { Settings } from 'lucide-react-native';
import { TabBar } from '@/src/ui/TabBar';
import { TabIntro } from '@/src/ui/TabIntro';
import { FadeIn, MonoLabel } from '@/src/ui/editorial';
import { Line } from '@/src/moments/Line';
import { MomentDetail, type MomentChange } from '@/src/moments/MomentDetail';
import { useLanding } from '@/src/prefs/landing';
import { useOnboarding } from '@/src/onboarding/context';
import { Ground } from '@/src/ui/Ground';
import { useI18n } from '@/src/i18n';
import { listMoments, type MomentDTO } from '@/src/api/moments';
import { useTheme } from '@/src/ui/theme-mode';

/** One page of the line. Deliberately larger than any viewport: at ROW=118 a
 *  page is ~4700px tall, so one fetch always overflows the screen and a page can
 *  never land still sitting inside the trigger zone. That is what stops the
 *  "load, still near the top, load again" chain that would otherwise walk
 *  straight back through someone's entire history on first paint. */
const PAGE = 40;

/** How close to the top (px) starts the next fetch. Roughly a screenful of
 *  runway, so the page has landed before the line runs out under the thumb. */
const LOAD_AHEAD = 600;

/** The slot above the line holds the spinner, the "beginning" marker, or
 *  nothing — but it always holds the same HEIGHT. Content that appears and
 *  disappears above the viewport moves everything below it, which reads as the
 *  line twitching every time a page starts or finishes. */
const TOP_SLOT = 52;

export default function Moments() {
  const { t: TT } = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { t, locale } = useI18n();
  const { landing } = useLanding();
  const { firstName } = useOnboarding();
  const tr = t.line;

  // Newest first, as the API returns them. Older pages are APPENDED here; it is
  // `Line` that sorts oldest-first for the layout, so "older arrives at the top"
  // is a fact about the drawing, not about this array.
  const [moments, setMoments] = useState<MomentDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  // null once the line has been read back to its beginning.
  const [cursor, setCursor] = useState<string | null>(null);
  const [viewing, setViewing] = useState<MomentDTO | null>(null);
  // "Nothing yet" and "we could not reach your line" are different things to be
  // told, and showing the welcoming empty state for a network failure is a lie.
  const [failed, setFailed] = useState(false);
  const [introActive, setIntroActive] = useState(false);
  const scroller = useRef<ScrollView>(null);

  // Scroll bookkeeping. All refs: these are read inside a 16ms scroll handler and
  // by the content-size callback, and none of them should cost a render.
  const contentH = useRef(0);
  const viewportH = useRef(0);
  const fetching = useRef(false);   // one page in flight at a time
  /**
   * Distance from the reader to the FOOT of the line — the one end that holds
   * still, since today is always the bottom and every page arrives above it.
   * Hold this constant across a height change and nothing moves under them.
   *
   * This single invariant also does the opening pin, which is why there is no
   * separate "scroll to the end on first load" step: a fresh page sets the gap
   * to one viewport, which IS the foot, and the resize that brings the nodes in
   * lands there. Three earlier attempts each broke somewhere different — a
   * one-shot flag was eaten by the intro card's resize before the nodes
   * existed; re-pinning on every resize needed a "the reader took over" test
   * that ordinary scroll events tripped; and doing it in requestAnimationFrame
   * never ran at all when the tab was in the background. A maintained
   * invariant has nothing to time correctly.
   *
   * Zero means "not known yet" and scrolls to the very bottom, which is the
   * same place — so an unmeasured viewport degrades to the right answer.
   */
  const bottomGap = useRef(0);
  const cursorRef = useRef<string | null>(null);
  // Bumped by every first-page load so a slow older-page fetch that resolves
  // after a refresh cannot append to a list it no longer belongs to.
  const gen = useRef(0);

  const load = useCallback(async () => {
    const g = ++gen.current;
    try {
      const page = await listMoments({ limit: PAGE });
      if (g !== gen.current) return;
      setMoments(page.moments);
      cursorRef.current = page.nextCursor;
      setCursor(page.nextCursor);
      // A fresh first page puts the reader back at the foot of the line: today
      // is where a person starts, and after a refresh it is what they asked to
      // see. One viewport from the end is exactly that.
      if (page.moments.length > 0) bottomGap.current = viewportH.current;
      setFailed(false);
    } catch {
      if (g !== gen.current) return;
      // Keep whatever is already on screen — a dropped connection should not
      // erase someone's week — but say that this is stale.
      setFailed(true);
    } finally {
      if (g === gen.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  /** The next page back. Keyset, not offset: the cursor is the oldest
   *  `capturedAt` we hold, so moments captured while someone reads cannot shift
   *  a page boundary and make the line skip or repeat itself. */
  const loadOlder = useCallback(async () => {
    if (fetching.current || !cursorRef.current) return;
    const g = gen.current;
    fetching.current = true;
    setLoadingOlder(true);
    try {
      const page = await listMoments({ before: cursorRef.current, limit: PAGE });
      if (g !== gen.current) return;
      setMoments((prev) => {
        // The cursor is a timestamp, so a moment sharing the boundary instant
        // could come back twice. Two nodes with one id is a duplicate key and a
        // doubled circle on the line.
        const seen = new Set(prev.map((m) => m.id));
        const fresh = page.moments.filter((m) => !seen.has(m.id));
        return fresh.length > 0 ? [...prev, ...fresh] : prev;
      });
      cursorRef.current = page.nextCursor;
      setCursor(page.nextCursor);
    } catch {
      // Leave the cursor exactly where it is. A failed page must not be mistaken
      // for the beginning of the line, and the next scroll retries it for free.
    } finally {
      if (g === gen.current) setLoadingOlder(false);
      fetching.current = false;
    }
  }, []);

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize } = e.nativeEvent;
      // Re-measured from the event rather than trusted from the last resize: the
      // gap is only meaningful against the height it was taken from.
      contentH.current = contentSize.height;
      bottomGap.current = contentSize.height - contentOffset.y;
      if (contentOffset.y < LOAD_AHEAD) void loadOlder();
    },
    [loadOlder],
  );

  const onContentSize = useCallback((_w: number, h: number) => {
    const changed = h !== contentH.current;
    contentH.current = h;
    if (!changed) return;

    // Content grew (a page) or shrank (the intro card dismissed, a moment
    // deleted). Either way it happened ABOVE the reader, so put the foot of the
    // line back the same distance away and nothing appears to move. On a fresh
    // first page that distance is one viewport, so the same line opens them at
    // today. A gap of zero is clamped past the end and lands there too.
    scroller.current?.scrollTo({ y: Math.max(0, h - bottomGap.current), animated: false });
  }, []);

  useFocusEffect(
    useCallback(() => {
      // Coming back to the tab resets to the newest page. That is the right call
      // right after a capture, which is the overwhelmingly common way to arrive
      // here — the detail sheet is a modal on this screen and does not refocus.
      void load();
    }, [load]),
  );

  /** Patch the line in place. Anything that refetched here would have to throw
   *  away the older pages behind the reader. */
  const applyChange = useCallback((change: MomentChange) => {
    setMoments((prev) =>
      'deleted' in change
        ? prev.filter((m) => m.id !== change.id)
        : prev.map((m) => (m.id === change.id ? { ...m, sharedWithPractitioner: change.shared } : m)),
    );
  }, []);

  // `Line` memoises its layout on this object. Built inline it was a new
  // identity every render, which re-laid-out every node on every state change —
  // survivable at one screenful, not at a thousand moments.
  const lineLabels = useMemo(
    () => ({ heavier: tr.heavier, lighter: tr.lighter, today: tr.today, yesterday: tr.yesterday, tapToRead: tr.tapToRead }),
    [tr],
  );

  const greetHere = landing === 'moments';
  const name = (firstName ?? '').trim();
  const pretty = name ? name.charAt(0).toUpperCase() + name.slice(1) : '';
  const greeting = new Date().getHours() < 12 ? t.greeting.morning : new Date().getHours() < 18 ? t.greeting.afternoon : t.greeting.evening;
  const title = greetHere ? (pretty ? `${greeting},\n${pretty}.` : `${greeting}.`) : t.tabs.moments;

  return (
    <Ground>
      <StatusBar style="light" />
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <View style={{ paddingHorizontal: 22, paddingTop: 8, paddingBottom: 10, flexDirection: 'row', alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <MonoLabel color={TT.faint} size={10.5} style={{ marginBottom: 10 }}>{tr.kicker}</MonoLabel>
            <Text style={{ fontSize: 27, fontWeight: '800', color: TT.ink, letterSpacing: -0.9, lineHeight: 31 }}>{title}</Text>
          </View>
          <TouchableOpacity
            onPress={() => router.navigate('/settings' as never)}
            activeOpacity={0.8}
            style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: TT.card, borderWidth: 1, borderColor: TT.cardLine, alignItems: 'center', justifyContent: 'center' }}
          >
            <Settings size={17} color={TT.inkSoft} strokeWidth={2} />
          </TouchableOpacity>
        </View>

        <ScrollView
          ref={scroller}
          contentContainerStyle={{ paddingBottom: 150, paddingTop: 22 }}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={onContentSize}
          onLayout={(e) => { viewportH.current = e.nativeEvent.layout.height; }}
          onScroll={onScroll}
          scrollEventThrottle={16}
          // Reachable only at the true beginning of the line: while pages remain,
          // crossing LOAD_AHEAD fetches one and the anchor puts a screenful back
          // above the reader, so the top can never actually be pulled.
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} tintColor={TT.faint} />}
        >
          <View style={{ paddingHorizontal: 22 }}>
            <TabIntro tabKey="moments" tone="dark" onActiveChange={setIntroActive} />
          </View>

          {loading ? (
            <View style={{ paddingTop: 60, alignItems: 'center' }}>
              <ActivityIndicator color={TT.faint} />
            </View>
          ) : (
            <FadeIn style={{ opacity: introActive ? 0.3 : 1 }}>
              {moments.length === 0 ? (
                <View style={{ paddingHorizontal: 34, paddingTop: 40, alignItems: 'center' }}>
                  <Text style={{ fontSize: 19, fontWeight: '700', color: TT.ink, textAlign: 'center', lineHeight: 26 }}>
                    {failed ? tr.failedTitle : tr.emptyTitle}
                  </Text>
                  <Text style={{ marginTop: 8, fontSize: 14, color: TT.inkSoft, textAlign: 'center', lineHeight: 21 }}>
                    {failed ? tr.failedBody : tr.emptyBody}
                  </Text>
                  {failed ? (
                    <TouchableOpacity
                      onPress={() => { setLoading(true); void load(); }}
                      style={{ marginTop: 18, height: 44, paddingHorizontal: 26, borderRadius: 22, borderWidth: 1, borderColor: TT.cardLine, alignItems: 'center', justifyContent: 'center' }}
                    >
                      <Text style={{ fontSize: 14, fontWeight: '700', color: TT.ink }}>{t.common.retry}</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              ) : (
                <>
                  {/* Fixed height whatever it holds — see TOP_SLOT. */}
                  <View style={{ height: TOP_SLOT, alignItems: 'center', justifyContent: 'center' }}>
                    {loadingOlder ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <ActivityIndicator size="small" color={TT.faint} />
                        <Text style={{ fontSize: 11.5, color: TT.faint }}>{tr.loadingOlder}</Text>
                      </View>
                    ) : cursor === null ? (
                      <Text style={{ fontSize: 11.5, color: TT.faint }}>{tr.lineStart}</Text>
                    ) : null}
                  </View>

                  <Line
                    moments={moments}
                    width={width > 460 ? 420 : width}
                    locale={locale}
                    labels={lineLabels}
                    onOpen={setViewing}
                    onCaptureToday={() => router.navigate('/capture' as never)}
                  />
                </>
              )}
            </FadeIn>
          )}

          {moments.length > 0 ? (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 22, marginTop: 12 }}>
              <Text style={{ fontSize: 11.5, color: TT.faint }}>{tr.weekSoFar}</Text>
              <Text style={{ fontSize: 11.5, color: TT.faint }}>{tr.scrollBack}</Text>
            </View>
          ) : null}
        </ScrollView>
      </SafeAreaView>

      <TabBar active="moments" tone="dark" />
      {viewing ? <MomentDetail moment={viewing} onClose={() => setViewing(null)} onChanged={applyChange} /> : null}
    </Ground>
  );
}

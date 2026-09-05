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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Pressable, RefreshControl, ScrollView, Text, TouchableOpacity, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect, useRouter } from 'expo-router';
import { ArrowDown } from 'lucide-react-native';
import { TabBar } from '@/src/ui/TabBar';
import { TabIntro } from '@/src/ui/TabIntro';
import { FadeIn, HEADER_TOP } from '@/src/ui/editorial';
import { Line } from '@/src/moments/Line';
import { MomentDetail, type MomentChange } from '@/src/moments/MomentDetail';
import { useLanding } from '@/src/prefs/landing';
import { useOnboarding } from '@/src/onboarding/context';
import { Ground } from '@/src/ui/Ground';
import { useI18n, greetingFor } from '@/src/i18n';
import { listMoments, type MomentDTO } from '@/src/api/moments';
import { ProfileButton } from '@/src/profile/ProfileButton';
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

/** How far from the foot before the way back appears. Two rows: a nudge should
 *  not summon chrome onto a screen whose whole point is being quiet. */
const BACK_AFTER = 260;

/** Ticks in the position rail. Five reads as a rail rather than a countdown,
 *  which matters — see TravelRail on why this is a position and not a total. */
const RAIL_TICKS = 5;

/**
 * How far down the loaded line the reader is, as a travelling highlight over a
 * few ticks. Deliberately a POSITION and not a progress bar: with paging, the
 * total is not known until the line has been read all the way back, so a bar
 * would sit at half and then jump backwards every time a page arrived. Ticks
 * carry no promise about what is left.
 *
 * Every tick interpolates from one shared Animated.Value, so the highlight
 * travels without a single React render.
 */
function TravelRail({ pos }: { pos: Animated.Value }) {
  const { t: TT } = useTheme();
  const span = 1 / (RAIL_TICKS - 1);
  return (
    <View style={{ position: 'absolute', right: 6, top: 0, bottom: 0, justifyContent: 'center', alignItems: 'flex-end', gap: 7 }}>
      {Array.from({ length: RAIL_TICKS }, (_, i) => {
        // Top tick is the oldest end, bottom tick is today — the same direction
        // the line itself runs.
        const at = i * span;
        const range = { inputRange: [at - span, at, at + span], extrapolate: 'clamp' as const };
        return (
          <Animated.View
            key={i}
            style={{
              width: 14, height: 1.5, borderRadius: 1, backgroundColor: TT.ink,
              opacity: pos.interpolate({ ...range, outputRange: [0.25, 1, 0.25] }),
              transform: [{ scaleX: pos.interpolate({ ...range, outputRange: [0.6, 1, 0.6] }) }],
            }}
          />
        );
      })}
    </View>
  );
}

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
   * True from the moment a page is handed to React until the anchor has put the
   * reader back. While it is set, `bottomGap` is FROZEN.
   *
   * Without this the invariant quietly destroys itself. `onScroll` recomputes
   * the gap from the event's own `contentSize`, and during a fling a scroll
   * event lands between the DOM growing and `onContentSizeChange` firing — so
   * the gap gets measured against the NEW height with the OLD, un-corrected
   * offset. That is precisely the broken position, and the anchor then restores
   * it faithfully. Measured: the reader ended 3269px higher up the line than
   * they should have, which is the "it jumps to the top" report.
   *
   * Only a fling is fast enough to slip an event into that window, which is why
   * it never showed up under slow scrolling, and why it struck the FIRST page
   * load and not the ones after — by then the reader is no longer near the edge.
   */
  const growing = useRef(false);
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
  // The id half of the keyset cursor; see listMoments.
  const cursorIdRef = useRef<string | null>(null);

  // Where the reader is, 0 at the oldest thing loaded and 1 at today. An
  // Animated.Value and NOT state on purpose: the rail follows the thumb, and a
  // setState per scroll event would re-render this screen sixty times a second.
  // Driven by hand with setValue, so it updates the rail's styles without React
  // hearing about it at all.
  const pos = useRef(new Animated.Value(1)).current;
  // Whether the reader has travelled far enough back to be offered a way home.
  // This one IS state — it flips rarely, and it gates rendering.
  const [awayFromFoot, setAwayFromFoot] = useState(false);
  const awayRef = useRef(false);
  const chrome = useRef(new Animated.Value(0)).current;
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
      cursorIdRef.current = page.nextCursorId ?? null;
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
   *  `(capturedAt, id)` we hold, so moments captured while someone reads cannot
   *  shift a page boundary — and two captured in the same instant cannot
   *  straddle one and lose the second. */
  const loadOlder = useCallback(async () => {
    if (fetching.current || !cursorRef.current) return;
    const g = gen.current;
    fetching.current = true;
    setLoadingOlder(true);
    try {
      const page = await listMoments({ before: cursorRef.current, beforeId: cursorIdRef.current, limit: PAGE });
      if (g !== gen.current) return;
      // From here the content is about to grow: hold the gap that was measured
      // BEFORE it did, which is the one that describes where the reader is.
      growing.current = true;
      setMoments((prev) => {
        // The cursor is a timestamp, so a moment sharing the boundary instant
        // could come back twice. Two nodes with one id is a duplicate key and a
        // doubled circle on the line.
        const seen = new Set(prev.map((m) => m.id));
        const fresh = page.moments.filter((m) => !seen.has(m.id));
        return fresh.length > 0 ? [...prev, ...fresh] : prev;
      });
      cursorRef.current = page.nextCursor;
      cursorIdRef.current = page.nextCursorId ?? null;
      setCursor(page.nextCursor);
    } catch {
      // Leave the cursor exactly where it is. A failed page must not be mistaken
      // for the beginning of the line, and the next scroll retries it for free.
    } finally {
      if (g === gen.current) setLoadingOlder(false);
      fetching.current = false;
      // Safety net. `growing` is normally lowered by the anchor, but a page of
      // pure duplicates returns `prev` unchanged, so the content never resizes
      // and `onContentSize` never runs — and a gap frozen forever would strand
      // the reader on the next real page. Harmless if the anchor got there
      // first.
      setTimeout(() => { growing.current = false; }, 600);
    }
  }, []);

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
      // Re-measured from the event rather than trusted from the last resize: the
      // gap is only meaningful against the height it was taken from — except
      // while a page is landing, when the height and the offset belong to
      // different moments. See `growing`.
      contentH.current = contentSize.height;
      if (!growing.current) bottomGap.current = contentSize.height - contentOffset.y;

      const runway = Math.max(1, contentSize.height - layoutMeasurement.height);
      pos.setValue(Math.min(1, Math.max(0, contentOffset.y / runway)));

      const away = contentSize.height - contentOffset.y - layoutMeasurement.height > BACK_AFTER;
      if (away !== awayRef.current) {
        awayRef.current = away;
        setAwayFromFoot(away);
      }

      if (contentOffset.y < LOAD_AHEAD) void loadOlder();
    },
    [loadOlder, pos],
  );

  useEffect(() => {
    Animated.timing(chrome, { toValue: awayFromFoot ? 1 : 0, duration: 180, useNativeDriver: true }).start();
  }, [awayFromFoot, chrome]);

  /** Straight back to the foot of the line. Animated, because the point is to
   *  land somewhere recognisable, and a jump cut does not say you moved. */
  const toToday = useCallback(() => {
    scroller.current?.scrollToEnd({ animated: true });
  }, []);

  // Stable so the memoised Line does not re-render behind the rail.
  const openCapture = useCallback(() => router.navigate('/capture' as never), [router]);

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
    // The reader is where they belong again; scroll events may speak for them.
    growing.current = false;
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
    () => ({ heavier: tr.heavier, lighter: tr.lighter, today: tr.today, yesterday: tr.yesterday, tapToRead: tr.tapToRead, capture: tr.capture, plusMore: tr.plusMore }),
    [tr],
  );

  const greetHere = landing === 'moments';
  const name = (firstName ?? '').trim();
  const pretty = name ? name.charAt(0).toUpperCase() + name.slice(1) : '';
  const greeting = greetingFor(t);
  const title = greetHere ? (pretty ? `${greeting},\n${pretty}.` : `${greeting}.`) : t.tabs.moments;

  return (
    <Ground>
      <StatusBar style="light" />
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <View style={{ paddingHorizontal: 22, paddingTop: HEADER_TOP, paddingBottom: 10, flexDirection: 'row', alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 27, fontWeight: '800', color: TT.ink, letterSpacing: -0.9, lineHeight: 31 }}>{title}</Text>
          </View>
          <ProfileButton />
        </View>

        <ScrollView
          ref={scroller}
          // `today` belongs just above the tab bar, however few moments there are.
        // With a short line the content did not overflow, so it sat top-aligned
        // and left ~185px of slack underneath — and because it does not
        // overflow, trimming the padding moves nothing. `flexGrow` +
        // `justify-end` pushes a short line down to the foot; a long one
        // scrolls exactly as before.
        contentContainerStyle={{ paddingBottom: 96, paddingTop: 22, flexGrow: 1, justifyContent: 'flex-end' }}
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
            <FadeIn style={{ opacity: introActive ? 0.55 : 1 }}>
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
                    onCaptureToday={openCapture}
                  />
                </>
              )}
            </FadeIn>
          )}

        </ScrollView>
      </SafeAreaView>

      {/* Both only exist once the reader has actually gone somewhere. At the
          foot of the line the screen stays empty, which is the resting state
          the whole tab is designed around. */}
      <Animated.View
        pointerEvents={awayFromFoot ? 'box-none' : 'none'}
        style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, opacity: chrome }}
      >
        <TravelRail pos={pos} />
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 132, alignItems: 'center' }}>
          <Pressable
            onPress={toToday}
            accessibilityRole="button"
            accessibilityLabel={tr.backToToday}
            // Just the arrow, on the accent. The word "Today" was the only
            // text floating over the line, and it competed with the moments it
            // was sitting among; the direction is the whole message. The label
            // survives for screen readers, which is where the word still earns
            // its place.
            style={{
              alignItems: 'center', justifyContent: 'center',
              width: 44, height: 44, borderRadius: 22,
              backgroundColor: TT.accent,
              shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 6,
            }}
          >
            <ArrowDown size={21} color={TT.onAccent} strokeWidth={2.4} />
          </Pressable>
        </View>
      </Animated.View>

      <TabBar active="moments" tone="dark" />
      {viewing ? <MomentDetail moment={viewing} onClose={() => setViewing(null)} onChanged={applyChange} /> : null}
    </Ground>
  );
}

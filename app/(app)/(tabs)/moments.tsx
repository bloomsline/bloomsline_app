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
import { ActivityIndicator, Animated, Dimensions, Pressable, RefreshControl, ScrollView, Text, TouchableOpacity, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { ArrowDown } from 'lucide-react-native';
import { FadeIn, HEADER_TOP } from '@/src/ui/editorial';
import { Line } from '@/src/moments/Line';
import { MomentsClosing, MomentsIntro } from '@/src/moments/FirstRun';
import { useMomentsFirstRun } from '@/src/moments/first-run';
import { MomentDetail, type MomentChange } from '@/src/moments/MomentDetail';
import type { GrowRect } from '@/src/ui/grow';
import { Cascade } from '@/src/ui/cascade';
import { useLanding } from '@/src/prefs/app-prefs';
import { useOnboarding } from '@/src/onboarding/context';
import { Ground } from '@/src/ui/Ground';
import { useI18n, greetingFor } from '@/src/i18n';
import { listMoments, type MomentDTO } from '@/src/api/moments';
import { keepFreshLinks } from '@/src/moments/keep-links';
import { ProfileButton } from '@/src/profile/ProfileButton';
import { useTheme } from '@/src/ui/theme-mode';
import { useStaleOnReturn } from '@/src/ui/use-stale-on-return';
import { useSelectedPractitioner } from '@/src/care/selected-practitioner';

/** One page of the line. Deliberately larger than any viewport: at ROW=118 a
 *  page is ~4700px tall, so one fetch always overflows the screen and a page can
 *  never land still sitting inside the trigger zone. That is what stops the
 *  "load, still near the top, load again" chain that would otherwise walk
 *  straight back through someone's entire history on first paint. */
const PAGE = 40;

/**
 * How far above and below the viewport a moment still draws its picture, and how
 * coarsely that window moves.
 *
 * A screenful of margin either side means a picture is already there by the time
 * it is scrolled to, at the cost of holding roughly three screens of them. The
 * step is what keeps the line from re-rendering on every scroll event: the
 * window only moves when the reader has travelled this far.
 */
const PHOTO_MARGIN = 900;
const PHOTO_STEP = 400;

/** How close to the top (px) starts the next fetch. Roughly a screenful of
 *  runway, so the page has landed before the line runs out under the thumb. */
const LOAD_AHEAD = 600;

/** The slot above the line holds the spinner, the "beginning" marker, or
 *  nothing — but it always holds the same HEIGHT. Content that appears and
 *  disappears above the viewport moves everything below it, which reads as the
 *  line twitching every time a page starts or finishes. */
const TOP_SLOT = 52;

/** Below the line in the scroll content: its bottom padding and the foot marker. */
const FOOT_PAD = 96;
const FOOT_MARK = 1;

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
  // When each moment's picture links arrived, and the list as last rendered, so a
  // fresh read can keep links that are still good (moments/keep-links).
  const linksAt = useRef(new Map<string, number>());
  const momentsRef = useRef(moments);
  momentsRef.current = moments;
  const [viewing, setViewing] = useState<MomentDTO | null>(null);
  // The node it was opened from, which the sheet grows out of (ui/grow).
  const [viewingFrom, setViewingFrom] = useState<GrowRect | null>(null);
  const openMoment = useCallback((m: MomentDTO, from?: GrowRect | null) => { setViewingFrom(from ?? null); setViewing(m); }, []);
  /**
   * Which band of the line may hold pictures, as the distance from the FOOT of
   * the scroll content to the top of the viewport.
   *
   * Measured from the foot, not the top, because the foot is the end that holds
   * still. An older page lands ABOVE the reader: measured from the top, the band
   * kept pointing at the same number of pixels down the line while every moment
   * moved a page further down, so for a frame the moments on screen fell outside
   * it. Their pictures dropped and rows unmounted, then the next scroll event put
   * them back: the blink when a page arrived. From the foot, the band means the
   * same moments before and after a page lands, in the same render.
   *
   * Everything stays mounted — the layout and the scroll position depend on it —
   * but only the nodes near the viewport decode an image. A decoded photograph
   * costs memory by its pixel size, not by the 56px shape it is drawn in, so a
   * year of moments held at once is what Android kills the app for.
   *
   * STATE, and quantised to `PHOTO_STEP`, so a scroll re-renders the line about
   * once a screenful rather than sixty times a second.
   */
  const [photoBand, setPhotoBand] = useState(() => Math.round(Dimensions.get('window').height / PHOTO_STEP));
  // "Nothing yet" and "we could not reach your line" are different things to be
  // told, and showing the welcoming empty state for a network failure is a lie.
  const [failed, setFailed] = useState(false);
  const insets = useSafeAreaInsets();
  const scroller = useRef<ScrollView>(null);
  // Has this patient been through the Moments introduction? Server-held, so a
  // reinstall does not introduce the app to someone who has been writing for
  // months. See `first-run.ts`.
  const firstRun = useMomentsFirstRun();

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
   *
   * STARTS TRUE, and that is the whole of "Moments opens at the oldest day".
   * Android fires an `onScroll` at offset 0 as the list lays out, before any
   * content-size event. That is not the reader scrolling — there is nothing to
   * scroll yet — but it was taken as such, and a gap of `height - 0` is the
   * whole line, so the anchor faithfully put them at the very top. iOS does not
   * send that event, which is why the line opened at today there and at April on
   * a phone. Nothing may speak for the reader until the first anchor has placed
   * them.
   */
  const growing = useRef(true);
  /**
   * Has a FINGER moved this list yet?
   *
   * The opening position used to be inferred: hold the reader's distance from
   * the foot, start that distance at zero, and the first anchor lands at the
   * bottom. It reasoned correctly and opened at April anyway — twice — because
   * it depends on which of `onScroll` and `onContentSizeChange` arrives first,
   * and Android does not answer that the way iOS does.
   *
   * So the opening is no longer inferred from anything. Until someone drags,
   * every resize pins the line to today; `onScrollBeginDrag` is the one event
   * that cannot be caused by our own `scrollTo`, so it is the only thing that
   * hands control over. Paging keeps the gap invariant, which is a different
   * problem and a sound solution to it.
   */
  const touched = useRef(false);
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

  // Back from a long time away (or across midnight): the same fresh first page a
  // return to the tab gets, so links work again and "Today" is today.
  const reloadRef = useRef<() => void>(() => {});
  const { markFresh } = useStaleOnReturn(() => reloadRef.current());
  const load = useCallback(async () => {
    const g = ++gen.current;
    try {
      const page = await listMoments({ limit: PAGE });
      if (g !== gen.current) return;
      markFresh();
      // Same files, same links: a photo does not blink every time the tab is
      // shown just because the page was read again (moments/keep-links).
      const merged = keepFreshLinks(momentsRef.current, page.moments, linksAt.current, Date.now());
      setMoments(merged);
      // An open moment is re-read with the page, so its sheet shows the share
      // state it has NOW (see MomentDetail): after a switch, "shared" is about
      // the practitioner just chosen.
      setViewing((v) => (v ? merged.find((m) => m.id === v.id) ?? v : v));
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
  }, [markFresh]);

  /** The next page back. Keyset, not offset: the cursor is the oldest
   *  `(capturedAt, id)` we hold, so moments captured while someone reads cannot
   *  shift a page boundary — and two captured in the same instant cannot
   *  straddle one and lose the second. */
  // A page that failed is not asked for again on the very next scroll event:
  // offline, `onScroll` fired every frame and "Loading earlier moments"
  // flickered for as long as the reader stayed near the top. It waits a few
  // seconds, or for a tap on the note that now says it failed.
  const olderFailedAt = useRef(0);
  const [olderFailed, setOlderFailed] = useState(false);
  /**
   * A fling is under way. A page that lands during one waits for it to end.
   *
   * Landing a page grows the line above the reader, and the anchor then moves
   * the scroll back by that height with `scrollTo`, which on both platforms
   * STOPS a fling dead. That was the freeze in the middle of scrolling back:
   * the momentum killed by our own correction, then a jolt. Held until the
   * momentum ends, the correction lands on a list that is standing still.
   */
  const flinging = useRef(false);
  const heldPage = useRef<null | (() => void)>(null);
  const releaseHeldPage = useCallback(() => {
    flinging.current = false;
    const apply = heldPage.current;
    heldPage.current = null;
    apply?.();
  }, []);
  const loadOlder = useCallback(async (force = false) => {
    // A page still waiting for a fling to end comes first: fetching the next one
    // now would put it in the same slot and lose the first.
    if (fetching.current || heldPage.current || !cursorRef.current) return;
    if (!force && Date.now() - olderFailedAt.current < 8000) return;
    const g = gen.current;
    fetching.current = true;
    setLoadingOlder(true);
    try {
      const page = await listMoments({ before: cursorRef.current, beforeId: cursorIdRef.current, limit: PAGE });
      if (g !== gen.current) return;
      const apply = () => {
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
          const now = Date.now();
          for (const m of fresh) linksAt.current.set(m.id, now);
          return fresh.length > 0 ? [...prev, ...fresh] : prev;
        });
        // Safety net. `growing` is normally lowered by the anchor, but a page of
        // pure duplicates returns `prev` unchanged, so the content never resizes
        // and `onContentSize` never runs — and a gap frozen forever would strand
        // the reader on the next real page. Harmless if the anchor got there
        // first.
        setTimeout(() => { growing.current = false; }, 600);
      };
      cursorRef.current = page.nextCursor;
      cursorIdRef.current = page.nextCursorId ?? null;
      setCursor(page.nextCursor);
      olderFailedAt.current = 0;
      setOlderFailed(false);
      if (flinging.current) {
        heldPage.current = apply;
        // Not every fling reports its end (Android can drop the event when the
        // list reaches its edge); a held page must not wait forever.
        setTimeout(() => { if (heldPage.current === apply) releaseHeldPage(); }, 1500);
      } else apply();
    } catch {
      // Leave the cursor exactly where it is. A failed page must not be mistaken
      // for the beginning of the line.
      olderFailedAt.current = Date.now();
      setOlderFailed(true);
    } finally {
      if (g === gen.current) setLoadingOlder(false);
      fetching.current = false;
    }
  }, [releaseHeldPage]);

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
      // Re-measured from the event rather than trusted from the last resize: the
      // gap is only meaningful against the height it was taken from — except
      // while a page is landing, when the height and the offset belong to
      // different moments. See `growing`.
      // Not before the reader has been placed: this is the write that used to
      // swallow the opening pin, by making the content-size event that follows
      // look like a no-op.
      if (touched.current) contentH.current = contentSize.height;
      if (!growing.current) bottomGap.current = contentSize.height - contentOffset.y;

      // Which band of the line is allowed to hold pictures. Quantised, so this
      // sets state about once a screenful rather than on every event.
      const band = Math.round((contentSize.height - contentOffset.y) / PHOTO_STEP);
      setPhotoBand((prev) => (prev === band ? prev : band));

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
  // The introduction's door carries a flag the dashed node does not: the first
  // moment is asked how they FEEL, because there may be no event to report yet,
  // and every one after it is asked what happened.
  const openFirstCapture = useCallback(
    () => router.navigate({ pathname: '/capture', params: { first: '1' } } as never),
    [router],
  );

  /**
   * Put the reader at today, unless they have taken over.
   *
   * Called from FOUR places on purpose, and that is not belt-and-braces for its
   * own sake. Three fixes to this screen each depended on one event behaving the
   * way it does on iOS, and each shipped still opening at the oldest day —
   * Android orders `onScroll`, `onLayout` and `onContentSizeChange` differently
   * and one of them was swallowing the pin. So no single event is load-bearing
   * now: whichever arrives, the line ends up at today, and the first drag stops
   * all of them for good.
   */
  const pinToToday = useCallback(() => {
    if (touched.current) return;
    scroller.current?.scrollToEnd({ animated: false });
    // And move the picture window with it. The band follows `onScroll`, which a
    // programmatic scroll does not reliably fire — so opening at today with the
    // band still at zero would load pictures for April and none for this week,
    // which is precisely backwards.
    // At the foot, the viewport's top is one viewport above the end.
    setPhotoBand((prev) => { const b = Math.round(viewportH.current / PHOTO_STEP); return prev === b ? prev : b; });
  }, []);

  const onContentSize = useCallback((_w: number, h: number) => {
    const changed = h !== contentH.current;
    contentH.current = h;

    // THE OPENING PIN RUNS FIRST, before the `changed` gate, and that placement
    // is the entire bug — three attempts at this sat underneath it.
    //
    // `onScroll` also writes `contentH.current` (see it, above). On Android a
    // scroll event fires at offset 0 while the list is still laying out, and it
    // carries the NEW content size — so it claims the height first, and the
    // content-size event that follows finds `changed === false` and returns
    // before reaching any of this. The anchor never ran at all. Not an
    // arithmetic problem, which is what the last two fixes treated it as: the
    // code was simply never getting here.
    //
    // Nobody has touched it yet, so this is still the opening however many
    // times the content has resized on the way. Straight to today.
    if (!touched.current) {
      pinToToday();
      growing.current = false;
      return;
    }

    if (!changed) return;

    // Content grew (a page) or shrank (a moment deleted). Either way it happened
    // ABOVE the reader, so put the foot of the line back the same distance away
    // and nothing appears to move.
    scroller.current?.scrollTo({ y: Math.max(0, h - bottomGap.current), animated: false });
    // The reader is where they belong again; scroll events may speak for them.
    growing.current = false;
  }, [pinToToday]);

  // The nodes landing in state is its own signal, and on Android it is not the
  // same frame as the size event.
  useEffect(() => {
    if (loading || touched.current) return;
    pinToToday();
    const again = setTimeout(pinToToday, 120);
    return () => clearTimeout(again);
  }, [loading, moments.length, pinToToday]);

  useFocusEffect(
    useCallback(() => {
      // Coming back to the tab resets to the newest page. That is the right call
      // right after a capture, which is the overwhelmingly common way to arrive
      // here — the detail sheet is a modal on this screen and does not refocus.
      // And it is an OPENING again: pin to today until a finger says otherwise.
      touched.current = false;
      growing.current = true;
      // Returning to the tab can bring the line back at exactly the height it
      // left at, and a content size that does not change fires no event — so
      // the pin above would have nothing to run on. Ask once directly, after
      // this frame. Safe when `load` then changes the height: the event fires
      // and pins again.
      const pins = [0, 150, 400].map((ms) => setTimeout(pinToToday, ms));
      void load();
      return () => pins.forEach(clearTimeout);
    }, [load, pinToToday]),
  );

  reloadRef.current = () => { touched.current = false; growing.current = true; void load(); };

  // "Shared" on each moment means shared with the SELECTED practitioner, so a
  // switch changes which ones carry the mark. The first page is read again;
  // older pages go with it, which a switch (a deliberate change of view) can
  // afford where a share toggle could not (see applyChange).
  const { selectionKey } = useSelectedPractitioner();
  const shownFor = useRef(selectionKey);
  useEffect(() => {
    if (shownFor.current === selectionKey) return;
    shownFor.current = selectionKey;
    reloadRef.current();
  }, [selectionKey]);

  /** Patch the line in place. Anything that refetched here would have to throw
   *  away the older pages behind the reader. */
  const applyChange = useCallback((change: MomentChange) => {
    setMoments((prev) =>
      'deleted' in change
        ? prev.filter((m) => m.id !== change.id)
        : prev.map((m) => (m.id === change.id
          ? { ...m, sharedWithPractitioner: change.shared, ...(change.sharedWith ? { sharedWith: change.sharedWith, sharedWithIds: change.sharedWithIds } : {}) }
          : m)),
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
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <Cascade route="moments" index={0}>
          <View style={{ paddingHorizontal: 22, paddingTop: HEADER_TOP, paddingBottom: 10, flexDirection: 'row', alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 27, fontWeight: '800', color: TT.ink, letterSpacing: -0.9, lineHeight: 31 }}>{title}</Text>
            </View>
            <ProfileButton />
          </View>
        </Cascade>

        {/* Three states, in the order a patient meets them.

            An EMPTY line always gets the introduction — not a first visit, an
            empty line. Someone who starts, wanders off and comes back a week
            later meets it again rather than landing on a blank screen, which is
            exactly the dead end this screen used to be.

            Then, once and only once, the closing: why any of this is worth a
            second moment. `firstRun.ready` gates both, or the introduction
            flashes up for a beat in front of someone who finished it last year.

            A failed fetch belongs to neither. "Nothing yet" and "we could not
            reach your line" are different things to be told, and introducing the
            app to someone whose connection dropped would be a lie about their
            own data. */}
        {/* The line settles in after the header when a tab press brings you here (ui/cascade). */}
        <Cascade route="moments" index={1} style={{ flex: 1 }}>
          {!loading && firstRun.ready && !failed && moments.length === 0 ? (
            <MomentsIntro onCapture={openFirstCapture} />
          ) : !loading && firstRun.ready && !failed && !firstRun.done ? (
            <MomentsClosing onDone={firstRun.complete} />
          ) : (
          <ScrollView
            ref={scroller}
            // `today` belongs just above the tab bar, however few moments there are.
          // With a short line the content did not overflow, so it sat top-aligned
          // and left ~185px of slack underneath — and because it does not
          // overflow, trimming the padding moves nothing. `flexGrow` +
          // `justify-end` pushes a short line down to the foot; a long one
          // scrolls exactly as before.
          contentContainerStyle={{ paddingBottom: FOOT_PAD, paddingTop: 22, flexGrow: 1, justifyContent: 'flex-end' }}
            showsVerticalScrollIndicator={false}
            // Index 1 is the foot marker: skip the line, which never moves.
            maintainVisibleContentPosition={{ minIndexForVisible: 1 }}
            onContentSizeChange={onContentSize}
            onLayout={(e) => { viewportH.current = e.nativeEvent.layout.height; pinToToday(); }}
            onScroll={onScroll}
            // The only signal that the reader, and not this screen, moved the list.
            onScrollBeginDrag={() => { touched.current = true; }}
            // A page that arrived mid-fling is applied once the list stands still
            // (see `flinging`). A finger landing on the list ends the fling too.
            onMomentumScrollBegin={() => { flinging.current = true; }}
            onMomentumScrollEnd={releaseHeldPage}
            onScrollEndDrag={(e) => { if ((e.nativeEvent.velocity?.y ?? 0) === 0) releaseHeldPage(); }}
            scrollEventThrottle={16}
            // Reachable only at the true beginning of the line: while pages remain,
            // crossing LOAD_AHEAD fetches one and the anchor puts a screenful back
            // above the reader, so the top can never actually be pulled.
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} tintColor={TT.faint} />}
          >
            {/* No TabIntro here. That card explained the tab in the abstract and
                then dismissed itself for good — it is keyed to storage, so it
                never came back, which is how someone ended up on an empty screen
                with nothing explaining it. The introduction above replaces it, and
                is tied to the line being empty rather than to a visit. */}

            {loading ? (
              <View style={{ paddingTop: 60, alignItems: 'center' }}>
                <ActivityIndicator color={TT.faint} />
              </View>
            ) : (
              <FadeIn>
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
                      ) : olderFailed ? (
                        <Pressable onPress={() => { void loadOlder(true); }} hitSlop={10}>
                          <Text style={{ fontSize: 11.5, color: TT.faint, textAlign: 'center', paddingHorizontal: 24 }}>{tr.olderFailed}</Text>
                        </Pressable>
                      ) : cursor === null ? (
                        <Text style={{ fontSize: 11.5, color: TT.faint }}>{tr.lineStart}</Text>
                      ) : null}
                    </View>

                    <Line
                      moments={moments}
                      width={width > 460 ? 420 : width}
                      locale={locale}
                      labels={lineLabels}
                      onOpen={openMoment}
                      onCaptureToday={openCapture}
                      photoFromFoot={photoBand * PHOTO_STEP + PHOTO_MARGIN - FOOT_PAD - FOOT_MARK}
                      photoToFoot={photoBand * PHOTO_STEP - viewportH.current - PHOTO_MARGIN - FOOT_PAD - FOOT_MARK}
                    />
                  </>
                )}
              </FadeIn>
            )}

            {/* THE FOOT MARKER, and what holds the reader still when a page lands.
                The scroll view keeps this view where it is on screen across a
                content change (maintainVisibleContentPosition, below), adjusting
                the offset natively in the same frame the taller line is mounted.
                The line itself cannot be the anchor: it is one view whose top never
                moves, so a page landing inside it looks like no change at all.
                This sits under it and moves down by exactly the page's height.
                `onContentSize` still does the same correction from JS, which is
                what the web build has; on a phone it finds nothing left to do. */}
            <View collapsable={false} style={{ height: FOOT_MARK }} />
          </ScrollView>
          )}
        </Cascade>
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

      {/* A refresh that failed with the line already on screen. It used to end
          the spinner and say nothing, so a stale line passed for a current one. */}
      {failed && !loading && moments.length > 0 ? (
        <Pressable
          onPress={() => { setRefreshing(true); void load(); }}
          style={{ position: 'absolute', top: insets.top + 12, left: 22, right: 22, borderRadius: 16, paddingVertical: 10, paddingHorizontal: 14, backgroundColor: TT.sheet, borderWidth: 1, borderColor: TT.cardLine }}
        >
          <Text style={{ fontSize: 12.5, color: TT.inkSoft, textAlign: 'center' }}>{tr.refreshFailed}</Text>
        </Pressable>
      ) : null}

      {viewing ? <MomentDetail moment={viewing} origin={viewingFrom} onClose={() => setViewing(null)} onChanged={applyChange} /> : null}
    </Ground>
  );
}

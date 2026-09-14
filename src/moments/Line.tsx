// "Your line" — the vertical Moments timeline.
//
// Time runs DOWN (oldest at the top, today at the foot) and valence runs ACROSS
// (heavier left, lighter right). That is the whole idea: a week reads as a shape
// you can see rather than a list you have to reconstruct, and a run of hard days
// leans visibly to one side.
//
// The horizontal position is DERIVED from the feelings a patient picked — the
// mean of their MOOD_SCORES — which is why capture never had to ask for it or
// store it. A moment with no feelings sits on the centre line.
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Image, Platform, Pressable, Text, View } from 'react-native';
import Svg, { Path, Circle, Defs, ClipPath, Image as SvgImage } from 'react-native-svg';
import { Quote, ImageOff, AudioLines, Video, Play, Plus, Eye } from 'lucide-react-native';
import { MOOD_SCORES, moodColor } from '@/src/moments/moods';
import { shapeFor, shapePath, type MoodShape } from '@/src/moments/shapes';
import type { MomentDTO } from '@/src/api/moments';
import { useTheme } from '@/src/ui/theme-mode';
// Translucent ink for the timeline's own marks. Lived here first; now shared,
// because capture needed the same thing and two copies of a theme rule is how
// one of them ends up wrong.
import { OVER_MEDIA, veil } from '@/src/ui/tokens';

/** 0..1 across the line: 0 is the heaviest edge, 1 the lightest. */
export function valenceOf(m: { moods: string[] }): number {
  const scores = m.moods.map((k) => MOOD_SCORES[k]).filter((n): n is number => typeof n === 'number');
  if (scores.length === 0) return 0.5; // nothing said → dead centre, not an opinion
  return Math.max(0, Math.min(100, scores.reduce((a, b) => a + b, 0) / scores.length)) / 100;
}

/**
 * What the circle shows. Driven by the FIRST media item a patient attached, not
 * by whether a picture happens to be findable: an earlier version searched for
 * an image and fell through to the quote glyph for everything else, so a video
 * or a voice note looked identical to a written note, and a moment with words
 * AND a photo showed the words.
 *
 * A poster is preferred where one exists, but its absence never changes the
 * KIND — a video with no poster is still a video.
 */
function faceOf(m: MomentDTO): LineNode['face'] {
  const first = m.media[0];
  if (!first) return null; // no media at all → this is a written moment
  const kind = first.kind === 'video' ? 'video' : first.kind === 'audio' ? 'audio' : 'image';
  // Only an IMAGE's own url is a usable image source. A video's url is the video
  // file and an audio's is the recording — falling back to either renders an
  // <Image> pointed at a non-image, which fails and reads as a broken file
  // rather than as a video or a voice note.
  const uri = first.thumbnailUrl ?? (kind === 'image' ? first.url : null);
  return { kind, uri };
}

export interface LineNode {
  moment: MomentDTO;
  x: number; // px, centre of the node
  y: number;
  /** The FIRST media item decides the face — a photo shows the photo, a video
   *  its poster, a voice note its own mark. Null only when there is no media at
   *  all, which is the one case that shows the words. */
  face: { kind: 'image' | 'video' | 'audio'; uri: string | null } | null;
  color: string;
  /** The silhouette, blended from every feeling on the moment. */
  shape: MoodShape;
  dayLabel: string | null; // only on the first node of a day
}

const NODE = 56;

/**
 * How tall one slice of the stem is.
 *
 * The stem cannot be one <Svg> the height of the line: react-native-svg gives
 * each one a single backing bitmap, and Android's Canvas throws above 100MB.
 * At 1200dp and a 3x screen a slice is about 1170 x 3600 px — 17MB, an order of
 * magnitude clear of the limit on any density we will meet, and few enough
 * slices on screen at once to cost nothing.
 */
const STEM_SLICE = 1200;

/** The top of every slice needed to cover a line this tall. */
function sliceTops(total: number): number[] {
  const tops: number[] = [];
  for (let y = 0; y < total; y += STEM_SLICE) tops.push(y);
  return tops;
}
const ROW = 118; // vertical rhythm between moments
const TOP_PAD = 18;
const RAIL = 44;      // the day rail down the left
const SIDE_PAD = 74;  // keeps a node (and its dot) clear of either edge

/**
 * Lay the week out. Kept separate from the drawing so it can be reasoned about
 * (and, later, tested) without a renderer.
 */
/**
 * The label on the left rail, at the first node of each day.
 *
 * Three tiers, because a weekday stops being unambiguous after seven days: a
 * moment from March read "Thu", identically to last Thursday, and the labels
 * repeated down the line with nothing to anchor them.
 *
 *   today / yesterday   named, because that is how people refer to them
 *   within this week    weekday — short and enough
 *   older               a real date, with the YEAR once it is not this year
 */
export function dayLabelFor(d: Date, now: Date, locale: 'en' | 'fr', l: { today: string; yesterday: string }): string {
  const tag = (x: Date) => `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`;
  const y = new Date(now);
  y.setDate(y.getDate() - 1);
  if (tag(d) === tag(now)) return l.today;
  if (tag(d) === tag(y)) return l.yesterday;
  const lc = locale === 'fr' ? 'fr-FR' : 'en-US';
  // Calendar days apart, not hours — 25 hours ago can still be "this week".
  const midnight = (x: Date) => +new Date(x.getFullYear(), x.getMonth(), x.getDate());
  const days = Math.round((midnight(now) - midnight(d)) / 86_400_000);
  if (days < 7) return d.toLocaleDateString(lc, { weekday: 'short' });
  return d.toLocaleDateString(lc, d.getFullYear() === now.getFullYear() ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' });
}

export function layout(moments: MomentDTO[], width: number, locale: 'en' | 'fr', mode: 'light' | 'dark', dayLabels: { today: string; yesterday: string }, now: Date = new Date()): { nodes: LineNode[]; height: number } {
  const usable = width - SIDE_PAD - NODE / 2 - 14;
  // Oldest first: the line is read downward, and "today" belongs at the foot.
  const ordered = [...moments].sort((a, b) => +new Date(a.capturedAt) - +new Date(b.capturedAt));

  let lastDay = '';
  const nodes = ordered.map((m, i) => {
    const d = new Date(m.capturedAt);
    const dayKey = d.toDateString();
    const isNewDay = dayKey !== lastDay;
    lastDay = dayKey;
    return {
      moment: m,
      x: SIDE_PAD + valenceOf(m) * usable,
      y: TOP_PAD + i * ROW + NODE / 2,
      face: faceOf(m),
      color: m.moods.length > 0 ? moodColor(m.moods[0]) : veil(mode, 0.35),
      shape: shapeFor(m.moods),
      dayLabel: isNewDay ? dayLabelFor(d, now, locale, dayLabels) : null,
    };
  });

  return { nodes, height: TOP_PAD + ordered.length * ROW + NODE };
}

/** The connecting stem: a smooth curve through the points, not straight hops.
 *  Each segment depends only on its two ends, so the stem through any run of
 *  consecutive points is exactly that stretch of the whole stem. */
function stemPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return '';
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const midY = (a.y + b.y) / 2;
    d += ` C ${a.x} ${midY}, ${b.x} ${midY}, ${b.x} ${b.y}`;
  }
  return d;
}

/**
 * The circle itself. A picture when there is one, a quote glyph when the moment
 * is words, and a struck-through image when the picture cannot be loaded.
 *
 * That last state matters: some older moments hold media rows whose objects are
 * no longer in the bucket, and an empty circle reads as a bug in the timeline
 * rather than as a missing file. Saying so is kinder and truer than a blank.
 */
/**
 * The circle a moment used to be, replaced by the shape of what it FELT like.
 *
 * The silhouette comes from the feelings recorded on the moment (see
 * `shapes.ts`); the colour is the first of them. A moment with no feelings keeps
 * the plain circle, which is the one form that claims nothing.
 *
 * Drawn in SVG rather than as a `borderRadius` View because the shape is an
 * arbitrary path and the photograph has to be CLIPPED to it — a picture in a
 * square behind a shaped ring would read as a mistake.
 */
/** Ever-increasing, so no two mounted nodes can share a clipPath id — not even
 *  the same moment rendered twice. See `clipId` below for why that matters. */
let clipSeq = 0;

/**
 * `nearby` is what keeps this screen inside Android's memory budget.
 *
 * A decoded bitmap costs memory by its PIXEL dimensions, not by the 56px shape
 * it is drawn in, and the line keeps every page ever scrolled through mounted —
 * so a year of moments is a year of decoded photographs held at once. Android
 * caps an app's heap and then kills it, which is the "Bloomsline stopped
 * working" reported while scrolling back through an old line.
 *
 * So the NODES all stay — the layout, the stem and the scroll position depend on
 * that, and they have been hard enough to get right. Only the PICTURES come and
 * go: a node away from the viewport draws its silhouette and its glyph, and
 * loads nothing. Scrolling back to it loads again, from cache, fast.
 */
function NodeFace({ node, onPress, nearby }: { node: LineNode; onPress: () => void; nearby: boolean }) {
  const { mode } = useTheme();
  const [broken, setBroken] = useState(false);
  const face = node.face;
  const showPhoto = !!face?.uri && !broken && nearby;
  // A new link is a new chance. Nodes are keyed by moment, so they outlive a
  // refresh, and a photo that failed once (an expired link, a dropped
  // connection) stayed "missing" even after fresh links arrived.
  useEffect(() => { setBroken(false); }, [face?.uri]);

  // Ask whether the file is there, without decoding it into a view — and only
  // for the nodes that are going to draw it.
  useEffect(() => {
    const uri = nearby ? face?.uri : null;
    if (!uri) return;
    let alive = true;
    Image.prefetch(uri).catch(() => { if (alive) setBroken(true); });
    return () => { alive = false; };
  }, [face?.uri, nearby]);

  // Leave a pixel for the stroke, or the outermost spikes get shaved.
  const d = shapePath(node.shape, NODE / 2, NODE / 2, NODE / 2 - 1);
  // Unique per MOUNT, not per moment.
  //
  // Reported on Android: a photograph is clipped to its shape on first load and
  // comes back an unclipped SQUARE after switching tabs and returning. Deriving
  // the id from the moment id means the outgoing and incoming Moments screens
  // are briefly mounted together holding the SAME clipPath id, and
  // react-native-svg keeps its clip definitions in a registry keyed by that id —
  // so the survivor can end up pointing at a definition that has been torn down.
  //
  // NOT REPRODUCED ON WEB: the same tab round-trip leaves every reference intact
  // there, because RNSVG resolves through the DOM instead. So this is a reasoned
  // fix for a known RNSVG-on-native id-collision, and it needs confirming on a
  // device. If a square still comes back, the mechanism is something else and
  // the next thing to try is dropping clipPath entirely for a mask.
  //
  // `useId` would not do: it is derived from tree position, so remounting the
  // same tree hands back the same value. A counter cannot collide.
  const clipId = useRef(`mclip${(clipSeq += 1)}`).current;

  return (
    <Pressable
      onPress={onPress}
      style={{ position: 'absolute', left: node.x - NODE / 2, top: ROW / 2 - NODE / 2, width: NODE, height: NODE, alignItems: 'center', justifyContent: 'center' }}
    >
      <Svg width={NODE} height={NODE} style={{ position: 'absolute' }}>
        <Defs>
          <ClipPath id={clipId}>
            <Path d={d} />
          </ClipPath>
        </Defs>
        <Path d={d} fill={showPhoto ? 'transparent' : `${node.color}24`} stroke={node.color} strokeWidth={1.4} strokeLinejoin="round" />
        {showPhoto ? (
          <SvgImage href={{ uri: face!.uri! }} x={0} y={0} width={NODE} height={NODE} preserveAspectRatio="xMidYMid slice" clipPath={`url(#${clipId})`} />
        ) : null}
        {/* Redrawn over the photograph so the outline is not lost against it. */}
        {showPhoto ? <Path d={d} fill="none" stroke={node.color} strokeWidth={1.4} strokeLinejoin="round" /> : null}
      </Svg>

      {/* No second <Image> here any more, and that matters more than it looks.
          react-native-svg's Image has onLoad but no onError, and a moment whose
          object has left the bucket must SAY so rather than render an empty
          shape — so a hidden 1px Image used to load the same uri purely to
          report failure. "Served from the same cache, not a second download" was
          true and beside the point: it is a second DECODE, and a decoded bitmap
          is sized by the source, not by the 1px box holding it.

          A moment whose media predates on-device thumbnails has no
          `thumbnailUrl`, so `face.uri` is the full photograph — several
          megabytes once decoded, twice, per node, with every page ever scrolled
          through still mounted. Reported as the app closing itself while
          scrolling back through an old line, which is what running out of
          memory looks like from the outside.

          `prefetch` answers the same question without holding a bitmap. */}

      {showPhoto ? null : face?.kind === 'audio' ? (
        <AudioLines size={19} color={veil(mode, 0.72)} strokeWidth={2} />
      ) : face && broken ? (
        // The kind is still known even when the file will not load, so say which
        // kind is missing rather than falling back to "this is a written note".
        <ImageOff size={17} color={veil(mode, 0.38)} strokeWidth={2} />
      ) : face?.kind === 'video' ? (
        <Video size={18} color={veil(mode, 0.72)} strokeWidth={2} />
      ) : (
        <Quote size={18} color={veil(mode, 0.55)} strokeWidth={2} />
      )}

      {/* A video keeps its play mark even over a poster — the poster is a still,
          and nothing else would say it moves. */}
      {face?.kind === 'video' && showPhoto ? (
        <View style={{ position: 'absolute', width: 22, height: 22, borderRadius: 11, backgroundColor: OVER_MEDIA.scrim, alignItems: 'center', justifyContent: 'center' }}>
          <Play size={11} color={OVER_MEDIA.ink} strokeWidth={2.5} fill={OVER_MEDIA.ink} />
        </View>
      ) : null}
    </Pressable>
  );
}

/**
 * Memoised, and it matters. The screen re-renders on scroll now that it carries
 * a position rail and a way back to today; without this, every scroll event
 * would reconcile a node, a dot and a label for each of a thousand moments.
 * Every prop is stable across those renders — `labels` and `onCaptureToday` are
 * memoised at the call site for exactly this reason.
 */
export const Line = memo(function Line({
  moments, width, locale, labels, onOpen, onCaptureToday, photoFrom, photoTo,
}: {
  moments: MomentDTO[];
  width: number;
  /** The band of the line, in its own coordinates, allowed to hold pictures.
   *  Quantised by the caller so scrolling does not re-render this on every
   *  pixel. See `nearby` on NodeFace. */
  photoFrom: number;
  photoTo: number;
  locale: 'en' | 'fr';
  labels: { heavier: string; lighter: string; today: string; yesterday: string; tapToRead: string; capture: string; plusMore: (n: number) => string };
  onOpen: (m: MomentDTO) => void;
  onCaptureToday: () => void;
}) {
  const { mode } = useTheme();
  const { t: TT } = useTheme();
  const { nodes, height } = useMemo(() => layout(moments, width, locale, mode, labels), [moments, width, locale, mode, labels]);

  const todayY = height - NODE / 2 - 6;
  const todayX = SIDE_PAD + 0.5 * (width - SIDE_PAD - NODE / 2 - 14);
  const total = height + 30;
  // Every point of the stem, top to bottom: the moments, then today.
  const points = useMemo(() => [...nodes.map((n) => ({ x: n.x, y: n.y })), { x: todayX, y: todayY }], [nodes, todayX, todayY]);

  // WHAT IS MOUNTED, and this is the scroll freeze.
  //
  // Every moment ever scrolled through used to be rendered, and every one of
  // them re-rendered whenever the picture band moved (every 400px of scroll) and
  // whenever an older page arrived. Measured in the web preview: 40ms at 40
  // moments, 130ms at 400, up to 200ms at 800, and several times that on a phone.
  // That is the freeze, and it grew the further back someone read.
  //
  // Now only the moments near the reader are mounted; the rest are space. The
  // layout, the height and so the scroll position are computed from ALL of them,
  // so unmounting a far node moves nothing. And each row is anchored to the
  // BOTTOM of the line (see NodeRow), which is the end that holds still when an
  // older page lands above, so rows already mounted do not re-render at all.
  const mountFrom = photoFrom - MOUNT_EXTRA;
  const mountTo = photoTo + MOUNT_EXTRA;

  return (
    <View style={{ width, height: height + 30 }}>
      {/* The axis: a hairline down the middle and the two ends named once. */}
      <View style={{ position: 'absolute', left: todayX, top: 8, bottom: 30, width: 1, backgroundColor: veil(mode, 0.07) }} />
      <Text style={{ position: 'absolute', left: RAIL, top: -12, fontSize: 11, color: veil(mode, 0.28) }}>{labels.heavier}</Text>
      <Text style={{ position: 'absolute', right: 14, top: -12, fontSize: 11, color: veil(mode, 0.28) }}>{labels.lighter}</Text>

      {/* THE STEM, IN SLICES, and this is what was crashing the app.
          `react-native-svg` rasterises each <Svg> into ONE bitmap, and this was
          a single <Svg> as tall as the whole line — 118px per moment, times the
          screen's density. Android's Canvas refuses any bitmap over 100MB, so
          at around a hundred moments it threw
          `trying to draw too large (184861440bytes) bitmap` and took the app
          with it. Not memory pressure: a hard limit on one bitmap, which is why
          it killed a phone with memory to spare, and why iOS never did it.

          Each slice draws the SAME path through a shifted viewBox, so the line
          is identical and no bitmap is ever taller than one slice. And only the
          slices near the reader are drawn at all — the window the pictures
          already use. */}
      {points.length > 1
        ? sliceTops(total).map((top) =>
            // A wider window than the pictures get: a slice is one stroked
            // path and costs almost nothing, so there is no reason to let the
            // line appear to end just off-screen.
            top + STEM_SLICE >= photoFrom - STEM_SLICE * 2 && top <= photoTo + STEM_SLICE * 2 ? (
              <Svg
                key={top}
                width={width}
                height={STEM_SLICE}
                viewBox={`0 ${top} ${width} ${STEM_SLICE}`}
                style={{ position: 'absolute', top }}
              >
                <Path d={stemPath(pointsNear(points, top - ROW, top + STEM_SLICE + ROW))} stroke={veil(mode, 0.22)} strokeWidth={1} fill="none" />
              </Svg>
            ) : null,
          )
        : null}

      {nodes.map((n) => (n.y >= mountFrom && n.y <= mountTo ? (
        <NodeRow
          key={n.moment.id}
          node={n}
          bottom={total - (n.y + ROW / 2)}
          nearby={n.y >= photoFrom && n.y <= photoTo}
          width={width}
          labels={labels}
          onOpen={onOpen}
        />
      ) : null))}

      <Text style={{ position: 'absolute', left: 14, top: todayY - 8, fontSize: 12, color: TT.inkSoft, fontWeight: '600' }}>{labels.today}</Text>
      <TodayNode x={todayX} y={todayY} onPress={onCaptureToday} label={labels.capture} />
    </View>
  );
});

/** Pixels of line mounted beyond the picture band on each side. */
const MOUNT_EXTRA = 1200;

/** The stem points between two heights, plus one on each side so the segments
 *  crossing the edges are drawn. `pts` are in line order (top to bottom). */
function pointsNear(pts: { x: number; y: number }[], from: number, to: number): { x: number; y: number }[] {
  let lo = 0;
  let hi = pts.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (pts[mid].y < from) lo = mid + 1; else hi = mid; }
  let end = lo;
  while (end < pts.length && pts[end].y <= to) end++;
  return pts.slice(Math.max(0, lo - 1), Math.min(pts.length, end + 1));
}

/**
 * One moment on the line: its day label, its shape, its marks and its words.
 *
 * Positioned by its distance from the BOTTOM of the line. The line is laid out
 * oldest first, so an older page arriving pushed every moment's `top` down and
 * re-rendered all of them; their distance from the foot does not change, so a
 * row already on screen keeps every prop and is skipped. The row is one ROW tall
 * around the node (not zero-height): Android does not deliver touches outside a
 * parent's bounds.
 */
const NodeRow = memo(function NodeRow({ node, bottom, nearby, width, labels, onOpen }: {
  node: LineNode;
  bottom: number;
  nearby: boolean;
  width: number;
  labels: { tapToRead: string; plusMore: (n: number) => string };
  onOpen: (m: MomentDTO) => void;
}) {
  const { mode, t: TT } = useTheme();
  const open = () => onOpen(node.moment);
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, width, bottom, height: ROW }}>
      {node.dayLabel ? (
        <Text style={{ position: 'absolute', left: 14, top: ROW / 2 - 8, fontSize: 12, color: veil(mode, 0.42) }}>{node.dayLabel}</Text>
      ) : null}

      <NodeFace node={node} onPress={open} nearby={nearby} />

      {/* Two quiet marks under the node, and only when they are true.
          Outside the shape rather than on it: several of the shapes reach
          the full radius, so a corner badge would sit on a spike. */}
      <NodeMarks node={node} label={labels.plusMore} />

      {/* A moment with words and no picture says them here — the line would
          otherwise be a row of identical glyphs. */}
      {!node.face && node.moment.textContent ? (
        <Pressable
          onPress={open}
          style={{ position: 'absolute', top: ROW / 2 - 22, left: node.x < width / 2 ? node.x + NODE / 2 + 16 : undefined, right: node.x < width / 2 ? undefined : width - (node.x - NODE / 2) + 16, maxWidth: width * 0.42 }}
        >
          <Text numberOfLines={2} style={{ fontSize: 13, color: TT.inkSoft, lineHeight: 18, textAlign: node.x < width / 2 ? 'left' : 'right' }}>
            {node.moment.textContent}
          </Text>
          <Text style={{ fontSize: 11, color: TT.faint, marginTop: 3, textAlign: node.x < width / 2 ? 'left' : 'right' }}>{labels.tapToRead}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}, (a, b) =>
  // Everything drawn comes from the moment (same object until it changes), its
  // day label, where it sits and whether it may show its picture.
  a.node.moment === b.node.moment && a.node.dayLabel === b.node.dayLabel && a.node.x === b.node.x
  && a.bottom === b.bottom && a.nearby === b.nearby && a.width === b.width && a.labels === b.labels && a.onOpen === b.onOpen);

/**
 * Today: the one place on the line with nothing in it yet.
 *
 * It was a static dashed circle, and it read as decoration — a gap in the line
 * rather than the way to fill it. It turns now, slowly, and carries a faint `+`.
 * The movement is the whole point: on a screen where everything else is still,
 * the only thing moving is the thing to press.
 *
 * Deliberately quiet. 12 seconds a turn is barely perceptible frame to frame and
 * unmistakable if you look — which is the register the rest of this app is
 * written in. Anything faster would nag, and nagging someone into recording how
 * they feel is the opposite of the point.
 *
 * The RING rotates, not the `+`: a turning plus reads as a spinner, which means
 * "wait", which is the wrong word entirely.
 *
 * The native driver on native only. react-native-web has no native driver, and
 * `Animated.loop` given `useNativeDriver: true` there runs ONE pass and stops —
 * the ring sat parked at 360deg, which is identity, so it looked like the
 * animation had never started at all. On native it matters: the loop never
 * touches JS after it starts, and this lives inside a memoised component built
 * to avoid re-renders while the reader scrolls.
 */
function TodayNode({ x, y, onPress, label }: { x: number; y: number; onPress: () => void; label: string }) {
  const { mode, t: TT } = useTheme();
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 12000, easing: Easing.linear, useNativeDriver: Platform.OS !== 'web' }),
    );
    loop.start();
    return () => loop.stop();
  }, [spin]);

  const r = NODE / 2 - 4;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{ position: 'absolute', left: x - NODE / 2, top: y - NODE / 2, width: NODE, height: NODE, borderRadius: NODE / 2, alignItems: 'center', justifyContent: 'center' }}
    >
      <Animated.View
        style={{
          position: 'absolute', width: NODE, height: NODE,
          transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }],
        }}
      >
        <Svg width={NODE} height={NODE}>
          <Circle cx={NODE / 2} cy={NODE / 2} r={r} stroke={veil(mode, 0.30)} strokeWidth={1.5} strokeDasharray="4 5" fill="none" />
        </Svg>
      </Animated.View>
      <Plus size={16} color={TT.faint} strokeWidth={2.2} />
    </Pressable>
  );
}

/**
 * What the shape cannot say: that there is more than one thing here, and that
 * the practitioner can see it.
 *
 * Both are rare enough that most nodes show nothing, which is the point — the
 * line stays a line. `Eye` is already the app's mark for "your practitioner can
 * see this" (it is the one on the sharing row in capture), so it means the same
 * thing in both places.
 */
function NodeMarks({ node, label }: { node: LineNode; label: (n: number) => string }) {
  const { mode } = useTheme();
  const extra = Math.max(0, node.moment.media.length - 1);
  // Any practitioner can see it, not only the one selected in the app: the mark
  // says "someone other than you can see this", and a moment shared with another
  // practitioner lost it on switching.
  const shared = node.moment.sharedWithPractitioner || (node.moment.sharedWith?.length ?? 0) > 0;
  if (extra === 0 && !shared) return null;
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute', top: ROW / 2 + NODE / 2 + 5, left: node.x - NODE / 2, width: NODE,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
      }}
    >
      {shared ? <Eye size={11} color={veil(mode, 0.5)} strokeWidth={2.2} /> : null}
      {extra > 0 ? (
        <Text style={{ fontSize: 10.5, fontWeight: '700', color: veil(mode, 0.5) }}>{label(extra)}</Text>
      ) : null}
    </View>
  );
}

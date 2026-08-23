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
import { memo, useMemo, useRef, useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import Svg, { Path, Circle, Defs, ClipPath, Image as SvgImage } from 'react-native-svg';
import { Quote, ImageOff, AudioLines, Video, Play } from 'lucide-react-native';
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

/** The connecting stem: a smooth curve through the nodes, not straight hops. */
function stemPath(nodes: LineNode[], todayY: number, todayX: number): string {
  const pts = [...nodes.map((n) => ({ x: n.x, y: n.y })), { x: todayX, y: todayY }];
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

function NodeFace({ node, onPress }: { node: LineNode; onPress: () => void }) {
  const { mode } = useTheme();
  const [broken, setBroken] = useState(false);
  const face = node.face;
  const showPhoto = !!face?.uri && !broken;

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
      style={{ position: 'absolute', left: node.x - NODE / 2, top: node.y - NODE / 2, width: NODE, height: NODE, alignItems: 'center', justifyContent: 'center' }}
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

      {/* react-native-svg's Image has onLoad but no onError, and a moment whose
          object has left the bucket must SAY so rather than render an empty
          shape. So a 1px RN Image loads the same URI purely to report failure;
          it is served from the same cache, not a second download. */}
      {face?.uri && !broken ? (
        <Image source={{ uri: face.uri }} style={{ width: 1, height: 1, opacity: 0, position: 'absolute' }} onError={() => setBroken(true)} />
      ) : null}

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
  moments, width, locale, labels, onOpen, onCaptureToday,
}: {
  moments: MomentDTO[];
  width: number;
  locale: 'en' | 'fr';
  labels: { heavier: string; lighter: string; today: string; yesterday: string; tapToRead: string };
  onOpen: (m: MomentDTO) => void;
  onCaptureToday: () => void;
}) {
  const { mode } = useTheme();
  const { t: TT } = useTheme();
  const { nodes, height } = useMemo(() => layout(moments, width, locale, mode, labels), [moments, width, locale, mode, labels]);

  const todayY = height - NODE / 2 - 6;
  const todayX = SIDE_PAD + 0.5 * (width - SIDE_PAD - NODE / 2 - 14);
  const path = stemPath(nodes, todayY, todayX);

  return (
    <View style={{ width, height: height + 30 }}>
      {/* The axis: a hairline down the middle and the two ends named once. */}
      <View style={{ position: 'absolute', left: todayX, top: 8, bottom: 30, width: 1, backgroundColor: veil(mode, 0.07) }} />
      <Text style={{ position: 'absolute', left: RAIL, top: -12, fontSize: 11, color: veil(mode, 0.28) }}>{labels.heavier}</Text>
      <Text style={{ position: 'absolute', right: 14, top: -12, fontSize: 11, color: veil(mode, 0.28) }}>{labels.lighter}</Text>

      <Svg width={width} height={height + 30} style={{ position: 'absolute' }}>
        {path ? <Path d={path} stroke={veil(mode, 0.22)} strokeWidth={1} fill="none" /> : null}
        {/* Today: an empty circle waiting to be filled, drawn dashed so it reads
            as a place for something rather than something already there. */}
        <Circle cx={todayX} cy={todayY} r={NODE / 2 - 4} stroke={veil(mode, 0.30)} strokeWidth={1.5} strokeDasharray="4 5" fill="none" />
      </Svg>

      {nodes.map((n) => (
        <View key={n.moment.id}>
          {n.dayLabel ? (
            <Text style={{ position: 'absolute', left: 14, top: n.y - 8, fontSize: 12, color: veil(mode, 0.42) }}>{n.dayLabel}</Text>
          ) : null}

          <NodeFace node={n} onPress={() => onOpen(n.moment)} />

          {/* A moment with words and no picture says them here — the line would
              otherwise be a row of identical glyphs. */}
          {!n.face && n.moment.textContent ? (
            <Pressable
              onPress={() => onOpen(n.moment)}
              style={{ position: 'absolute', top: n.y - 22, left: n.x < width / 2 ? n.x + NODE / 2 + 16 : undefined, right: n.x < width / 2 ? undefined : width - (n.x - NODE / 2) + 16, maxWidth: width * 0.42 }}
            >
              <Text numberOfLines={2} style={{ fontSize: 13, color: TT.inkSoft, lineHeight: 18, textAlign: n.x < width / 2 ? 'left' : 'right' }}>
                {n.moment.textContent}
              </Text>
              <Text style={{ fontSize: 11, color: TT.faint, marginTop: 3, textAlign: n.x < width / 2 ? 'left' : 'right' }}>{labels.tapToRead}</Text>
            </Pressable>
          ) : null}
        </View>
      ))}

      <Text style={{ position: 'absolute', left: 14, top: todayY - 8, fontSize: 12, color: TT.inkSoft, fontWeight: '600' }}>{labels.today}</Text>
      <Pressable
        onPress={onCaptureToday}
        style={{ position: 'absolute', left: todayX - NODE / 2, top: todayY - NODE / 2, width: NODE, height: NODE, borderRadius: NODE / 2 }}
      />
    </View>
  );
});

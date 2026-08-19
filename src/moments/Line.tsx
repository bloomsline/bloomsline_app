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
import { useMemo } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { Quote } from 'lucide-react-native';
import { EDD } from '@/src/ui/editorial';
import { MOOD_SCORES, moodColor } from '@/src/moments/moods';
import type { MomentDTO } from '@/src/api/moments';

/** 0..1 across the line: 0 is the heaviest edge, 1 the lightest. */
export function valenceOf(m: { moods: string[] }): number {
  const scores = m.moods.map((k) => MOOD_SCORES[k]).filter((n): n is number => typeof n === 'number');
  if (scores.length === 0) return 0.5; // nothing said → dead centre, not an opinion
  return Math.max(0, Math.min(100, scores.reduce((a, b) => a + b, 0) / scores.length)) / 100;
}

export interface LineNode {
  moment: MomentDTO;
  x: number; // px, centre of the node
  y: number;
  thumb: string | null;
  color: string;
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
export function layout(moments: MomentDTO[], width: number, locale: 'en' | 'fr'): { nodes: LineNode[]; height: number } {
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
      thumb: m.media.find((x) => x.thumbnailUrl)?.thumbnailUrl ?? m.media.find((x) => x.kind === 'image')?.url ?? null,
      color: m.moods.length > 0 ? moodColor(m.moods[0]) : 'rgba(255,255,255,0.35)',
      dayLabel: isNewDay ? d.toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US', { weekday: 'short' }) : null,
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

export function Line({
  moments, width, locale, labels, onOpen, onCaptureToday,
}: {
  moments: MomentDTO[];
  width: number;
  locale: 'en' | 'fr';
  labels: { heavier: string; lighter: string; today: string; tapToRead: string };
  onOpen: (m: MomentDTO) => void;
  onCaptureToday: () => void;
}) {
  const { nodes, height } = useMemo(() => layout(moments, width, locale), [moments, width, locale]);

  const todayY = height - NODE / 2 - 6;
  const todayX = SIDE_PAD + 0.5 * (width - SIDE_PAD - NODE / 2 - 14);
  const path = stemPath(nodes, todayY, todayX);

  return (
    <View style={{ width, height: height + 30 }}>
      {/* The axis: a hairline down the middle and the two ends named once. */}
      <View style={{ position: 'absolute', left: todayX, top: 8, bottom: 30, width: 1, backgroundColor: 'rgba(255,255,255,0.07)' }} />
      <Text style={{ position: 'absolute', left: RAIL, top: -12, fontSize: 11, color: 'rgba(255,255,255,0.28)' }}>{labels.heavier}</Text>
      <Text style={{ position: 'absolute', right: 14, top: -12, fontSize: 11, color: 'rgba(255,255,255,0.28)' }}>{labels.lighter}</Text>

      <Svg width={width} height={height + 30} style={{ position: 'absolute' }}>
        {path ? <Path d={path} stroke="rgba(255,255,255,0.22)" strokeWidth={1} fill="none" /> : null}
        {/* Today: an empty circle waiting to be filled, drawn dashed so it reads
            as a place for something rather than something already there. */}
        <Circle cx={todayX} cy={todayY} r={NODE / 2 - 4} stroke="rgba(255,255,255,0.30)" strokeWidth={1.5} strokeDasharray="4 5" fill="none" />
      </Svg>

      {nodes.map((n) => (
        <View key={n.moment.id}>
          {n.dayLabel ? (
            <Text style={{ position: 'absolute', left: 14, top: n.y - 8, fontSize: 12, color: 'rgba(255,255,255,0.42)' }}>{n.dayLabel}</Text>
          ) : null}

          <Pressable
            onPress={() => onOpen(n.moment)}
            style={{ position: 'absolute', left: n.x - NODE / 2, top: n.y - NODE / 2, width: NODE, height: NODE, borderRadius: NODE / 2, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.07)' }}
          >
            {n.thumb ? (
              <Image source={{ uri: n.thumb }} style={{ width: NODE, height: NODE }} />
            ) : (
              <Quote size={18} color="rgba(255,255,255,0.55)" strokeWidth={2} />
            )}
          </Pressable>

          {/* The feeling, as a single dot. The whole node cannot be tinted without
              fighting the photograph underneath it. */}
          <View style={{ position: 'absolute', left: n.x + NODE / 2 - 12, top: n.y + NODE / 2 - 12, width: 9, height: 9, borderRadius: 5, backgroundColor: n.color, borderWidth: 1, borderColor: 'rgba(14,21,18,0.6)' }} />

          {/* A moment with words and no picture says them here — the line would
              otherwise be a row of identical glyphs. */}
          {!n.thumb && n.moment.textContent ? (
            <Pressable
              onPress={() => onOpen(n.moment)}
              style={{ position: 'absolute', top: n.y - 22, left: n.x < width / 2 ? n.x + NODE / 2 + 16 : undefined, right: n.x < width / 2 ? undefined : width - (n.x - NODE / 2) + 16, maxWidth: width * 0.42 }}
            >
              <Text numberOfLines={2} style={{ fontSize: 13, color: EDD.textSoft, lineHeight: 18, textAlign: n.x < width / 2 ? 'left' : 'right' }}>
                {n.moment.textContent}
              </Text>
              <Text style={{ fontSize: 11, color: EDD.faint, marginTop: 3, textAlign: n.x < width / 2 ? 'left' : 'right' }}>{labels.tapToRead}</Text>
            </Pressable>
          ) : null}
        </View>
      ))}

      <Text style={{ position: 'absolute', left: 14, top: todayY - 8, fontSize: 12, color: EDD.textSoft, fontWeight: '600' }}>{labels.today}</Text>
      <Pressable
        onPress={onCaptureToday}
        style={{ position: 'absolute', left: todayX - NODE / 2, top: todayY - NODE / 2, width: NODE, height: NODE, borderRadius: NODE / 2 }}
      />
    </View>
  );
}

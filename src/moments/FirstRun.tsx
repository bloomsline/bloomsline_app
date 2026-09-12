// The Moments introduction: the two screens a patient meets before their line
// exists, and only those two.
//
// `MomentsIntro` belongs to an EMPTY LINE, not to a first visit. While there is
// nothing on the line it is there every single time, however many times someone
// opens the tab — so a person who starts, wanders off and comes back a week
// later is not dropped onto a blank screen with no way in. That was the bug:
// `TodayNode` lives inside `Line`, and the empty branch skipped `Line`, so the
// one door into capture did not exist for the people who needed it most.
//
// `MomentsClosing` is shown once, after the first moment is saved, and answers
// what the opening screen cannot: why would I do this twice.
import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, PanResponder, Platform, Pressable, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, ClipPath, Defs, G, Path, Rect } from 'react-native-svg';
import { ImagePlus, Play, Quote } from 'lucide-react-native';
import { useI18n } from '@/src/i18n';
import { useTheme } from '@/src/ui/theme-mode';
import { OVER_MEDIA, onMedia, veil } from '@/src/ui/tokens';

// `Animated.loop` given the native driver runs ONE pass on react-native-web and
// parks — the same trap that once left the line's dashed ring frozen at 360deg,
// which is identity, so it looked like it had never started.
const NATIVE = Platform.OS !== 'web';

/* ── The deck ──────────────────────────────────────────────────────────────── */

type Kind = 'words' | 'voice' | 'photo' | 'video';

interface Card {
  kind: Kind;
  size: number;
  rotate: number;
  left: number;
  top: number;
  opacity: number;
  /** Its own clock, so the group breathes instead of pulsing in unison. */
  duration: number;
  /** How far it follows a finger. The near cards move more than the far ones. */
  drag: number;
}

const CARDS: Card[] = [
  { kind: 'words', size: 76, rotate: -17, left: -10, top: 88, opacity: 0.5, duration: 7500, drag: 0.35 },
  { kind: 'voice', size: 88, rotate: -9, left: 62, top: 60, opacity: 0.86, duration: 6500, drag: 0.6 },
  { kind: 'photo', size: 96, rotate: 0, left: 147, top: 38, opacity: 1, duration: 5500, drag: 0.85 },
  { kind: 'video', size: 88, rotate: 9, left: 240, top: 60, opacity: 0.86, duration: 7000, drag: 0.6 },
  { kind: 'words', size: 76, rotate: 17, left: 324, top: 88, opacity: 0.5, duration: 6000, drag: 0.35 },
];

/** The face of a card. These are KINDS, never invented entries: no fabricated
 *  sentence, no stock photograph. The picture cards stand in for a photograph
 *  rather than pretending to be one — this is the first screen a patient meets,
 *  and nothing on it should look like somebody's real moment. */
function CardFace({ card, width }: { card: Card; width: number }) {
  const { t: TT } = useTheme();
  const bar = (w: string) => (
    <View key={w} style={{ height: 3, width: w as never, borderRadius: 2, backgroundColor: onMedia(0.22) }} />
  );

  if (card.kind === 'voice') {
    const bars = [10, 22, 34, 18, 27, 9, 15];
    return (
      <LinearGradient colors={['rgba(127,217,192,0.22)', 'rgba(18,40,34,0.95)']} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 3.5 }}>
        {bars.map((h, i) => (
          <View key={i} style={{ width: 3, height: h * (width / 88), borderRadius: 2, backgroundColor: TT.accent }} />
        ))}
      </LinearGradient>
    );
  }

  if (card.kind === 'photo' || card.kind === 'video') {
    const photo = card.kind === 'photo';
    return (
      <LinearGradient
        colors={photo ? ['#3E4A3C', '#1C2620', '#121A16'] : ['#2F3B4A', '#1A2028', '#121619']}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
      >
        <Svg width={width} height={width} style={{ position: 'absolute' }}>
          {photo ? <Circle cx={width * 0.7} cy={width * 0.29} r={width * 0.095} fill={onMedia(0.24)} /> : null}
          <Path d={`M0 ${width * 0.77} L${width * 0.29} ${width * 0.48} L${width * 0.52} ${width * 0.71} L${width * 0.67} ${width * 0.58} L${width} ${width * 0.87} L${width} ${width} L0 ${width} Z`} fill={onMedia(0.16)} />
        </Svg>
        {photo ? (
          <ImagePlus size={Math.round(width * 0.2)} color={onMedia(0.34)} strokeWidth={1.8} />
        ) : (
          <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: OVER_MEDIA.scrim, alignItems: 'center', justifyContent: 'center' }}>
            <Play size={13} color={OVER_MEDIA.ink} fill={OVER_MEDIA.ink} strokeWidth={2} />
          </View>
        )}
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#2A2320', '#1A1714']} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={{ flex: 1, padding: 12, justifyContent: 'space-between' }}>
      <Quote size={Math.round(width * 0.24)} color={onMedia(0.55)} strokeWidth={2} />
      <View style={{ gap: 5 }}>{['100%', '72%'].map(bar)}</View>
    </LinearGradient>
  );
}

export function MomentsIntro({ onCapture }: { onCapture: () => void }) {
  const { t: TT } = useTheme();
  const { t } = useI18n();
  const tr = t.firstRun;

  // One value per card, looping 0 → 1 → 0. Native-driven, so the drift costs no
  // JS frames on a screen that is otherwise perfectly still.
  const drift = useRef(CARDS.map(() => new Animated.Value(0))).current;
  // Where the finger has taken the deck. Shared by every card; each one applies
  // its own fraction of it, which is what makes the fan feel like depth.
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;

  useEffect(() => {
    const loops = drift.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(v, { toValue: 1, duration: CARDS[i].duration, easing: Easing.inOut(Easing.quad), useNativeDriver: NATIVE }),
          Animated.timing(v, { toValue: 0, duration: CARDS[i].duration, easing: Easing.inOut(Easing.quad), useNativeDriver: NATIVE }),
        ]),
      ),
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [drift]);

  const responder = useMemo(
    () =>
      PanResponder.create({
        // Only once it is clearly a drag: a tap belongs to the button below, and
        // claiming every touch here would make the deck feel sticky.
        onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 6 || Math.abs(g.dy) > 6,
        onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false }),
        onPanResponderRelease: () => {
          // Back into the fan. Some bounce, because the deck is meant to feel
          // like objects rather than a diagram.
          Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: false, friction: 6, tension: 60 }).start();
        },
        onPanResponderTerminate: () => {
          Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: false, friction: 6, tension: 60 }).start();
        },
      }),
    [pan],
  );

  return (
    <View style={{ flex: 1, justifyContent: 'center', paddingBottom: 96 }}>
      <View style={{ height: 230 }} {...responder.panHandlers}>
        {CARDS.map((card, i) => {
          const wobble = drift[i].interpolate({ inputRange: [0, 1], outputRange: [`${card.rotate}deg`, `${card.rotate + (i % 2 === 0 ? 1.6 : -1.4)}deg`] });
          const lift = drift[i].interpolate({ inputRange: [0, 1], outputRange: [0, i % 2 === 0 ? -7 : 6] });
          // TWO nodes, and it is not decoration. `pan` is written by the gesture
          // through Animated.event, which is JS-driven; `drift` is a native loop.
          // React Native refuses to mix the two drivers on one animated node —
          // "attempting to run JS driven animation on an animated node that has
          // been moved to native" — so the drag lives on the outer view and the
          // drift on the inner one, each with its own driver.
          return (
            <Animated.View
              key={i}
              style={{
                position: 'absolute',
                left: card.left,
                top: card.top,
                width: card.size,
                height: card.size,
                opacity: card.opacity,
                // NOTHING paints on this node. It carries the drag and nothing
                // else: it has no border radius, so a shadow or an elevation
                // here draws a hard-cornered box behind the rounded card — a
                // pale square peeking out from under every one of them, which is
                // exactly how this shipped. The lift belongs to the inner view,
                // the one that is actually rounded.
                backgroundColor: 'transparent',
                transform: [
                  { translateX: Animated.multiply(pan.x, card.drag) },
                  { translateY: Animated.multiply(pan.y, card.drag) },
                ],
              }}
            >
              <Animated.View
                style={{
                  flex: 1,
                  // The lift lives here, on the rounded, clipped node, so it
                  // follows the card's own shape instead of boxing it.
                  shadowColor: '#000',
                  shadowOpacity: 0.42,
                  shadowRadius: 18,
                  shadowOffset: { width: 0, height: 10 },
                  borderRadius: 24,
                  overflow: 'hidden',
                  borderWidth: 1,
                  borderColor: TT.cardLine,
                  transform: [{ translateY: lift }, { rotate: wobble }],
                }}
              >
                <CardFace card={card} width={card.size} />
              </Animated.View>
            </Animated.View>
          );
        })}
      </View>

      <View style={{ paddingHorizontal: 34, paddingTop: 26, alignItems: 'center' }}>
        <Text style={{ fontSize: 21, fontWeight: '800', letterSpacing: -0.4, lineHeight: 27, color: TT.ink, textAlign: 'center' }}>
          {t.line.emptyTitle}
        </Text>
        <Text style={{ marginTop: 9, fontSize: 14, lineHeight: 21, color: TT.inkSoft, textAlign: 'center' }}>{tr.introBody}</Text>
      </View>

      <Pressable
        onPress={onCapture}
        accessibilityRole="button"
        style={{ marginTop: 24, marginHorizontal: 22, height: 52, borderRadius: 26, backgroundColor: TT.ctaBg, alignItems: 'center', justifyContent: 'center' }}
      >
        <Text style={{ fontSize: 15, fontWeight: '700', color: TT.ctaFg }}>{tr.captureFirst}</Text>
      </Pressable>

      {/* Nothing else. No second door: the button IS the door, and a dashed node
          on an empty line would be a second one to the same room. */}
    </View>
  );
}

/* ── The closing ───────────────────────────────────────────────────────────── */

/** A year of the line, as an example, so the point of doing this twice is
 *  something a person SEES rather than something we claim. Every silhouette is
 *  a different feeling: a year drawn as a column of identical circles would say
 *  the opposite of what the line actually does. */
const YEAR = [
  // d: the silhouette, drawn around its own centre. cx/cy: where it sits.
  { cx: 120, cy: 26, color: '#475569', d: 'M0,-21 L4.5,-7.8 L18.2,-10.5 L9,0 L18.2,10.5 L4.5,7.8 L0,21 L-4.5,7.8 L-18.2,10.5 L-9,0 L-18.2,-10.5 L-4.5,-7.8 Z' },
  { cx: 168, cy: 90, color: '#3B82F6', d: 'M0,-19 L8,-13.9 L16.5,-9.5 L16,0 L16.5,9.5 L8,13.9 L0,19 L-8,13.9 L-16.5,9.5 L-16,0 L-16.5,-9.5 L-8,-13.9 Z' },
  { cx: 150, cy: 150, color: '#6B7280', d: 'M-22,0 C-22,-10 -12,-14 0,-14 C12,-14 22,-10 22,0 C22,10 12,15 0,15 C-12,15 -22,10 -22,0 Z' },
  { cx: 232, cy: 222, color: '#8B5CF6', d: 'M0,-20 C10,-17 20,-10 19,2 C18,13 9,20 0,21 C-9,20 -18,13 -19,2 C-20,-10 -10,-17 0,-20 Z', voice: true },
  { cx: 262, cy: 288, color: '#F97316', d: 'M0,-21 C11,-19 21,-11 20,2 C19,14 10,21 0,22 C-10,21 -19,14 -20,2 C-21,-11 -11,-19 0,-21 Z', photo: true },
  { cx: 286, cy: 344, color: '#4A9A86', d: 'M0,-22 C9,-18 15,-8 13,4 C11,15 6,21 0,22 C-6,21 -11,15 -13,4 C-15,-8 -9,-18 0,-22 Z' },
] as const;

const STEM =
  'M 120 -14 C 120 22, 190 8, 168 62 C 150 106, 118 84, 150 148 C 176 200, 244 160, 232 222 C 224 266, 236 250, 262 288 C 282 316, 316 314, 286 344 C 262 368, 211 358, 211 396';

/** Months back from today, formatted the way the line's own rail formats an
 *  older day. Real dates rather than invented ones, so the span reads as a year
 *  wherever and whenever the app is opened. */
function exampleDates(locale: 'en' | 'fr'): string[] {
  const lc = locale === 'fr' ? 'fr-FR' : 'en-US';
  return [10, 8, 6, 4, 2, 1].map((back) => {
    const d = new Date();
    d.setMonth(d.getMonth() - back);
    return d.toLocaleDateString(lc, { day: 'numeric', month: 'short' });
  });
}

export function MomentsClosing({ onDone }: { onDone: () => void }) {
  const { t: TT, mode } = useTheme();
  const { t, locale } = useI18n();
  const tr = t.firstRun;
  const dates = useMemo(() => exampleDates(locale), [locale]);

  // The screen leaves before their line arrives. Pressing "Build my line" should
  // feel like the example giving way to the real thing, not like a page swap.
  const out = useRef(new Animated.Value(0)).current;
  const leaving = useRef(false);

  const build = () => {
    if (leaving.current) return; // a double tap must not fire the write twice
    leaving.current = true;
    Animated.timing(out, { toValue: 1, duration: 260, easing: Easing.in(Easing.quad), useNativeDriver: NATIVE }).start(({ finished }) => {
      if (finished) onDone();
    });
  };

  const rails = [20, 84, 144, 216, 282, 338];

  return (
    <Animated.View
      style={{
        flex: 1,
        opacity: out.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
        transform: [{ translateY: out.interpolate({ inputRange: [0, 1], outputRange: [0, -18] }) }],
      }}
    >
      <View style={{ flex: 1, marginTop: 2 }}>
        <Svg width={390} height={430} style={{ position: 'absolute', left: 0, top: 0 }}>
          <Defs>
            <ClipPath id="momentsClosingPhoto">
              <Path d={YEAR[4].d} transform={`translate(${YEAR[4].cx} ${YEAR[4].cy})`} />
            </ClipPath>
          </Defs>

          <Path d={STEM} stroke={veil(mode, 0.18)} strokeWidth={1} fill="none" />

          {YEAR.map((n, i) => (
            <G key={i} transform={`translate(${n.cx} ${n.cy})`}>
              {'photo' in n && n.photo ? null : <Path d={n.d} fill={`${n.color}30`} stroke={n.color} strokeWidth={1.4} strokeLinejoin="round" />}
              {'voice' in n && n.voice ? (
                <G stroke={veil(mode, 0.75)} strokeWidth={1.7} strokeLinecap="round">
                  <Path d="M-7,-4 v8" />
                  <Path d="M-2.5,-8 v16" />
                  <Path d="M2,-5 v10" />
                  <Path d="M6.5,-2 v4" />
                </G>
              ) : null}
            </G>
          ))}

          {/* The photograph, clipped to its own silhouette the way the line clips
              a real one — and a placeholder, never a fake picture. */}
          <G clipPath="url(#momentsClosingPhoto)">
            <Rect x={YEAR[4].cx - 22} y={YEAR[4].cy - 22} width={44} height={44} fill="#33423B" />
            <Circle cx={YEAR[4].cx + 8} cy={YEAR[4].cy - 10} r={5} fill={onMedia(0.28)} />
            <Path d={`M${YEAR[4].cx - 22} ${YEAR[4].cy + 14} L${YEAR[4].cx - 8} ${YEAR[4].cy} L${YEAR[4].cx + 2} ${YEAR[4].cy + 10} L${YEAR[4].cx + 9} ${YEAR[4].cy + 4} L${YEAR[4].cx + 22} ${YEAR[4].cy + 17} L${YEAR[4].cx + 22} ${YEAR[4].cy + 22} L${YEAR[4].cx - 22} ${YEAR[4].cy + 22} Z`} fill={onMedia(0.20)} />
          </G>
          <Path d={YEAR[4].d} transform={`translate(${YEAR[4].cx} ${YEAR[4].cy})`} fill="none" stroke={YEAR[4].color} strokeWidth={1.4} />

          {/* Today, still open — the same mark that ends their real line. */}
          <Circle cx={211} cy={396} r={19} fill="none" stroke={veil(mode, 0.3)} strokeWidth={1.5} strokeDasharray="4 5" />
          <Path d="M211 388 v16 M203 396 h16" stroke={TT.faint} strokeWidth={2} strokeLinecap="round" />
        </Svg>

        {/* The line does not begin at the top of the screen: it carries on
            upward, out of view, which is the whole point of this screen. */}
        <LinearGradient
          colors={[TT.bg, TT.bg, 'transparent']}
          locations={[0, 0.44, 1]}
          pointerEvents="none"
          style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 70 }}
        />
        <Text style={{ position: 'absolute', right: 16, top: 6, fontSize: 10.5, letterSpacing: 0.3, color: veil(mode, 0.38) }}>{tr.exampleYear}</Text>

        {rails.map((top, i) => (
          <Text key={top} style={{ position: 'absolute', left: 14, top, fontSize: 11.5, color: veil(mode, 0.42) }}>
            {dates[i]}
          </Text>
        ))}
        <Text style={{ position: 'absolute', left: 14, top: 390, fontSize: 11.5, fontWeight: '600', color: TT.inkSoft }}>{t.line.today}</Text>
      </View>

      {/* The words and the action on ONE raised surface. Three loose things at
          the foot of a screen get skipped; a single lifted block gets read, and
          a button that belongs to the same block makes the sentence and the
          press one thought instead of two. */}
      <View
        style={{
          marginHorizontal: 16,
          marginBottom: 96,
          backgroundColor: TT.sheet,
          borderWidth: 1,
          borderColor: TT.cardLine,
          borderRadius: 26,
          padding: 20,
          shadowColor: '#000',
          shadowOpacity: 0.55,
          shadowRadius: 24,
          shadowOffset: { width: 0, height: -12 },
          elevation: 10,
        }}
      >
        <Text style={{ fontSize: 22, fontWeight: '800', letterSpacing: -0.5, lineHeight: 28, color: TT.ink }}>{tr.closingTitle}</Text>
        <Text style={{ marginTop: 9, fontSize: 15, lineHeight: 23, color: TT.ink }}>{tr.closingBody}</Text>
        <Pressable
          onPress={build}
          accessibilityRole="button"
          style={{ marginTop: 18, height: 52, borderRadius: 26, backgroundColor: TT.ctaBg, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ fontSize: 15, fontWeight: '700', color: TT.ctaFg }}>{tr.build}</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

// Emotional Flow timeline — ported from v1 (components/EmotionalTimeline.tsx).
// Adapted to the v2 MomentDTO (`capturedAt` instead of `created_at`) and to
// English strings (i18n later). This is the signature Moments visual: a smooth
// Bézier curve through the day's moments, each an orb colored by its mood, with
// a gradient fill, a "now" marker, a time axis, and the latest-mood pill.
import { View, Text, TouchableOpacity, Animated } from 'react-native';
import { useEffect, useRef, useState } from 'react';
import Svg, { Path, Circle, Defs, LinearGradient, Stop, Line, Text as SvgText } from 'react-native-svg';
import { MOOD_SCORES, MOOD_COLORS, moodLabel } from './moods';
import { formatTime } from './DayNav';
import type { MomentDTO } from '@/src/api/moments';

const TL_H = 180;
const CURVE_TOP = 28;
const CURVE_BOT = 140;
const TIME_Y = 168;

export function EmotionalTimeline({
  moments,
  showNow,
  onMomentPress,
  glowDots,
}: {
  moments: MomentDTO[];
  showNow: boolean;
  onMomentPress?: (m: MomentDTO) => void;
  glowDots?: boolean;
}) {
  const [containerWidth, setContainerWidth] = useState(350);
  const CHART_W = containerWidth - 8;
  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!glowDots) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 1000, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [glowDots, pulseAnim]);

  const sorted = [...moments]
    .filter((m) => m.moods && m.moods.length > 0)
    .sort((a, b) => new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime());

  if (sorted.length === 0) return null;

  const points = sorted.map((m) => {
    const date = new Date(m.capturedAt);
    const hour = date.getHours() + date.getMinutes() / 60;
    const mood = m.moods[0];
    const score = MOOD_SCORES[mood] ?? 50;
    const x = Math.max(16, Math.min(CHART_W - 16, (hour / 24) * CHART_W));
    const y = CURVE_TOP + (1 - score / 100) * (CURVE_BOT - CURVE_TOP);
    return { x, y, mood, score, time: date, moment: m };
  });

  let curvePath = '';
  let fillPath = '';
  if (points.length >= 2) {
    curvePath = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const cpx = (prev.x + curr.x) / 2;
      curvePath += ` C ${cpx},${prev.y} ${cpx},${curr.y} ${curr.x},${curr.y}`;
    }
    fillPath = curvePath + ` L ${points[points.length - 1].x},${CURVE_BOT} L ${points[0].x},${CURVE_BOT} Z`;
  }

  const now = new Date();
  const nowHour = now.getHours() + now.getMinutes() / 60;
  const nowX = Math.max(16, Math.min(CHART_W - 16, (nowHour / 24) * CHART_W));

  const timeLabels = [
    { hour: 6, text: '6a' },
    { hour: 12, text: '12p' },
    { hour: 18, text: '6p' },
  ];

  const latest = points[points.length - 1];
  const latestColor = MOOD_COLORS[latest.mood] || '#000';

  return (
    <View
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
      style={{ backgroundColor: '#fff', borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: '#EBEBEB' }}
    >
      {/* Card header */}
      <View style={{ paddingHorizontal: 20, paddingTop: 18, paddingBottom: 4, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontSize: 12, fontWeight: '600', letterSpacing: 1, color: '#8A8A8A', textTransform: 'uppercase' }}>Emotional Flow</Text>
        <View style={{ backgroundColor: '#f5f5f5', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 }}>
          <Text style={{ fontSize: 12, fontWeight: '600', color: '#999' }}>
            {sorted.length} {sorted.length === 1 ? 'moment' : 'moments'}
          </Text>
        </View>
      </View>

      {/* SVG chart */}
      <View style={{ paddingHorizontal: 4 }}>
        <Svg width={CHART_W} height={TL_H}>
          <Defs>
            <LinearGradient id="curveGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={latestColor} stopOpacity="0.1" />
              <Stop offset="1" stopColor={latestColor} stopOpacity="0" />
            </LinearGradient>
          </Defs>

          {[0.25, 0.5, 0.75].map((pct) => {
            const gy = CURVE_TOP + pct * (CURVE_BOT - CURVE_TOP);
            return <Line key={pct} x1={16} y1={gy} x2={CHART_W - 16} y2={gy} stroke="#000" strokeWidth={0.5} opacity={0.06} />;
          })}

          {fillPath ? <Path d={fillPath} fill="url(#curveGrad)" /> : null}
          {curvePath ? <Path d={curvePath} stroke="#000" strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" /> : null}

          {points.length === 1 && (
            <Line x1={16} y1={points[0].y} x2={CHART_W - 16} y2={points[0].y} stroke="#000" strokeWidth={1} strokeDasharray="4,6" opacity={0.06} />
          )}

          {showNow && (
            <>
              <Line x1={nowX} y1={CURVE_TOP - 4} x2={nowX} y2={CURVE_BOT + 4} stroke="#000" strokeWidth={1} strokeDasharray="2,4" opacity={0.1} />
              <SvgText x={nowX} y={CURVE_TOP - 10} fontSize={9} fill="#ccc" textAnchor="middle" fontWeight="600">
                Now
              </SvgText>
            </>
          )}

          {points.flatMap((pt, i) => {
            const isLatest = i === points.length - 1;
            const color = MOOD_COLORS[pt.mood] || '#666';
            const elements = [];
            if (glowDots) {
              elements.push(
                <Circle key={`glow2-${i}`} cx={pt.x} cy={pt.y} r={24} fill={color} opacity={0.08} />,
                <Circle key={`glow1-${i}`} cx={pt.x} cy={pt.y} r={16} fill={color} opacity={0.15} />,
              );
            } else if (isLatest) {
              elements.push(<Circle key={`glow-${i}`} cx={pt.x} cy={pt.y} r={16} fill={color} opacity={0.1} />);
            }
            elements.push(
              <Circle key={`orb-${i}`} cx={pt.x} cy={pt.y} r={isLatest || glowDots ? 8 : 5} fill={color} stroke="#fff" strokeWidth={isLatest || glowDots ? 3 : 2} />,
            );
            return elements;
          })}

          {timeLabels.map((l) => (
            <SvgText key={l.hour} x={(l.hour / 24) * CHART_W} y={TIME_Y} fontSize={10} fill="#d4d4d4" textAnchor="middle">
              {l.text}
            </SvgText>
          ))}
        </Svg>

        {/* Touch targets + pulse rings */}
        {points.map((pt, i) => {
          const color = MOOD_COLORS[pt.mood] || '#666';
          return (
            <TouchableOpacity
              key={`hit-${i}`}
              activeOpacity={0.7}
              onPress={() => onMomentPress?.(pt.moment)}
              style={{ position: 'absolute', left: pt.x - 22, top: pt.y - 22, width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' }}
            >
              {glowDots && (
                <>
                  <Animated.View
                    style={{
                      position: 'absolute', width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: color,
                      opacity: pulseAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.6, 0.1, 0] }),
                      transform: [{ scale: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 2.2] }) }],
                    }}
                  />
                  <Animated.View
                    style={{
                      position: 'absolute', width: 44, height: 44, borderRadius: 22, backgroundColor: color,
                      opacity: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.05] }),
                      transform: [{ scale: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] }) }],
                    }}
                  />
                  <View style={{ position: 'absolute', top: 48, alignItems: 'center' }}>
                    <Text style={{ fontSize: 11, fontWeight: '600', color }}>{'↑ Tap'}</Text>
                  </View>
                </>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Latest mood pill */}
      <View style={{ paddingHorizontal: 20, paddingBottom: 18, paddingTop: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: latestColor }} />
          <Text style={{ fontSize: 15, fontWeight: '600', color: '#000' }}>{moodLabel(latest.mood)}</Text>
          <Text style={{ fontSize: 13, color: '#bbb' }}>· {formatTime(latest.time.toISOString())}</Text>
        </View>
      </View>
    </View>
  );
}

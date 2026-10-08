import { useMemo, useRef, useState } from 'react';
import { PanResponder, Platform, Pressable, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import type { SignatureStrokes } from '@/src/api/care';
import { PAPER } from '@/src/ui/tokens';

// Draw a signature with a finger.
//
// The pad keeps the strokes as points, in its own pixels, and draws them with
// react-native-svg, which the app already ships: no new native module, so it
// works in the installed app. The server turns the points into the signature
// image (care: lib/documents/signature-raster.ts). The pad is paper-white with
// dark ink in both themes, because that is what lands on the PDF.
//
// Points come from pageX/pageY less the pad's place in the window, measured
// when a stroke starts. `locationX/Y` were not used: on the web they are
// missing, and on a phone they are relative to whichever shape is under the
// finger, which on a pad with ink on it is often a previous stroke.

const HEIGHT = 170;
// On the web a drag also selects text on the page; drawing must not.
const NO_SELECT = (Platform.OS === 'web' ? { userSelect: 'none' } : {}) as object;

export function SignaturePad({ value, onChange, onDrawing, clearLabel, hint }: {
  value: SignatureStrokes | null;
  onChange: (v: SignatureStrokes | null) => void;
  /** True while a finger is down, so the screen can stop scrolling under it. */
  onDrawing?: (drawing: boolean) => void;
  clearLabel: string;
  hint: string;
}) {
  const box = useRef<View>(null);
  const [width, setWidth] = useState(0);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const pending = useRef<[number, number][]>([]);
  const live = useRef<[number, number][]>([]);
  // Lifted before the pad was measured: finish once it is, or the stroke is lost.
  const lifted = useRef(false);
  const [, redraw] = useState(0);
  const strokes = useRef<[number, number][][]>(value?.strokes ?? []);
  const latest = useRef({ onChange, onDrawing, width });
  latest.current = { onChange, onDrawing, width };

  const add = (pageX: number, pageY: number) => {
    const o = origin.current;
    if (!o) { pending.current.push([pageX, pageY]); return; }
    const p: [number, number] = [Math.round((pageX - o.x) * 10) / 10, Math.round((pageY - o.y) * 10) / 10];
    const last = live.current[live.current.length - 1];
    if (last && Math.hypot(p[0] - last[0], p[1] - last[1]) < 1.5) return;
    live.current.push(p);
    redraw((n) => n + 1);
  };

  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: (e) => {
      latest.current.onDrawing?.(true);
      origin.current = null;
      lifted.current = false;
      live.current = [];
      pending.current = [[e.nativeEvent.pageX, e.nativeEvent.pageY]];
      box.current?.measureInWindow((x, y) => {
        origin.current = { x, y };
        const queued = pending.current;
        pending.current = [];
        queued.forEach(([px, py]) => add(px, py));
        if (lifted.current) finish();
      });
    },
    onPanResponderMove: (e) => add(e.nativeEvent.pageX, e.nativeEvent.pageY),
    // The lift carries the last point; a quick flick may have no move after the last one drawn.
    onPanResponderRelease: (e) => { add(e.nativeEvent.pageX, e.nativeEvent.pageY); finish(); },
    onPanResponderTerminate: () => finish(),
  }), []);

  function finish() {
    if (!origin.current) { lifted.current = true; return; }
    lifted.current = false;
    latest.current.onDrawing?.(false);
    if (live.current.length > 0) strokes.current = [...strokes.current, live.current];
    live.current = [];
    const w = latest.current.width;
    latest.current.onChange(strokes.current.length && w ? { width: w, height: HEIGHT, strokes: strokes.current } : null);
    redraw((n) => n + 1);
  }

  const clear = () => {
    strokes.current = [];
    live.current = [];
    onChange(null);
    redraw((n) => n + 1);
  };

  const d = (pts: [number, number][]) =>
    pts.length === 1 ? `M ${pts[0][0]} ${pts[0][1]} l 0.1 0` : `M ${pts.map((p) => `${p[0]} ${p[1]}`).join(' L ')}`;
  const all = live.current.length ? [...strokes.current, live.current] : strokes.current;

  return (
    <View>
      <View
        ref={box}
        onLayout={(e) => setWidth(Math.round(e.nativeEvent.layout.width))}
        {...responder.panHandlers}
        accessibilityLabel={hint}
        style={[{ height: HEIGHT, borderRadius: 14, borderWidth: 1, borderColor: PAPER.edge, backgroundColor: PAPER.ground, overflow: 'hidden' }, NO_SELECT]}
      >
        {all.length === 0 && (
          <Text pointerEvents="none" style={{ position: 'absolute', alignSelf: 'center', top: HEIGHT / 2 - 10, fontSize: 13, color: PAPER.hint }}>{hint}</Text>
        )}
        <View pointerEvents="none" style={{ position: 'absolute', left: 18, right: 18, bottom: 34, height: 1, backgroundColor: PAPER.rule }} />
        <Svg width="100%" height={HEIGHT} pointerEvents="none">
          {all.map((s, i) => (
            <Path key={i} d={d(s)} stroke={PAPER.ink} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          ))}
        </Svg>
      </View>
      {all.length > 0 && (
        <Pressable onPress={clear} accessibilityRole="button" hitSlop={8} style={{ alignSelf: 'flex-end', paddingVertical: 6, paddingHorizontal: 4 }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: PAPER.muted }}>{clearLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}

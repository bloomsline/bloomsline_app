import { createContext, forwardRef, useCallback, useContext, useEffect, useImperativeHandle, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View, type LayoutChangeEvent } from 'react-native';
import Animated, { Easing, interpolate, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useReduceMotion } from '@/src/ui/app-tabs';

// "The card grows into the page": the card that was tapped becomes the sheet or
// page it opens, and closing folds it back into the same card.
//
// Chosen by the product owner for moments, sessions and to-dos, over a slide
// (which says "somewhere else") and a plain fade (which says nothing about where
// the page came from). The point is that the patient never loses their place.
//
// How it works: a frame with the page's colour starts exactly over the card and
// animates its box to the sheet's or page's box, clipping. The content is laid
// out ONCE at its final size and slides inside the frame the opposite way, so it
// never stretches; it fades in once the frame is most of the way there. All of it
// runs on the UI thread.
//
// The card's box is measured by the screen that opened it (rememberGrowOrigin)
// and picked up by the one that opens (takeGrowOrigin). A route that is opened
// some other way, a link or a notification, has no card to come from and simply
// rises into place.

export type GrowRect = { x: number; y: number; width: number; height: number; radius: number };

const DURATION = 380;
const EASE = Easing.bezier(0.22, 1, 0.36, 1);
/** Folding back starts gently rather than snapping away from the page. */
const EASE_BACK = Easing.bezier(0.4, 0, 0.2, 1);
/** How long a measured card stays claimable. Long enough for a route to mount. */
const ORIGIN_TTL = 2000;

let pending: { rect: GrowRect; at: number } | null = null;

/** Measure the tapped card, then open. Opens anyway if it cannot be measured. */
export function rememberGrowOrigin(ref: RefObject<View | null>, radius: number, open: () => void) {
  const node = ref.current;
  if (!node?.measureInWindow) { pending = null; open(); return; }
  node.measureInWindow((x, y, width, height) => {
    pending = width > 0 && height > 0 ? { rect: { x, y, width, height, radius }, at: Date.now() } : null;
    open();
  });
}

/** The card this screen is growing from, once. */
export function takeGrowOrigin(): GrowRect | null {
  const p = pending;
  pending = null;
  return p && Date.now() - p.at < ORIGIN_TTL ? p.rect : null;
}

export type GrowHandle = { close: (done: () => void) => void };

/** Fold the page back into its card, then run `done`. Outside a frame, just `done`. */
const FoldContext = createContext<(done: () => void) => void>((done) => done());
export const useGrowFold = () => useContext(FoldContext);

type Props = {
  origin: GrowRect | null;
  /** A page fills the screen; a sheet sits at the bottom at its own height. */
  kind: 'page' | 'sheet';
  /** The sheet's or page's own colour, shown while the content fades in. */
  color: string;
  /** Behind a sheet. Tapping it calls onScrimPress. */
  scrim?: string;
  onScrimPress?: () => void;
  children: ReactNode;
};

export const GrowFrame = forwardRef<GrowHandle, Props>(function GrowFrame({ origin, kind, color, scrim, onScrimPress, children }, ref) {
  const { width: W, height: H } = useWindowDimensions();
  const reduceMotion = useReduceMotion();
  // A page's box is the screen. A sheet's is only known once it has laid out.
  const [sheetH, setSheetH] = useState<number | null>(null);
  const target: GrowRect | null = kind === 'page' ? { x: 0, y: 0, width: W, height: H, radius: 0 } : sheetH === null ? null : { x: 0, y: H - sheetH, width: W, height: sheetH, radius: 28 };
  // No card to come from: rise into place from a little below instead.
  const from: GrowRect | null = target ? origin ?? { ...target, y: target.y + 28 } : null;

  const p = useSharedValue(0);
  const ready = useSharedValue(0);
  const fromCard = useSharedValue(origin ? 1 : 0);
  const started = useRef(false);
  const fx = useSharedValue(0), fy = useSharedValue(0), fw = useSharedValue(0), fh = useSharedValue(0), fr = useSharedValue(0);
  const tx = useSharedValue(0), ty = useSharedValue(0), tw = useSharedValue(W), th = useSharedValue(H), tr = useSharedValue(0);

  useEffect(() => {
    if (!target || !from) return;
    if (started.current) {
      // The content changed height after opening (a share state, a picture that
      // loaded): the sheet follows it rather than clipping it.
      ty.value = target.y; th.value = target.height; tw.value = target.width;
      return;
    }
    started.current = true;
    fx.value = from.x; fy.value = from.y; fw.value = from.width; fh.value = from.height; fr.value = from.radius;
    tx.value = target.x; ty.value = target.y; tw.value = target.width; th.value = target.height; tr.value = target.radius;
    fromCard.value = origin ? 1 : 0;
    ready.value = 1;
    p.value = reduceMotion ? 1 : withTiming(1, { duration: DURATION, easing: EASE });
  });

  const fold = useCallback((done: () => void) => {
    if (reduceMotion || !started.current) { done(); return; }
    p.value = withTiming(0, { duration: DURATION - 40, easing: EASE_BACK }, (finished) => {
      if (finished) scheduleOnRN(done);
    });
  }, [p, reduceMotion]);
  const handle = useMemo(() => ({ close: fold }), [fold]);
  useImperativeHandle(ref, () => handle, [handle]);

  const frame = useAnimatedStyle(() => {
    const v = p.value;
    return {
      left: fx.value + (tx.value - fx.value) * v,
      top: fy.value + (ty.value - fy.value) * v,
      width: fw.value + (tw.value - fw.value) * v,
      height: fh.value + (th.value - fh.value) * v,
      // A sheet's bottom corners meet the screen edge; a card's are round.
      borderTopLeftRadius: fr.value + (tr.value - fr.value) * v,
      borderTopRightRadius: fr.value + (tr.value - fr.value) * v,
      borderBottomLeftRadius: fr.value * (1 - v),
      borderBottomRightRadius: fr.value * (1 - v),
      // Invisible at the card itself: folded back, the frame would otherwise sit
      // over the card as a blank shape until the screen has gone.
      opacity: ready.value === 0 ? 0 : fromCard.value ? interpolate(v, [0, 0.08], [0, 1], 'clamp') : interpolate(v, [0, 0.6], [0, 1], 'clamp'),
    };
  });
  // The content stays where it will end up; only the frame around it moves.
  const content = useAnimatedStyle(() => {
    const v = p.value;
    return {
      left: tx.value - (fx.value + (tx.value - fx.value) * v),
      top: ty.value - (fy.value + (ty.value - fy.value) * v),
      opacity: fromCard.value ? interpolate(v, [0.3, 0.85], [0, 1], 'clamp') : 1,
    };
  });
  const scrimStyle = useAnimatedStyle(() => ({ opacity: p.value }));

  // A sheet is as tall as what is in it, measured from its layout. The content
  // is one tree from the first render, so nothing in it mounts twice.
  const measure = useCallback((e: LayoutChangeEvent) => {
    const h = Math.round(e.nativeEvent.layout.height);
    if (kind === 'sheet' && h > 0 && h !== sheetH) setSheetH(h);
  }, [kind, sheetH]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {scrim ? (
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: scrim }, scrimStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onScrimPress} accessible={false} />
        </Animated.View>
      ) : null}
      <Animated.View style={[{ position: 'absolute', overflow: 'hidden', backgroundColor: color }, frame]}>
        <Animated.View onLayout={measure} style={[{ position: 'absolute', width: W, height: kind === 'page' ? H : undefined }, content]}>
          <FoldContext.Provider value={fold}>{children}</FoldContext.Provider>
        </Animated.View>
      </Animated.View>
    </View>
  );
});

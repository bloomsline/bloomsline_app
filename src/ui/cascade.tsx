import { useEffect, type ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming } from 'react-native-reanimated';
import { useReduceMotion } from '@/src/ui/app-tabs';

// The GENTLE CASCADE between tabs (chosen by the product owner over a still
// dissolve, a "breathe" and pages that follow the highlight): the page arrives,
// and its sections settle in one after another from the top, as if it were
// welcoming you rather than being swapped in.
//
// It plays only when a TAB is tapped. Coming back from a page opened on top of a
// tab, or the app opening on one, shows the tab as it was: a cascade there would
// be the page performing for someone who never left it.

const listeners = new Map<string, Set<() => void>>();

/** A tab bar press is taking the patient to `route`: play its cascade. */
export function playTabEntrance(route: string) {
  listeners.get(route)?.forEach((play) => play());
}

const EASE = Easing.bezier(0.22, 1, 0.36, 1);
const FIRST = 40;
const STEP = 55;
const DURATION = 420;
const RISE = 14;

/** One section of a tab. `index` is its place from the top. */
export function Cascade({ route, index, style, children }: { route: string; index: number; style?: StyleProp<ViewStyle>; children: ReactNode }) {
  const v = useSharedValue(1);
  const reduceMotion = useReduceMotion();

  useEffect(() => {
    if (reduceMotion) return;
    const play = () => {
      v.value = withSequence(withTiming(0, { duration: 0 }), withDelay(FIRST + index * STEP, withTiming(1, { duration: DURATION, easing: EASE })));
    };
    const set = listeners.get(route) ?? new Set();
    set.add(play);
    listeners.set(route, set);
    return () => { set.delete(play); };
  }, [route, index, reduceMotion, v]);

  const animated = useAnimatedStyle(() => ({ opacity: v.value, transform: [{ translateY: (1 - v.value) * RISE }] }));
  return <Animated.View style={[style, animated]}>{children}</Animated.View>;
}

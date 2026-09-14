import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import type { BottomTabBarProps, BottomTabNavigationOptions } from '@react-navigation/bottom-tabs';
import { TabBar, TAB_DURATION, TAB_EASING, type TabId } from '@/src/ui/TabBar';

// The patient app's tab switching: the gentle drift, the gliding bar, and Reduce
// Motion. Shared by app/(app)/(tabs)/_layout.tsx; kept out of the route file so
// it can be exercised on its own.

export const ROUTE_TAB: Record<string, TabId> = { home: 'care', moments: 'moments', 'for-you': 'foryou' };
export const TAB_ROUTE: Record<TabId, string> = { care: 'home', moments: 'moments', foryou: 'for-you' };

/** How far the page drifts, in px. Enough to say which way; not enough to travel. */
const DRIFT = 16;

export const gentleDrift: BottomTabNavigationOptions['sceneStyleInterpolator'] = ({ current }) => ({
  sceneStyle: {
    // `progress` is -1 for a tab before the active one, 0 for the active one and
    // 1 for a tab after it, so a tab to the right drifts in from the right.
    opacity: current.progress.interpolate({ inputRange: [-1, 0, 1], outputRange: [0, 1, 0] }),
    transform: [{ translateX: current.progress.interpolate({ inputRange: [-1, 0, 1], outputRange: [-DRIFT, 0, DRIFT] }) }],
  },
});

/** The phone's Reduce Motion setting, live. */
export function useReduceMotion(): boolean {
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((v) => { if (alive) setReduceMotion(v); });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => { alive = false; sub.remove(); };
  }, []);
  return reduceMotion;
}

/** Options for every tab: the drift on a soft ease-out, or nothing under Reduce Motion. */
export function tabScreenOptions(reduceMotion: boolean, pageColor: string): BottomTabNavigationOptions {
  return {
    headerShown: false,
    // The page colour behind a fading scene, so the drift never shows white.
    sceneStyle: { backgroundColor: pageColor },
    ...(reduceMotion
      ? { animation: 'none' as const }
      : { transitionSpec: { animation: 'timing' as const, config: { duration: TAB_DURATION, easing: TAB_EASING } }, sceneStyleInterpolator: gentleDrift }),
  };
}

export function AppTabBar({ state, navigation, reduceMotion }: BottomTabBarProps & { reduceMotion: boolean }) {
  const route = state.routes[state.index];
  const active = ROUTE_TAB[route?.name ?? 'home'] ?? 'care';
  return (
    <TabBar
      active={active}
      reduceMotion={reduceMotion}
      onSelect={(id) => {
        const name = TAB_ROUTE[id];
        const target = state.routes.find((r) => r.name === name);
        if (!target) return;
        // As the default tab bar does: a listener may cancel the press.
        const event = navigation.emit({ type: 'tabPress', target: target.key, canPreventDefault: true });
        if (!event.defaultPrevented) navigation.navigate(name);
      }}
    />
  );
}

import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import type { BottomTabBarProps, BottomTabNavigationOptions } from '@react-navigation/bottom-tabs';
import { TabBar, TAB_DURATION, TAB_EASING, type TabId } from '@/src/ui/TabBar';
import { playTabEntrance } from '@/src/ui/cascade';

// The patient app's tab switching: the gentle cascade, the gliding bar, and Reduce
// Motion. Shared by app/(app)/(tabs)/_layout.tsx; kept out of the route file so
// it can be exercised on its own.

export const ROUTE_TAB: Record<string, TabId> = { home: 'care', moments: 'moments', 'for-you': 'foryou' };
export const TAB_ROUTE: Record<TabId, string> = { care: 'home', moments: 'moments', foryou: 'for-you' };

/**
 * The page change behind the gentle cascade (ui/cascade): no movement at all.
 *
 * `progress` is 0 for the active tab and runs to 1 or -1 for the one leaving.
 * The arriving page is opaque by 60% of the way in and sits above the leaving
 * one, so its page colour covers the old page early and its sections then settle
 * in on their own. Nothing slides, so nothing uncovers the edges of the screen.
 *
 * It replaces the GENTLE DRIFT (a fade while moving 16px), which showed a strip
 * of whatever was behind the tabs down both edges in dark mode.
 */
export const gentleCascade: BottomTabNavigationOptions['sceneStyleInterpolator'] = ({ current }) => ({
  sceneStyle: {
    opacity: current.progress.interpolate({ inputRange: [-1, -0.6, 0, 0.6, 1], outputRange: [0, 1, 1, 1, 0] }),
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

/** Options for every tab: the cascade's page change, or nothing under Reduce Motion. */
export function tabScreenOptions(reduceMotion: boolean, pageColor: string): BottomTabNavigationOptions {
  return {
    headerShown: false,
    // The page colour behind a fading scene, so the drift never shows white.
    sceneStyle: { backgroundColor: pageColor },
    ...(reduceMotion
      ? { animation: 'none' as const }
      : { transitionSpec: { animation: 'timing' as const, config: { duration: TAB_DURATION, easing: TAB_EASING } }, sceneStyleInterpolator: gentleCascade }),
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
        if (event.defaultPrevented) return;
        if (target.key !== route?.key) playTabEntrance(name);
        navigation.navigate(name);
      }}
    />
  );
}

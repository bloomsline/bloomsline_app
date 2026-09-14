import { Tabs } from 'expo-router';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import type { TabId } from '@/src/ui/TabBar';
import { AppTabBar, TAB_ROUTE, tabScreenOptions, useReduceMotion } from '@/src/ui/app-tabs';
import { useLanding } from '@/src/prefs/app-prefs';
import { useTheme } from '@/src/ui/theme-mode';

// The three tabs, as TABS.
//
// They were three screens in one stack, and switching between them pushed a new
// screen: the whole page slid in sideways like opening something new, the tab
// bar slid away with it, and a tab reloaded every time it was come back to.
// Moving between My Care, Moments and Activities is not going deeper into the
// app, and it should not look like it.
//
// As tabs, the bar stays where it is and only its highlight glides; each tab
// stays mounted, so Moments keeps its place in the line; and the change itself
// is a GENTLE DRIFT (chosen by the product owner from five tried side by side):
// the new page fades in while moving 16px toward the tab tapped, the old one
// fades out moving away, on a soft ease-out. It runs on the native driver.
//
// The URLs are unchanged: a group does not add a path segment, so /home,
// /moments and /for-you still open these screens from links and bookmarks.

export default function TabsLayout() {
  const { t: TT } = useTheme();
  const { landing } = useLanding();
  // Reduce Motion on the phone turns the drift and the glide off.
  const reduceMotion = useReduceMotion();

  // In the bar's order, which follows the home tab the patient chose, so that
  // "the tab to the right" means the same thing to the drift as it does on screen.
  const order: TabId[] = landing === 'moments' ? ['moments', 'care', 'foryou'] : ['care', 'moments', 'foryou'];

  return (
    <Tabs
      tabBar={(props: BottomTabBarProps) => <AppTabBar {...props} reduceMotion={reduceMotion} />}
      screenOptions={tabScreenOptions(reduceMotion, TT.bg)}
    >
      {order.map((id) => <Tabs.Screen key={id} name={TAB_ROUTE[id]} />)}
    </Tabs>
  );
}

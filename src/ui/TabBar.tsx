import { Platform, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useLanding } from '@/src/prefs/landing';
import { useI18n } from '@/src/i18n';
import { useTheme } from '@/src/ui/theme-mode';

export type TabId = 'care' | 'moments' | 'foryou';

const TAB_LABEL: Record<TabId, 'care' | 'moments' | 'forYou'> = { care: 'care', moments: 'moments', foryou: 'forYou' };

const TABS: Record<TabId, { id: TabId; href: string }> = {
  care: { id: 'care', href: '/home' },
  moments: { id: 'moments', href: '/moments' },
  foryou: { id: 'foryou', href: '/for-you' },
};

// The tab bar. ONE shape everywhere.
//
// There were two: a v1 floating white pill with icons and a capture FAB, and
// the v2 pill of plain labels the rebuilt tabs draw. Only the Care tab's solo
// state still asked for the v1 one, so the chrome changed shape depending on
// whether you had a practitioner yet — which is exactly where a patient is
// least sure the app is working. The v1 variant is gone.
//
// Colours come from the theme, so this reads correctly on the light solo
// screen and on the dark rebuilt tabs without a variant. Capture is reached
// from the dashed "today" node at the foot of the line, which sits where the
// new moment will land; the corner + was a second door to the same room.
export function TabBar({ active }: { active: TabId }) {
  const { t: TT } = useTheme();
  const router = useRouter();
  const { landing } = useLanding();
  const { t } = useI18n();
  const order: TabId[] = landing === 'moments' ? ['moments', 'care', 'foryou'] : ['care', 'moments', 'foryou'];

  return (
    <View className="absolute inset-x-6 bottom-8 flex-row items-center justify-center">
      {/* A pill, not bare labels. Bare text has no ground of its own, so the
          page scrolls UNDERNEATH it — the day heading collided with the tab
          row. The container gives the bar a surface; the active tab gets its
          own inner pill so selection reads without relying on weight alone.
          It HUGS its labels — no flex-1. Stretching it to the full width left
          a dead third after "For You" and pushed its edge into the + button;
          the row is justify-between instead, so the pill ends where the words
          do and the + stays at the margin. */}
      <View
        className="flex-row items-center self-start rounded-full p-1"
        style={{ backgroundColor: TT.floating, borderWidth: 1, borderColor: TT.cardLine }}
      >
        {order.map((id) => TABS[id]).map((tab) => {
          const on = tab.id === active;
          return (
            <Pressable
              key={tab.id}
              disabled={on}
              onPress={() => router.navigate(tab.href as never)}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              className="rounded-full px-3.5 py-1.5"
              style={on ? { backgroundColor: TT.bg } : undefined}
            >
              <Text style={{ fontSize: 13.5, fontWeight: on ? '700' : '500', color: on ? TT.ink : TT.faint }}>
                {t.tabs[TAB_LABEL[tab.id]]}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {/* No capture button here. The dashed "today" node at the foot of the
          line already opens capture, and it is the better target: it sits
          exactly where the new moment will land, so the gesture and its
          result are in the same place. A + in the corner was a second door
          to the same room, and it pushed the tab pill off centre. */}
    </View>
  );
}

// Web keeps a persistent bottom padding so the floating bar never covers content.
export const TAB_BAR_SPACER = Platform.OS === 'web' ? 'pb-36' : 'pb-32';

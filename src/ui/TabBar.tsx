import { Platform, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { User, Heart, HandHeart, Plus, type LucideIcon } from 'lucide-react-native';
import { useLanding } from '@/src/prefs/landing';
import { useI18n } from '@/src/i18n';

export type TabId = 'care' | 'moments' | 'foryou';

const TAB_LABEL: Record<TabId, 'care' | 'moments' | 'forYou'> = { care: 'care', moments: 'moments', foryou: 'forYou' };

const TABS: Record<TabId, { id: TabId; Icon: LucideIcon; href: string }> = {
  care: { id: 'care', Icon: User, href: '/home' },
  moments: { id: 'moments', Icon: Heart, href: '/moments' },
  foryou: { id: 'foryou', Icon: HandHeart, href: '/for-you' },
};

// Floating pill tab bar + capture FAB (v1 style). Shared across the app tabs.
// The FAB opens the capture flow; "For You" is not built yet (kept inert).
// The landing (home) tab is shown first, so toggling it in Settings reorders
// the bar too; "For You" always trails.
export function TabBar({ active }: { active: TabId }) {
  const router = useRouter();
  const { landing } = useLanding();
  const { t } = useI18n();
  const order: TabId[] = landing === 'moments' ? ['moments', 'care', 'foryou'] : ['care', 'moments', 'foryou'];
  return (
    <View className="absolute inset-x-6 bottom-8 flex-row items-center gap-3">
      <View
        className="flex-1 flex-row justify-around rounded-[40px] px-4 py-3"
        style={{ backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#EAE8E2', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 20, shadowOffset: { width: 0, height: 6 }, elevation: 8 }}
      >
        {order.map((id) => TABS[id]).map((tab) => {
          const on = tab.id === active;
          return (
            <Pressable
              key={tab.id}
              className="items-center"
              disabled={on}
              onPress={() => router.navigate(tab.href as never)}
            >
              <View className="h-[46px] w-[46px] items-center justify-center rounded-full" style={on ? { backgroundColor: '#128069' } : { borderWidth: 1, borderColor: '#EAE8E2', backgroundColor: '#F6F5F2' }}>
                <tab.Icon size={20} color={on ? '#fff' : '#9A9A90'} strokeWidth={on ? 2 : 1.6} />
              </View>
              <Text className="mt-1 text-[11px]" style={{ fontWeight: on ? '700' : '400', color: on ? '#128069' : '#9A9A90' }}>{t.tabs[TAB_LABEL[tab.id]]}</Text>
            </Pressable>
          );
        })}
      </View>
      <Pressable
        accessibilityLabel="Capture a moment"
        className="h-[54px] w-[54px] items-center justify-center rounded-[27px]"
        style={{ backgroundColor: '#141414', shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: { width: 0, height: 4 }, elevation: 6 }}
        onPress={() => router.navigate('/capture' as never)}
      >
        <Plus size={24} color="#fff" strokeWidth={2.4} />
      </Pressable>
    </View>
  );
}

// Web keeps a persistent bottom padding so the floating bar never covers content.
export const TAB_BAR_SPACER = Platform.OS === 'web' ? 'pb-36' : 'pb-32';

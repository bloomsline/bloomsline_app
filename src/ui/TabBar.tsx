import { Platform, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { User, Heart, HandHeart, Plus, type LucideIcon } from 'lucide-react-native';

export type TabId = 'care' | 'moments' | 'foryou';

const TABS: { id: TabId; label: string; Icon: LucideIcon; href: string }[] = [
  { id: 'care', label: 'My Care', Icon: User, href: '/home' },
  { id: 'moments', label: 'Moments', Icon: Heart, href: '/moments' },
  { id: 'foryou', label: 'For You', Icon: HandHeart, href: '/for-you' },
];

// Floating pill tab bar + capture FAB (v1 style). Shared across the app tabs.
// The FAB opens the capture flow; "For You" is not built yet (kept inert).
export function TabBar({ active }: { active: TabId }) {
  const router = useRouter();
  return (
    <View className="absolute inset-x-6 bottom-8 flex-row items-center gap-3">
      <View
        className="flex-1 flex-row justify-around rounded-[40px] border border-line bg-white px-4 py-3"
        style={{ shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 20, shadowOffset: { width: 0, height: 6 }, elevation: 8 }}
      >
        {TABS.map((t) => {
          const on = t.id === active;
          return (
            <Pressable
              key={t.id}
              className="items-center"
              disabled={on}
              onPress={() => router.navigate(t.href as never)}
            >
              <View className={`h-[46px] w-[46px] items-center justify-center rounded-full ${on ? 'bg-brand' : 'border border-[#E5E5E3] bg-white'}`}>
                <t.Icon size={20} color={on ? '#fff' : '#999999'} strokeWidth={on ? 2 : 1.6} />
              </View>
              <Text className={`mt-1 text-[11px] ${on ? 'font-bold text-brand' : 'text-muted-dark'}`}>{t.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <Pressable
        accessibilityLabel="Capture a moment"
        className="h-[54px] w-[54px] items-center justify-center rounded-[27px] bg-ink"
        style={{ shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: { width: 0, height: 4 }, elevation: 6 }}
        onPress={() => router.navigate('/capture' as never)}
      >
        <Plus size={24} color="#fff" strokeWidth={2.4} />
      </Pressable>
    </View>
  );
}

// Web keeps a persistent bottom padding so the floating bar never covers content.
export const TAB_BAR_SPACER = Platform.OS === 'web' ? 'pb-36' : 'pb-32';

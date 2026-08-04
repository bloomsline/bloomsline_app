import { Platform, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { LayoutGrid, Users, CalendarDays, PenLine, type LucideIcon } from 'lucide-react-native';
import { useI18n } from '@/src/i18n';

// The practitioner's tab bar, deliberately the SAME shape as the patient one
// (src/ui/TabBar): floating pill, three tabs, and an action button beside it.
// One app, one design language — and a practitioner who has seen the patient
// side already knows how this works.
//
// The FAB is "take a note" rather than "capture a moment", which is the right
// parallel: it is the thing you do in the five minutes after a session, and the
// reason to reach for a phone instead of a laptop.
export type PractitionerTabId = 'dashboard' | 'people' | 'bookings';

const TABS: Record<PractitionerTabId, { id: PractitionerTabId; Icon: LucideIcon; href: string; label: { en: string; fr: string } }> = {
  dashboard: { id: 'dashboard', Icon: LayoutGrid, href: '/(practitioner)/home', label: { en: 'Today', fr: 'Aujourd’hui' } },
  people: { id: 'people', Icon: Users, href: '/(practitioner)/people', label: { en: 'People', fr: 'Patients' } },
  bookings: { id: 'bookings', Icon: CalendarDays, href: '/(practitioner)/bookings', label: { en: 'Bookings', fr: 'Agenda' } },
};

const ORDER: PractitionerTabId[] = ['dashboard', 'people', 'bookings'];

export function PractitionerTabBar({ active }: { active: PractitionerTabId }) {
  const router = useRouter();
  const { locale } = useI18n();

  return (
    <View className="absolute inset-x-6 bottom-8 flex-row items-center gap-3">
      <View
        className="flex-1 flex-row justify-around rounded-[40px] px-4 py-3"
        style={{ backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#EAE8E2', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 20, shadowOffset: { width: 0, height: 6 }, elevation: 8 }}
      >
        {ORDER.map((id) => TABS[id]).map((tab) => {
          const on = tab.id === active;
          return (
            <Pressable key={tab.id} className="items-center" disabled={on} onPress={() => router.navigate(tab.href as never)}>
              <View
                className="h-[46px] w-[46px] items-center justify-center rounded-full"
                style={on ? { backgroundColor: '#128069' } : { borderWidth: 1, borderColor: '#EAE8E2', backgroundColor: '#F6F5F2' }}
              >
                <tab.Icon size={20} color={on ? '#fff' : '#9A9A90'} strokeWidth={on ? 2 : 1.6} />
              </View>
              <Text className="mt-1 text-[11px]" style={{ fontWeight: on ? '700' : '400', color: on ? '#128069' : '#9A9A90' }}>
                {tab.label[locale === 'fr' ? 'fr' : 'en']}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Pressable
        accessibilityLabel={locale === 'fr' ? 'Prendre une note' : 'Take a note'}
        className="h-[54px] w-[54px] items-center justify-center rounded-[27px]"
        style={{ backgroundColor: '#141414', shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: { width: 0, height: 4 }, elevation: 6 }}
        onPress={() => router.navigate('/(practitioner)/note' as never)}
      >
        <PenLine size={22} color="#fff" strokeWidth={2.2} />
      </Pressable>
    </View>
  );
}

// Matches the patient app: the floating bar must never cover content.
export const PRACTITIONER_TAB_SPACER = Platform.OS === 'web' ? 'pb-36' : 'pb-32';

import { Platform, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { LayoutGrid, Users, CalendarDays, Library, PenLine, type LucideIcon } from 'lucide-react-native';
import { EDA } from '@/src/ui/editorial';
import { useI18n } from '@/src/i18n';

// The practitioner's tab bar. Same object as the patient's (src/ui/TabBar):
// floating pill, an action button beside it, identical geometry and colours —
// one app, one navigation language. Only the destinations differ.
//
// The action button takes a note, which is the practitioner's equivalent of the
// patient capturing a moment: the thing you do in the five minutes after a
// session, and the reason to reach for a phone instead of a laptop.
export type PractitionerTabId = 'dashboard' | 'people' | 'bookings' | 'resources';

const TABS: Record<PractitionerTabId, { Icon: LucideIcon; href: string; en: string; fr: string }> = {
  dashboard: { Icon: LayoutGrid, href: '/(practitioner)/home', en: 'Today', fr: 'Aujourd’hui' },
  people: { Icon: Users, href: '/(practitioner)/people', en: 'People', fr: 'Patients' },
  bookings: { Icon: CalendarDays, href: '/(practitioner)/bookings', en: 'Agenda', fr: 'Agenda' },
  resources: { Icon: Library, href: '/(practitioner)/resources', en: 'Library', fr: 'Ressources' },
};

const ORDER: PractitionerTabId[] = ['dashboard', 'people', 'bookings', 'resources'];

export function PractitionerTabBar({ active }: { active: PractitionerTabId }) {
  const router = useRouter();
  const { locale } = useI18n();
  const fr = locale === 'fr';

  return (
    <View style={{ position: 'absolute', left: 22, right: 22, bottom: 30, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View
        style={{
          flex: 1, flexDirection: 'row', justifyContent: 'space-around', borderRadius: 40, paddingHorizontal: 10, paddingVertical: 12,
          backgroundColor: EDA.card, borderWidth: 1, borderColor: EDA.line,
          shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 20, shadowOffset: { width: 0, height: 6 }, elevation: 8,
        }}
      >
        {ORDER.map((id) => {
          const tab = TABS[id];
          const on = id === active;
          return (
            <Pressable key={id} style={{ alignItems: 'center' }} disabled={on} onPress={() => router.navigate(tab.href as never)}>
              <View
                style={{
                  height: 42, width: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center',
                  ...(on ? { backgroundColor: EDA.green } : { borderWidth: 1, borderColor: EDA.line, backgroundColor: EDA.canvas }),
                }}
              >
                <tab.Icon size={19} color={on ? '#fff' : EDA.faint} strokeWidth={on ? 2 : 1.6} />
              </View>
              <Text style={{ marginTop: 4, fontSize: 10.5, fontWeight: on ? '700' : '400', color: on ? EDA.green : EDA.faint }}>
                {fr ? tab.fr : tab.en}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Pressable
        accessibilityLabel={fr ? 'Prendre une note' : 'Take a note'}
        style={{
          height: 54, width: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', backgroundColor: EDA.slot,
          shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: { width: 0, height: 4 }, elevation: 6,
        }}
        onPress={() => router.navigate('/(practitioner)/note' as never)}
      >
        <PenLine size={22} color="#fff" strokeWidth={2.2} />
      </Pressable>
    </View>
  );
}

// The floating bar must never cover content — same rule as the patient app.
export const PRACTITIONER_TAB_PAD = Platform.OS === 'web' ? 150 : 130;

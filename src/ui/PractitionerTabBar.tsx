import { Platform, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { LayoutGrid, Users, CalendarDays, Library, type LucideIcon } from 'lucide-react-native';
import { useI18n } from '@/src/i18n';
import { useTheme } from '@/src/ui/theme-mode';

// The practitioner's tab bar: a floating pill of four destinations.
//
// There was a note FAB beside it. It went because a note belongs to a SESSION,
// and a button floating over every screen cannot know which one — so it opened
// a picker, which is a worse start than tapping the session you were already
// looking at. Taking a note is reachable from the session sheet, from Your day,
// and from the patient's own sessions; none of those has to guess.
export type PractitionerTabId = 'home' | 'calendar' | 'people' | 'resources';

// One day, one tab. "Today" and "Agenda" were two doors onto the same
// information, which is the same duplication v1's ten tiles had.
const TABS: Record<PractitionerTabId, { Icon: LucideIcon; href: string; en: string; fr: string }> = {
  home: { Icon: LayoutGrid, href: '/(practitioner)/home', en: 'Today', fr: 'Aujourd’hui' },
  calendar: { Icon: CalendarDays, href: '/(practitioner)/calendar', en: 'Calendar', fr: 'Agenda' },
  people: { Icon: Users, href: '/(practitioner)/people', en: 'People', fr: 'Patients' },
  resources: { Icon: Library, href: '/(practitioner)/resources', en: 'Library', fr: 'Ressources' },
};

const ORDER: PractitionerTabId[] = ['home', 'calendar', 'people', 'resources'];

export function PractitionerTabBar({ active }: { active: PractitionerTabId }) {
  const { t: TT } = useTheme();
  const router = useRouter();
  const { locale } = useI18n();
  const fr = locale === 'fr';

  return (
    <View style={{ position: 'absolute', left: 22, right: 22, bottom: 30, flexDirection: 'row', alignItems: 'center' }}>
      <View
        style={{
          flex: 1, flexDirection: 'row', justifyContent: 'space-around', borderRadius: 40, paddingHorizontal: 10, paddingVertical: 12,
          backgroundColor: TT.card, borderWidth: 1, borderColor: TT.line,
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
                  ...(on ? { backgroundColor: TT.accent } : { borderWidth: 1, borderColor: TT.line, backgroundColor: TT.bg }),
                }}
              >
                <tab.Icon size={19} color={on ? '#fff' : TT.faint} strokeWidth={on ? 2 : 1.6} />
              </View>
              <Text style={{ marginTop: 4, fontSize: 10.5, fontWeight: on ? '700' : '400', color: on ? TT.accent : TT.faint }}>
                {fr ? tab.fr : tab.en}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// The floating bar must never cover content — same rule as the patient app.
export const PRACTITIONER_TAB_PAD = Platform.OS === 'web' ? 150 : 130;

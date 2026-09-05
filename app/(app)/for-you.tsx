// For You — v2. The same two doors as before (the journal, and practices that
// are always open and never assigned), rebuilt on the dark ground so the three
// tabs a patient lives in look like one app.
//
// Content is deliberately unchanged: this screen is not on the design board, so
// restyling it is a faithful move and redesigning it would be an invented one.
import { useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { PenLine, Sprout, ChevronRight, type LucideIcon } from 'lucide-react-native';
import { TabBar } from '@/src/ui/TabBar';
import { TabIntro } from '@/src/ui/TabIntro';
import { FadeIn, HEADER_TOP } from '@/src/ui/editorial';
import { Ground } from '@/src/ui/Ground';
import { useI18n } from '@/src/i18n';
import { ProfileButton } from '@/src/profile/ProfileButton';
import { useTheme } from '@/src/ui/theme-mode';

const T = {
  en: {
    title: 'Activities',
    subtitle: 'Feel-good activities, whenever you want them.',
    journal: 'Journal',
    journalDesc: 'A space to put words to your thoughts and see them more clearly.',
    openJournal: 'Open journal',
    activities: 'My guides',
    activitiesDesc: 'Practices to do whenever you like, take what helps.',
    browse: 'Browse activities',
  },
  fr: {
    title: 'Activités',
    subtitle: 'Des activités qui font du bien, disponibles à tout moment.',
    journal: 'Journal',
    journalDesc: 'Un espace pour mettre des mots sur vos pensées et y voir plus clair.',
    openJournal: 'Ouvrir le journal',
    activities: 'Mes repères',
    activitiesDesc: 'Des pratiques à faire quand vous le souhaitez, prenez ce qui vous aide.',
    browse: 'Voir les activités',
  },
} as const;

export default function ForYou() {
  const { t: TT } = useTheme();
  const router = useRouter();
  const { locale } = useI18n();
  const tr = T[locale];
  const [introActive, setIntroActive] = useState(false);

  return (
    <Ground>
      <StatusBar style="light" />
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <View style={{ paddingHorizontal: 22, paddingTop: HEADER_TOP, paddingBottom: 18, flexDirection: 'row', alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 27, fontWeight: '800', color: TT.ink, letterSpacing: -0.9, lineHeight: 31 }}>{tr.title}</Text>
            <Text style={{ marginTop: 8, fontSize: 14, color: TT.inkSoft, lineHeight: 21 }}>{tr.subtitle}</Text>
          </View>
          <ProfileButton />
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 170 }} showsVerticalScrollIndicator={false}>
          <View style={{ paddingHorizontal: 22 }}>
            <TabIntro tabKey="foryou" tone="dark" onActiveChange={setIntroActive} />
          </View>

          {/* The intro is an inline card, not a modal, so it must never take the
              content away. It used to set pointerEvents 'none' here: on a first
              visit both doors were dead until "Got it" was tapped, and nothing
              on screen said so — taps just did nothing. Dim to draw the eye to
              the intro; stay tappable. */}
          <FadeIn style={{ paddingHorizontal: 22, opacity: introActive ? 0.55 : 1 }}>
            <View style={{ gap: 12 }}>
              <DoorCard
                Icon={PenLine}
                title={tr.journal}
                body={tr.journalDesc}
                action={tr.openJournal}
                onPress={() => router.navigate('/journal' as never)}
              />
              <DoorCard
                Icon={Sprout}
                title={tr.activities}
                body={tr.activitiesDesc}
                action={tr.browse}
                onPress={() => router.navigate('/library' as never)}
              />
            </View>
          </FadeIn>
        </ScrollView>
      </SafeAreaView>

      <TabBar active="foryou" tone="dark" />
    </Ground>
  );
}

/** One of the two places this tab opens onto. The whole card is the target — a
 *  button inside a tappable card gives two hit areas for one destination. */
function DoorCard({
  Icon, title, body, action, onPress,
}: {
  Icon: LucideIcon;
  title: string;
  body: string;
  action: string;
  onPress: () => void;
}) {
  const { t: TT } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={{ backgroundColor: TT.card, borderWidth: 1, borderColor: TT.cardLine, borderRadius: 20, padding: 20 }}
    >
      <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: 'rgba(127,217,192,0.14)', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
        <Icon size={21} color={TT.accent} strokeWidth={2} />
      </View>
      <Text style={{ fontSize: 18, fontWeight: '800', color: TT.ink, letterSpacing: -0.3, marginBottom: 6 }}>{title}</Text>
      <Text style={{ fontSize: 13.5, color: TT.inkSoft, lineHeight: 21 }}>{body}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 16 }}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: TT.accent }}>{action}</Text>
        <ChevronRight size={16} color={TT.accent} strokeWidth={2.2} />
      </View>
    </TouchableOpacity>
  );
}

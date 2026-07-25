// For You — Flow E "Space for you" landing (screen e0), from the V2 cloud design.
// Two self-guided spaces: a private Journal, and Small activities (the Library of
// practitioner-made practices, always open, never assigned). Hybrid editorial re-skin.
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { PenLine, Sprout, Settings } from 'lucide-react-native';
import { TabBar } from '@/src/ui/TabBar';
import { TabIntro } from '@/src/ui/TabIntro';
import { EDA, EdHeader, EdCard, EdPill, FadeIn } from '@/src/ui/editorial';
import { useI18n } from '@/src/i18n';

const T = {
  en: {
    title: 'Space for you',
    subtitle: 'Take what helps, whenever it suits you.',
    journal: 'Journal',
    journalDesc: 'A private place to write freely. Only you can read this.',
    openJournal: 'Open journal',
    activities: 'Small activities',
    activitiesDesc: 'Short practices made by practitioners, always open, never assigned.',
    browse: 'Browse activities',
  },
  fr: {
    title: 'Un espace pour vous',
    subtitle: 'Prenez ce qui vous fait du bien, quand cela vous convient.',
    journal: 'Journal',
    journalDesc: 'Un espace privé pour écrire librement. Vous seul pouvez le lire.',
    openJournal: 'Ouvrir le journal',
    activities: 'Petites activités',
    activitiesDesc: 'De courtes pratiques créées par les praticiens, toujours accessibles, jamais imposées.',
    browse: 'Voir les activités',
  },
} as const;

export default function ForYou() {
  const router = useRouter();
  const { locale } = useI18n();
  const tr = T[locale];
  const [introActive, setIntroActive] = useState(false);
  const dim = { opacity: introActive ? 0.3 : 1 } as const;
  return (
    <View style={{ flex: 1, backgroundColor: EDA.canvas }}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={{ paddingBottom: 180 }} showsVerticalScrollIndicator={false}>
        <EdHeader kicker="FOR YOU" title={tr.title} subtitle={tr.subtitle} rightIcon={Settings} onRight={() => router.navigate('/settings' as never)} />
        <FadeIn style={{ paddingHorizontal: 22, paddingTop: 20 }}>
          <TabIntro tabKey="foryou" onActiveChange={setIntroActive} />

          <View style={dim} pointerEvents={introActive ? 'none' : 'auto'}>
            {/* Journal */}
            <EdCard style={{ padding: 22, marginBottom: 14 }}>
              <View style={{ width: 52, height: 52, borderRadius: 15, backgroundColor: EDA.greenTint, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <PenLine size={23} color={EDA.green} strokeWidth={2} />
              </View>
              <Text style={{ fontSize: 19, fontWeight: '800', color: EDA.ink, letterSpacing: -0.3, marginBottom: 6 }}>{tr.journal}</Text>
              <Text style={{ fontSize: 13.5, color: EDA.inkSoft, lineHeight: 21, marginBottom: 18 }}>{tr.journalDesc}</Text>
              <EdPill label={tr.openJournal} variant="green" onPress={() => router.navigate('/journal' as never)} />
            </EdCard>

            {/* Small activities */}
            <EdCard style={{ padding: 22 }}>
              <View style={{ width: 52, height: 52, borderRadius: 15, backgroundColor: EDA.greenTint, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <Sprout size={23} color={EDA.green} strokeWidth={2} />
              </View>
              <Text style={{ fontSize: 19, fontWeight: '800', color: EDA.ink, letterSpacing: -0.3, marginBottom: 6 }}>{tr.activities}</Text>
              <Text style={{ fontSize: 13.5, color: EDA.inkSoft, lineHeight: 21, marginBottom: 18 }}>{tr.activitiesDesc}</Text>
              <EdPill label={tr.browse} variant="outline" onPress={() => router.navigate('/library' as never)} />
            </EdCard>
          </View>
        </FadeIn>
      </ScrollView>

      <TabBar active="foryou" />
    </View>
  );
}

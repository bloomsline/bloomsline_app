// e1 — Journal home. Private long-form writing, wired to /api/mobile/journal.
// Hybrid editorial re-skin.
import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect, useRouter } from 'expo-router';
import { Lock, PenLine } from 'lucide-react-native';
import { EDA, EdHeader, EdCard, EdPill, FadeIn, MonoLabel } from '@/src/ui/editorial';
import { ONBOARDING_IMAGES } from '@/src/onboarding/editorial/images';
import { listJournal, type JournalEntry } from '@/src/api/journal';
import { useI18n, type Locale } from '@/src/i18n';

const T = {
  en: {
    title: 'Journal',
    private: 'Private',
    subtitle: 'A quiet place to write freely. Only you can read this.',
    emptyTitle: 'Nothing written yet',
    emptyBody: 'Tap New entry to start. It stays private to you.',
    newEntry: 'New entry',
    untitled: 'Untitled',
    today: 'Today',
    yesterday: 'Yesterday',
  },
  fr: {
    title: 'Journal',
    private: 'Privé',
    subtitle: 'Un endroit calme pour écrire librement. Vous seul pouvez le lire.',
    emptyTitle: 'Rien écrit pour l’instant',
    emptyBody: 'Touchez Nouvelle entrée pour commencer. Elle reste privée.',
    newEntry: 'Nouvelle entrée',
    untitled: 'Sans titre',
    today: 'Aujourd’hui',
    yesterday: 'Hier',
  },
} as const;

export default function Journal() {
  const router = useRouter();
  const { locale } = useI18n();
  const tr = T[locale];
  const [entries, setEntries] = useState<JournalEntry[] | null>(null);
  const back = () => (router.canGoBack() ? router.back() : router.navigate('/for-you' as never));

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      listJournal().then((e) => { if (alive) setEntries(e ?? []); });
      return () => { alive = false; };
    }, []),
  );

  return (
    <View style={{ flex: 1, backgroundColor: EDA.canvas }}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={{ paddingBottom: 180 }} showsVerticalScrollIndicator={false}>
        <EdHeader kicker="JOURNAL" title={tr.title} subtitle={tr.subtitle} source={ONBOARDING_IMAGES.card1} onBack={back} rightIcon={Lock} onRight={back} />
        <FadeIn style={{ paddingHorizontal: 22, paddingTop: 20 }}>
          {/* Private note + compose */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 }}>
            <Lock size={12} color={EDA.faint} strokeWidth={2} />
            <MonoLabel color={EDA.faint}>{tr.private}</MonoLabel>
          </View>

          <EdPill label={tr.newEntry} variant="dark" onPress={() => router.navigate('/journal-entry' as never)} style={{ marginBottom: 22 }} />

          {entries === null ? (
            <View style={{ paddingTop: 24, alignItems: 'center' }}><ActivityIndicator color={EDA.green} /></View>
          ) : entries.length === 0 ? (
            <EdCard style={{ padding: 26, alignItems: 'center' }}>
              <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: EDA.greenTint, alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                <PenLine size={21} color={EDA.green} strokeWidth={2} />
              </View>
              <Text style={{ fontSize: 15, fontWeight: '800', color: EDA.ink }}>{tr.emptyTitle}</Text>
              <Text style={{ fontSize: 13, color: EDA.inkSoft, marginTop: 6, textAlign: 'center', lineHeight: 19 }}>{tr.emptyBody}</Text>
            </EdCard>
          ) : (
            <View style={{ gap: 12 }}>
              {entries.map((e) => (
                <EdCard key={e.id} onPress={() => router.navigate(`/journal-entry?id=${e.id}` as never)} style={{ padding: 18 }}>
                  <MonoLabel color={EDA.faint} size={9.5} style={{ marginBottom: 7 }}>{when(e.updatedAt, locale, tr)}</MonoLabel>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: EDA.ink, letterSpacing: -0.2, marginBottom: e.body ? 6 : 0 }}>{e.title || tr.untitled}</Text>
                  {e.body ? <Text style={{ fontSize: 13.5, color: EDA.inkSoft, lineHeight: 21 }} numberOfLines={2}>{e.body}</Text> : null}
                </EdCard>
              ))}
            </View>
          )}
        </FadeIn>
      </ScrollView>
    </View>
  );
}

function when(iso: string, locale: Locale, tr: { today: string; yesterday: string }): string {
  const d = new Date(iso);
  const now = new Date();
  const sod = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((sod(now) - sod(d)) / 86400000);
  if (days <= 0) return tr.today;
  if (days === 1) return tr.yesterday;
  return d.toLocaleDateString(locale === 'fr' ? 'fr-FR' : undefined, { month: 'short', day: 'numeric' });
}

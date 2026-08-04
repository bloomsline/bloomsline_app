import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TextInput, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect, useRouter } from 'expo-router';
import { ChevronRight, Search, UserPlus } from 'lucide-react-native';
import { EDA, EdHeader, EdCard, FadeIn } from '@/src/ui/editorial';
import { PractitionerTabBar, PRACTITIONER_TAB_PAD } from '@/src/ui/PractitionerTabBar';
import { useI18n } from '@/src/i18n';
import { fetchPatients, type PatientListItem } from '@/src/api/practitioner';

// Find someone, open them, write a note. Names, not records — the clinical
// history stays in the care app.
const T = {
  en: { kicker: 'PEOPLE', title: 'Your patients', search: 'Search by name', empty: 'No patients yet.', none: 'No one matches that.', last: 'Last session' },
  fr: { kicker: 'PATIENTS', title: 'Vos patients', search: 'Rechercher par nom', empty: 'Aucun patient.', none: 'Aucun résultat.', last: 'Dernière séance' },
} as const;

export default function People() {
  const router = useRouter();
  const { locale } = useI18n();
  const tr = T[locale] ?? T.en;
  const [q, setQ] = useState('');
  const [items, setItems] = useState<PatientListItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      void fetchPatients().then((rows) => { if (alive) { setItems(rows ?? []); setLoaded(true); } });
      return () => { alive = false; };
    }, []),
  );

  // Filtering on device: a caseload is not a directory, and it is smaller than
  // the latency of a round trip per keystroke.
  const needle = q.trim().toLowerCase();
  const shown = needle ? items.filter((p) => p.name.toLowerCase().includes(needle)) : items;
  const when = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-GB', { day: 'numeric', month: 'short' }) : null;

  return (
    <View style={{ flex: 1, backgroundColor: EDA.canvas }}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={{ paddingBottom: PRACTITIONER_TAB_PAD }} showsVerticalScrollIndicator={false}>
        <EdHeader kicker={tr.kicker} title={tr.title} rightIcon={UserPlus} onRight={() => router.navigate('/(practitioner)/add-patient' as never)} />

        <FadeIn style={{ paddingHorizontal: 22, paddingTop: 20 }}>
          <EdCard style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14, marginBottom: 16 }}>
            <Search size={16} color={EDA.faint} />
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder={tr.search}
              placeholderTextColor={EDA.faint}
              style={{ flex: 1, fontSize: 15, color: EDA.ink }}
              autoCorrect={false}
            />
          </EdCard>

          {!loaded && <ActivityIndicator />}
          {loaded && shown.length === 0 && (
            <Text style={{ fontSize: 14, color: EDA.inkSoft }}>{items.length === 0 ? tr.empty : tr.none}</Text>
          )}

          {shown.map((p) => (
            <EdCard key={p.id} onPress={() => router.navigate(`/(practitioner)/patient/${p.id}` as never)} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 10 }}>
              <View style={{ height: 42, width: 42, borderRadius: 21, backgroundColor: EDA.greenTint, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 14, fontWeight: '800', color: EDA.green }}>{initials(p.name)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15.5, fontWeight: '700', color: EDA.ink }}>{p.name}</Text>
                {when(p.lastSessionAt) && <Text style={{ fontSize: 12.5, color: EDA.faint, marginTop: 2 }}>{tr.last} · {when(p.lastSessionAt)}</Text>}
              </View>
              <ChevronRight size={16} color={EDA.line} />
            </EdCard>
          ))}
        </FadeIn>
      </ScrollView>

      <PractitionerTabBar active="people" />
    </View>
  );
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '?';
}

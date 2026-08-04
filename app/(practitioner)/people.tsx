import { useCallback, useState } from 'react';
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { ChevronRight, Search } from 'lucide-react-native';
import { Screen } from '@/src/ui/Screen';
import { PractitionerTabBar, PRACTITIONER_TAB_SPACER } from '@/src/ui/PractitionerTabBar';
import { useI18n } from '@/src/i18n';
import { fetchPatients, type PatientListItem } from '@/src/api/practitioner';

// The People tab: find someone, open them, write a note. That is the whole job.
// It shows names, not records — the clinical history stays in the care app.
const T = {
  en: { title: 'People', search: 'Search by name', empty: 'No patients yet.', none: 'No one matches that.', last: 'Last session' },
  fr: { title: 'Patients', search: 'Rechercher par nom', empty: 'Aucun patient.', none: 'Aucun résultat.', last: 'Dernière séance' },
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

  // Filtering on device: the list is a practitioner's own caseload, not a
  // directory, so it is small enough that a round trip per keystroke would be
  // slower than the typing.
  const needle = q.trim().toLowerCase();
  const shown = needle ? items.filter((p) => p.name.toLowerCase().includes(needle)) : items;

  const when = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-GB', { day: 'numeric', month: 'short' }) : null;

  return (
    <Screen bg="bg-surface-soft" scroll className={`px-6 ${PRACTITIONER_TAB_SPACER}`}>
      <Text className="mt-2 text-[26px] font-bold tracking-[-0.6px] text-ink">{tr.title}</Text>

      <View className="mt-4 flex-row items-center gap-2 rounded-2xl bg-white px-4 py-3">
        <Search size={16} color="#9A9A9A" />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder={tr.search}
          placeholderTextColor="#BBB"
          className="flex-1 text-[15px] text-ink"
          autoCorrect={false}
        />
      </View>

      {!loaded && <ActivityIndicator className="mt-10" />}
      {loaded && shown.length === 0 && (
        <Text className="mt-8 text-[14px] text-muted">{items.length === 0 ? tr.empty : tr.none}</Text>
      )}

      {shown.map((p) => (
        <TouchableOpacity
          key={p.id}
          onPress={() => router.navigate(`/(practitioner)/patient/${p.id}` as never)}
          activeOpacity={0.85}
          className="mt-3 flex-row items-center gap-3 rounded-2xl bg-white p-4"
        >
          <View className="h-10 w-10 items-center justify-center rounded-full bg-brand-tint">
            <Text className="text-[14px] font-bold text-brand">{initials(p.name)}</Text>
          </View>
          <View className="flex-1">
            <Text className="text-[15px] font-semibold text-ink">{p.name}</Text>
            {when(p.lastSessionAt) && <Text className="mt-0.5 text-[12.5px] text-muted">{tr.last} · {when(p.lastSessionAt)}</Text>}
          </View>
          <ChevronRight size={16} color="#CCC" />
        </TouchableOpacity>
      ))}

      <PractitionerTabBar active="people" />
    </Screen>
  );
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '?';
}

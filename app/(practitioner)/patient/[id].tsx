import { useCallback, useState } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, PenLine } from 'lucide-react-native';
import { Screen } from '@/src/ui/Screen';
import { useI18n } from '@/src/i18n';
import { fetchPatient, type PatientDetail } from '@/src/api/practitioner';

// One patient: who they are and the last few notes, so a new note has context.
// Deliberately not the record — no journals, documents or submissions.
const T = {
  en: { notes: 'Recent notes', none: 'No notes yet.', take: 'Take a note', more: 'more in the care app', missing: 'Patient not found.' },
  fr: { notes: 'Notes récentes', none: 'Aucune note.', take: 'Prendre une note', more: 'de plus dans l’app', missing: 'Patient introuvable.' },
} as const;

export default function PatientDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const patientId = typeof id === 'string' ? id : '';
  const { locale } = useI18n();
  const tr = T[locale] ?? T.en;
  const [data, setData] = useState<PatientDetail | null>(null);
  const [loaded, setLoaded] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      void fetchPatient(patientId).then((d) => { if (alive) { setData(d); setLoaded(true); } });
      return () => { alive = false; };
    }, [patientId]),
  );

  const date = (iso: string) =>
    new Date(iso).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <Screen bg="bg-surface-soft" scroll className="px-6">
      <TouchableOpacity onPress={() => router.back()} hitSlop={10} className="mt-2 h-9 w-9 items-center justify-center rounded-full bg-white">
        <ArrowLeft size={18} color="#1A1A1A" />
      </TouchableOpacity>

      {!loaded && <ActivityIndicator className="mt-10" />}
      {loaded && !data && <Text className="mt-8 text-[14px] text-muted">{tr.missing}</Text>}

      {data && (
        <>
          <Text className="mt-4 text-[26px] font-bold tracking-[-0.6px] text-ink">{data.patient.name}</Text>

          <TouchableOpacity
            onPress={() => router.navigate(`/(practitioner)/note?patientId=${data.patient.id}` as never)}
            activeOpacity={0.85}
            className="mt-5 flex-row items-center justify-center gap-2 rounded-full bg-ink py-3.5"
          >
            <PenLine size={16} color="#fff" strokeWidth={2.2} />
            <Text className="text-[15px] font-bold text-white">{tr.take}</Text>
          </TouchableOpacity>

          <Text className="mt-8 text-[12px] font-extrabold uppercase tracking-[0.6px] text-muted">{tr.notes}</Text>
          {data.notes.length === 0 && <Text className="mt-3 text-[14px] text-muted">{tr.none}</Text>}
          {data.notes.map((n) => (
            <View key={n.id} className="mt-3 rounded-2xl bg-white p-4">
              <Text className="text-[12px] text-muted">{date(n.createdAt)}</Text>
              {n.title ? <Text className="mt-1 text-[15px] font-bold text-ink">{n.title}</Text> : null}
              <Text className="mt-1 text-[14.5px] leading-[22px] text-ink">{n.content}</Text>
            </View>
          ))}
          {data.totalNotes > data.notes.length && (
            <Text className="mt-3 text-[12.5px] text-muted">
              +{data.totalNotes - data.notes.length} {tr.more}
            </Text>
          )}
          <View className="h-10" />
        </>
      )}
    </Screen>
  );
}

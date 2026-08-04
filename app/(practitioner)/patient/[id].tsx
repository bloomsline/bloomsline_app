import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { EDA, EdHeader, EdCard, EdPill, EdSection, FadeIn } from '@/src/ui/editorial';
import { useI18n } from '@/src/i18n';
import { fetchPatient, type PatientDetail } from '@/src/api/practitioner';

// One patient: who they are and their last few notes, so a new note has
// context. Not the record — no journals, documents or submissions.
const T = {
  en: { kicker: 'PATIENT', notes: 'RECENT NOTES', none: 'No notes yet.', take: 'Take a note', book: 'Book a session', more: 'more in the care app', missing: 'Patient not found.' },
  fr: { kicker: 'PATIENT', notes: 'NOTES RÉCENTES', none: 'Aucune note.', take: 'Prendre une note', book: 'Réserver une séance', more: 'de plus dans l’app', missing: 'Patient introuvable.' },
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

  const date = (iso: string) => new Date(iso).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const back = () => (router.canGoBack() ? router.back() : router.navigate('/(practitioner)/people' as never));

  return (
    <View style={{ flex: 1, backgroundColor: EDA.canvas }}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        <EdHeader kicker={tr.kicker} title={data?.patient.name ?? '…'} onBack={back} />

        <FadeIn style={{ paddingHorizontal: 22, paddingTop: 20 }}>
          {!loaded && <ActivityIndicator />}
          {loaded && !data && <Text style={{ fontSize: 14, color: EDA.inkSoft }}>{tr.missing}</Text>}

          {data && (
            <>
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 26 }}>
                <EdPill label={tr.take} onPress={() => router.navigate(`/(practitioner)/note?patientId=${data.patient.id}` as never)} style={{ flex: 1 }} />
                <EdPill label={tr.book} variant="outline" onPress={() => router.navigate('/(practitioner)/book' as never)} style={{ flex: 1 }} />
              </View>

              <EdSection label={tr.notes} />
              {data.notes.length === 0 && <Text style={{ fontSize: 14, color: EDA.inkSoft }}>{tr.none}</Text>}
              {data.notes.map((n) => (
                <EdCard key={n.id} style={{ marginBottom: 10 }}>
                  <Text style={{ fontSize: 12, color: EDA.faint }}>{date(n.createdAt)}</Text>
                  {n.title ? <Text style={{ fontSize: 15.5, fontWeight: '700', color: EDA.ink, marginTop: 4 }}>{n.title}</Text> : null}
                  <Text style={{ fontSize: 14.5, lineHeight: 22, color: EDA.ink, marginTop: 4 }}>{n.content}</Text>
                </EdCard>
              ))}
              {data.totalNotes > data.notes.length && (
                <Text style={{ fontSize: 12.5, color: EDA.faint, marginTop: 6 }}>
                  +{data.totalNotes - data.notes.length} {tr.more}
                </Text>
              )}
            </>
          )}
        </FadeIn>
      </ScrollView>
    </View>
  );
}

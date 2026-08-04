import { useCallback, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Search } from 'lucide-react-native';
import { EDA, EdHeader, EdCard, EdPill, EdSection, FadeIn } from '@/src/ui/editorial';
import { useI18n } from '@/src/i18n';
import { fetchPatients, createNote, type PatientListItem } from '@/src/api/practitioner';

// Take a note. Reached from the tab bar with nobody chosen, or from a patient
// with them already chosen — the same screen either way, because the only
// difference is whether the first question is already answered.
const T = {
  en: {
    kicker: 'NOTE', title: 'Take a note', who: 'WHO IS THIS ABOUT?', search: 'Search by name',
    placeholder: 'What happened, what you noticed, what to pick up next time…',
    save: 'Save note', empty: 'No patients yet.', titlePlaceholder: 'Title (optional)', change: 'Change',
  },
  fr: {
    kicker: 'NOTE', title: 'Prendre une note', who: 'À PROPOS DE QUI ?', search: 'Rechercher par nom',
    placeholder: 'Ce qui s’est passé, ce que vous avez remarqué, à reprendre la prochaine fois…',
    save: 'Enregistrer', empty: 'Aucun patient.', titlePlaceholder: 'Titre (facultatif)', change: 'Changer',
  },
} as const;

export default function TakeNote() {
  const router = useRouter();
  const { patientId } = useLocalSearchParams<{ patientId?: string }>();
  const { locale } = useI18n();
  const tr = T[locale] ?? T.en;

  const [picked, setPicked] = useState<string | null>(typeof patientId === 'string' ? patientId : null);
  const [patients, setPatients] = useState<PatientListItem[]>([]);
  const [q, setQ] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      void fetchPatients().then((rows) => { if (alive) setPatients(rows ?? []); });
      return () => { alive = false; };
    }, []),
  );

  const needle = q.trim().toLowerCase();
  const shown = needle ? patients.filter((p) => p.name.toLowerCase().includes(needle)) : patients;
  const pickedName = patients.find((p) => p.id === picked)?.name;
  const back = () => (router.canGoBack() ? router.back() : router.navigate('/(practitioner)/home' as never));

  const save = async () => {
    if (!picked || !content.trim()) return;
    setError(''); setSaving(true);
    const res = await createNote(picked, content.trim(), title.trim() || undefined);
    setSaving(false);
    if (!res.ok) { setError(res.error ?? ''); return; }
    // The screen behind reloads on focus, so the note is already in their list.
    back();
  };

  return (
    <View style={{ flex: 1, backgroundColor: EDA.canvas }}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <EdHeader kicker={tr.kicker} title={tr.title} onBack={back} />

          <FadeIn style={{ paddingHorizontal: 22, paddingTop: 20 }}>
            {!picked ? (
              <>
                <EdSection label={tr.who} />
                <EdCard style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14, marginBottom: 14 }}>
                  <Search size={16} color={EDA.faint} />
                  <TextInput value={q} onChangeText={setQ} placeholder={tr.search} placeholderTextColor={EDA.faint} style={{ flex: 1, fontSize: 15, color: EDA.ink }} autoCorrect={false} />
                </EdCard>
                {shown.length === 0 && <Text style={{ fontSize: 14, color: EDA.inkSoft }}>{tr.empty}</Text>}
                {shown.map((p) => (
                  <EdCard key={p.id} onPress={() => setPicked(p.id)} style={{ marginBottom: 10 }}>
                    <Text style={{ fontSize: 15, fontWeight: '600', color: EDA.ink }}>{p.name}</Text>
                  </EdCard>
                ))}
              </>
            ) : (
              <>
                <Pressable onPress={() => setPicked(null)} style={{ alignSelf: 'flex-start', borderRadius: 20, backgroundColor: EDA.greenTint, paddingHorizontal: 14, paddingVertical: 8, marginBottom: 16 }}>
                  <Text style={{ fontSize: 13.5, fontWeight: '700', color: EDA.greenDeep }}>{pickedName ?? tr.change}</Text>
                </Pressable>

                <EdCard style={{ paddingVertical: 14, marginBottom: 10 }}>
                  <TextInput value={title} onChangeText={setTitle} placeholder={tr.titlePlaceholder} placeholderTextColor={EDA.faint} style={{ fontSize: 15.5, fontWeight: '700', color: EDA.ink }} />
                </EdCard>

                <EdCard style={{ paddingVertical: 14 }}>
                  <TextInput
                    value={content}
                    onChangeText={setContent}
                    placeholder={tr.placeholder}
                    placeholderTextColor={EDA.faint}
                    multiline
                    textAlignVertical="top"
                    style={{ minHeight: 190, fontSize: 15.5, lineHeight: 24, color: EDA.ink }}
                    autoFocus
                  />
                </EdCard>

                <EdPill label={saving ? '…' : tr.save} onPress={save} disabled={saving || !content.trim()} style={{ marginTop: 18 }} />
                {saving && <ActivityIndicator style={{ marginTop: 12 }} />}
                {error ? <Text style={{ fontSize: 13.5, color: '#C0392B', marginTop: 12 }}>{error}</Text> : null}
              </>
            )}
          </FadeIn>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

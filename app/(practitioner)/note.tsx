import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Search } from 'lucide-react-native';
import { EDA, EdHeader, EdCard, EdPill, EdSection, FadeIn } from '@/src/ui/editorial';
import { useI18n } from '@/src/i18n';
import { fetchPatients, fetchNoteVocabulary, createNote, type PatientListItem, type NoteVocabulary, type PatientSession } from '@/src/api/practitioner';

// Take a note — the same object the web writes: attached to a SESSION, carrying
// a note type and tags.
//
// The session is required, not optional. A note nobody can place against a
// session later is an observation floating free of the work it came from, which
// is what the appointment link exists to prevent.
const T = {
  en: {
    kicker: 'NOTE', title: 'Take a note', who: 'WHO IS THIS ABOUT?', search: 'Search by name',
    session: 'WHICH SESSION?', noSessions: 'No sessions with this patient yet. Book one first.',
    kind: 'NOTE TYPE', tags: 'TAGS',
    placeholder: 'What happened, what you noticed, what to pick up next time…',
    save: 'Save note', empty: 'No patients yet.', titlePlaceholder: 'Title (optional)', change: 'Change',
  },
  fr: {
    kicker: 'NOTE', title: 'Prendre une note', who: 'À PROPOS DE QUI ?', search: 'Rechercher par nom',
    session: 'QUELLE SÉANCE ?', noSessions: 'Aucune séance avec ce patient. Réservez-en une d’abord.',
    kind: 'TYPE DE NOTE', tags: 'ÉTIQUETTES',
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
  const [vocab, setVocab] = useState<NoteVocabulary | null>(null);
  const [session, setSession] = useState<PatientSession | null>(null);
  const [noteType, setNoteType] = useState('general');
  const [tags, setTags] = useState<string[]>([]);
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

  // The vocabulary is per patient: their sessions, and this practitioner's own
  // note types and tags.
  useEffect(() => {
    if (!picked) { setVocab(null); setSession(null); return; }
    let alive = true;
    void fetchNoteVocabulary(picked).then((v) => {
      if (!alive) return;
      setVocab(v);
      setSession(v?.sessions[0] ?? null); // the most recent — usually the one
    });
    return () => { alive = false; };
  }, [picked]);

  const needle = q.trim().toLowerCase();
  const shown = needle ? patients.filter((p) => p.name.toLowerCase().includes(needle)) : patients;
  const pickedName = patients.find((p) => p.id === picked)?.name;
  const back = () => (router.canGoBack() ? router.back() : router.navigate('/(practitioner)/home' as never));

  const when = (s: PatientSession) =>
    new Date(s.scheduledAt).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  const toggleTag = (slug: string) =>
    setTags((cur) => (cur.includes(slug) ? cur.filter((t) => t !== slug) : cur.length >= 7 ? cur : [...cur, slug]));

  const save = async () => {
    if (!picked || !session || !content.trim()) return;
    setError(''); setSaving(true);
    const res = await createNote({
      patientId: picked, appointmentId: session.id, content: content.trim(),
      title: title.trim() || undefined, noteType, tags,
    });
    setSaving(false);
    if (!res.ok) { setError(res.error ?? ''); return; }
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
                <Pressable onPress={() => setPicked(null)} style={{ alignSelf: 'flex-start', borderRadius: 20, backgroundColor: EDA.greenTint, paddingHorizontal: 14, paddingVertical: 8, marginBottom: 18 }}>
                  <Text style={{ fontSize: 13.5, fontWeight: '700', color: EDA.greenDeep }}>{pickedName ?? tr.change}</Text>
                </Pressable>

                <EdSection label={tr.session} />
                {!vocab && <ActivityIndicator />}
                {vocab && vocab.sessions.length === 0 && (
                  <EdCard style={{ marginBottom: 18 }}><Text style={{ fontSize: 14, color: EDA.inkSoft }}>{tr.noSessions}</Text></EdCard>
                )}
                {vocab && vocab.sessions.length > 0 && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      {vocab.sessions.map((s) => {
                        const on = s.id === session?.id;
                        return (
                          <Pressable key={s.id} onPress={() => setSession(s)} style={{ borderRadius: 16, paddingHorizontal: 14, paddingVertical: 11, backgroundColor: on ? EDA.greenTint : EDA.card, borderWidth: 1.5, borderColor: on ? EDA.green : EDA.line }}>
                            <Text style={{ fontSize: 13.5, fontWeight: '700', color: on ? EDA.greenDeep : EDA.ink }}>{when(s)}</Text>
                            <Text style={{ fontSize: 11.5, color: EDA.faint, marginTop: 1 }}>{s.durationMinutes} min</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </ScrollView>
                )}

                {vocab && vocab.sessions.length > 0 && (
                  <>
                    {vocab.noteTypes.length > 1 && (
                      <>
                        <EdSection label={tr.kind} />
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
                          {vocab.noteTypes.map((t) => (
                            <Chip key={t} label={t.replace(/_/g, ' ')} on={t === noteType} onPress={() => setNoteType(t)} />
                          ))}
                        </View>
                      </>
                    )}

                    {vocab.tags.length > 0 && (
                      <>
                        <EdSection label={tr.tags} />
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
                          {vocab.tags.map((t) => (
                            <Chip key={t.slug} label={t.label} on={tags.includes(t.slug)} onPress={() => toggleTag(t.slug)} />
                          ))}
                        </View>
                      </>
                    )}

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
                        style={{ minHeight: 180, fontSize: 15.5, lineHeight: 24, color: EDA.ink }}
                      />
                    </EdCard>

                    <EdPill label={saving ? '…' : tr.save} onPress={save} disabled={saving || !content.trim() || !session} style={{ marginTop: 18 }} />
                    {saving && <ActivityIndicator style={{ marginTop: 12 }} />}
                    {error ? <Text style={{ fontSize: 13.5, color: '#C0392B', marginTop: 12 }}>{error}</Text> : null}
                  </>
                )}
              </>
            )}
          </FadeIn>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={{ borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: on ? EDA.greenTint : EDA.card, borderWidth: 1.5, borderColor: on ? EDA.green : EDA.line }}>
      <Text style={{ fontSize: 13, fontWeight: '700', color: on ? EDA.greenDeep : EDA.inkSoft, textTransform: 'capitalize' }}>{label}</Text>
    </Pressable>
  );
}

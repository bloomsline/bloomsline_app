import { useCallback, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect, useRouter } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { EDA, EdHeader, EdCard, EdSection, FadeIn } from '@/src/ui/editorial';
import { useI18n } from '@/src/i18n';
import { useNoteDraft } from '@/src/notes/draft';
import { NoteEditor } from '@/src/notes/NoteEditor';
import { fetchNoteWorkspace, createNote, type NoteWorkspace, type UpcomingSession } from '@/src/api/practitioner';

// Take a note. Opens on the sessions still to happen — a note is about a session
// you are heading into or have just had — with a toggle to browse by patient
// instead, for the times you are thinking of a person rather than a slot.
const T = {
  en: {
    kicker: 'NOTE', title: 'Take a note',
    upcoming: 'Upcoming', byPatient: 'By patient',
    none: 'No upcoming sessions. Book one and the note goes with it.',
    pick: 'PICK A SESSION', sessionNote: 'Session note',
  },
  fr: {
    kicker: 'NOTE', title: 'Prendre une note',
    upcoming: 'À venir', byPatient: 'Par patient',
    none: 'Aucune séance à venir. Réservez-en une et la note suivra.',
    pick: 'CHOISIR UNE SÉANCE', sessionNote: 'Note de séance',
  },
} as const;

export default function TakeNote() {
  const router = useRouter();
  const { locale } = useI18n();
  const tr = T[locale] ?? T.en;
  const { draft, open, update, minimize, discard } = useNoteDraft();

  const [ws, setWs] = useState<NoteWorkspace | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [mode, setMode] = useState<'upcoming' | 'patient'>('upcoming');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      void fetchNoteWorkspace().then((w) => { if (alive) { setWs(w); setLoaded(true); } });
      return () => { alive = false; };
    }, []),
  );

  const zone = ws?.timezone ? { timeZone: ws.timezone } : {};
  const when = (iso: string) =>
    new Date(iso).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', ...zone });

  const start = (s: UpcomingSession) => {
    open({
      appointmentId: s.id, memberId: s.memberId, who: s.who, when: when(s.scheduledAt),
      title: '', text: '', ranges: [], noteType: ws?.noteTypes[0] ?? 'general',
    });
    setError('');
  };

  const save = async () => {
    if (!draft || !draft.text.trim()) return;
    setError(''); setSaving(true);
    const res = await createNote({
      patientId: draft.memberId, appointmentId: draft.appointmentId,
      content: draft.text.trim(), title: draft.title.trim() || undefined,
      noteType: draft.noteType, ranges: draft.ranges,
    });
    setSaving(false);
    if (!res.ok) { setError(res.error ?? ''); return; }
    discard();
    router.navigate('/(practitioner)/home' as never);
  };

  // Grouped by patient for the other half of the toggle — same data, so
  // switching costs nothing.
  const byPatient = (ws?.sessions ?? []).reduce<Record<string, { who: string; items: UpcomingSession[] }>>((acc, s) => {
    (acc[s.memberId] ??= { who: s.who, items: [] }).items.push(s);
    return acc;
  }, {});

  if (draft) {
    return (
      <View style={{ flex: 1, backgroundColor: EDA.canvas }}>
        <StatusBar style="dark" />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ padding: 22, paddingTop: 60 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={{ fontSize: 12.5, color: EDA.faint, marginBottom: 4 }}>{draft.who} · {draft.when}</Text>
            <NoteEditor
              header={tr.sessionNote}
              title={draft.title}
              text={draft.text}
              ranges={draft.ranges}
              noteType={draft.noteType}
              noteTypes={ws?.noteTypes ?? ['general']}
              tags={ws?.tags ?? []}
              templates={ws?.templates ?? []}
              saving={saving}
              error={error}
              onTitle={(title) => update({ title })}
              onText={(text) => update({ text })}
              onRanges={(ranges) => update({ ranges })}
              onNoteType={(noteType) => update({ noteType })}
              onSave={save}
              onMinimize={() => { minimize(); router.back(); }}
              onCancel={() => { discard(); router.back(); }}
            />
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: EDA.canvas }}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        <EdHeader kicker={tr.kicker} title={tr.title} onBack={() => router.back()} />

        <FadeIn style={{ paddingHorizontal: 22, paddingTop: 20 }}>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
            <Toggle label={tr.upcoming} on={mode === 'upcoming'} onPress={() => setMode('upcoming')} />
            <Toggle label={tr.byPatient} on={mode === 'patient'} onPress={() => setMode('patient')} />
          </View>

          {!loaded && <ActivityIndicator />}
          {loaded && (ws?.sessions.length ?? 0) === 0 && <Text style={{ fontSize: 14, color: EDA.inkSoft }}>{tr.none}</Text>}

          {mode === 'upcoming' && (ws?.sessions ?? []).map((s) => (
            <EdCard key={s.id} onPress={() => start(s)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15.5, fontWeight: '700', color: EDA.ink }}>{s.who}</Text>
                <Text style={{ fontSize: 12.5, color: EDA.inkSoft, marginTop: 2 }}>{when(s.scheduledAt)} · {s.durationMinutes} min</Text>
              </View>
              <ChevronRight size={16} color={EDA.line} />
            </EdCard>
          ))}

          {mode === 'patient' && Object.entries(byPatient).map(([id, group]) => (
            <View key={id} style={{ marginBottom: 18 }}>
              <EdSection label={group.who} />
              {group.items.map((s) => (
                <EdCard key={s.id} onPress={() => start(s)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                  <Text style={{ flex: 1, fontSize: 14.5, color: EDA.ink }}>{when(s.scheduledAt)}</Text>
                  <ChevronRight size={16} color={EDA.line} />
                </EdCard>
              ))}
            </View>
          ))}
        </FadeIn>
      </ScrollView>
    </View>
  );
}

function Toggle({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{ flex: 1, alignItems: 'center', paddingVertical: 11, borderRadius: 14, backgroundColor: on ? EDA.ink : EDA.card, borderWidth: 1, borderColor: on ? EDA.ink : EDA.line }}
    >
      <Text style={{ fontSize: 14, fontWeight: '700', color: on ? '#fff' : EDA.inkSoft }}>{label}</Text>
    </Pressable>
  );
}

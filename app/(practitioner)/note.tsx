import { useCallback, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Pressable, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { EdHeader, EdCard, EdSection, FadeIn } from '@/src/ui/editorial';
import { useI18n } from '@/src/i18n';
import { useNoteDraft } from '@/src/notes/draft';
import { NoteEditor } from '@/src/notes/NoteEditor';
import { fetchNoteWorkspace, createNote, type NoteWorkspace, type UpcomingSession } from '@/src/api/practitioner';
import { notify } from '@/src/ui/alert';
import { useConfirm } from '@/src/ui/confirm';
import { useTheme } from '@/src/ui/theme-mode';
import { localizeServerMessage } from '@/src/api/server-messages';
import { LoadFailed } from '@/src/ui/LoadFailed';

// Take a note. Opens on the sessions still to happen, then the ones of the last
// week (a note is about a session you are heading into or have just had), with a
// toggle to browse by patient instead, for when you think of a person, not a slot.
const T = {
  en: {
    kicker: 'NOTE', title: 'Take a note',
    upcoming: 'Sessions', byPatient: 'By patient', recent: 'RECENT',
    none: 'No sessions this past week or coming up. Book one and the note goes with it.',
    pick: 'PICK A SESSION', sessionNote: 'Session note',
    kept: 'Draft kept ·', keeping: 'Keeping…', notKeptYet: 'Not kept yet', keptLocal: 'Kept on this phone until you add it',
    notKept: 'Not kept — check your connection',
    couldNotOpen: 'Could not open this session’s note. Check your connection and try again.',
    discardFailed: 'Could not delete the draft. Check your connection.',
    discardTitle: 'Discard this draft?', discardBody: 'What you have written here will be deleted. This cannot be undone.',
    discardYes: 'Discard', discardNo: 'Keep it',
  },
  fr: {
    kicker: 'NOTE', title: 'Prendre une note',
    upcoming: 'Séances', byPatient: 'Par patient', recent: 'RÉCENTES',
    none: 'Aucune séance cette semaine passée ni à venir. Réservez-en une et la note suivra.',
    pick: 'CHOISIR UNE SÉANCE', sessionNote: 'Note de séance',
    kept: 'Brouillon conservé ·', keeping: 'Conservation…', notKeptYet: 'Pas encore conservé', keptLocal: 'Conservé sur ce téléphone jusqu’à l’ajout',
    notKept: 'Non conservé — vérifiez votre connexion',
    couldNotOpen: 'Impossible d’ouvrir la note de cette séance. Vérifiez votre connexion et réessayez.',
    discardFailed: 'Impossible de supprimer le brouillon. Vérifiez votre connexion.',
    discardTitle: 'Supprimer ce brouillon ?', discardBody: 'Ce que vous avez écrit ici sera supprimé. Cette action est irréversible.',
    discardYes: 'Supprimer', discardNo: 'Le conserver',
  },
} as const;

export default function TakeNote() {
  const { t: TT } = useTheme();
  const router = useRouter();
  const { locale } = useI18n();
  const tr = T[locale] ?? T.en;
  const { draft, openForSession, update, minimize, flush, settle, discard, status, savedAt } = useNoteDraft();
  const confirm = useConfirm();

  const [ws, setWs] = useState<NoteWorkspace | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [attempt, setAttempt] = useState(0);
  // The session whose note is being read before the editor opens.
  const [opening, setOpening] = useState<string | null>(null);
  const [mode, setMode] = useState<'upcoming' | 'patient'>('upcoming');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      void attempt; // Try again reads it anew.
      // A failed read keeps what was shown before, and says so when there was
      // nothing: it read "No upcoming sessions", which was not true.
      void fetchNoteWorkspace().then((w) => { if (alive) { if (w) setWs(w); setLoaded(true); } });
      return () => { alive = false; };
    }, [attempt]),
  );

  const zone = ws?.timezone ? { timeZone: ws.timezone } : {};
  const when = (iso: string) =>
    new Date(iso).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', ...zone });

  const start = async (s: UpcomingSession) => {
    if (opening) return;
    setError('');
    setOpening(s.id);
    // Picks up what the session already has — the saved note, or a newer draft
    // started on the laptop, since both surfaces write the same row. If that
    // cannot be read, the editor does not open: blank and saved, it would
    // replace the note.
    const res = await openForSession({
      appointmentId: s.id, memberId: s.memberId, who: s.who, when: when(s.scheduledAt), noteType: ws?.noteTypes[0] ?? 'general',
    }).finally(() => setOpening(null));
    if (!res.ok) notify(tr.title, res.reason === 'unsaved' ? tr.notKept : tr.couldNotOpen);
  };

  const save = async () => {
    if (!draft || !draft.text.trim()) return;
    setError(''); setSaving(true);
    // Let any draft write in flight finish first. One landing after the save
    // would outlive the server's cleanup and reopen in place of the note.
    await flush();
    const res = await createNote({
      patientId: draft.memberId, appointmentId: draft.appointmentId,
      // Untrimmed: the marks are offsets into the text as typed. The server
      // trims and moves them together.
      content: draft.text,
      // Adding to a web-formatted note: only the addition goes, after the note
      // as it was when shown (refused if it changed since).
      ...(draft.appendTo ? { append: true, baseUpdatedAt: draft.appendTo.updatedAt } : {}),
      noteType: draft.noteType, ranges: draft.ranges,
    });
    setSaving(false);
    if (!res.ok) { setError(localizeServerMessage(res.error, locale) ?? ''); return; }
    // The note is written and the server dropped the draft with it; settle so a
    // late autosave cannot put it back.
    settle();
    router.navigate('/(practitioner)/home' as never);
  };

  /**
   * Leaving keeps the writing. Anything pending is written FIRST rather than
   * waiting out the debounce, so there is nothing to confirm — and if that write
   * fails we stay put and say so, because that is the one case where leaving
   * would actually cost the note.
   */
  const leaveKeeping = async () => {
    const ok = await flush();
    if (!ok) { setError(tr.notKept); return; }
    router.back();
  };

  /** The only destructive path, and so the only one that asks. */
  const throwAway = async () => {
    const yes = await confirm({
      title: tr.discardTitle, message: tr.discardBody,
      confirmLabel: tr.discardYes, cancelLabel: tr.discardNo, destructive: true,
    });
    if (!yes) return;
    if (!(await discard())) notify(tr.sessionNote, tr.discardFailed);
    router.back();
  };

  // Grouped by patient for the other half of the toggle — same data, so
  // switching costs nothing.
  const byPatient = (ws?.sessions ?? []).reduce<Record<string, { who: string; items: UpcomingSession[] }>>((acc, s) => {
    (acc[s.memberId] ??= { who: s.who, items: [] }).items.push(s);
    return acc;
  }, {});

  if (draft) {
    return (
      <View style={{ flex: 1, backgroundColor: TT.bg }}>
        {/* `padding` on Android too: `undefined` does nothing there, and the lines
            being typed and the Save button sat under the keyboard. */}
        <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ padding: 22, paddingTop: 60 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={{ fontSize: 12.5, color: TT.faint, marginBottom: 4 }}>{draft.who} · {draft.when}</Text>
            <NoteEditor
              header={tr.sessionNote}
              text={draft.text}
              simplified={draft.simplified}
              appendToHtml={draft.appendTo?.html}
              ranges={draft.ranges}
              noteType={draft.noteType}
              noteTypes={ws?.noteTypes ?? ['general']}
              tags={ws?.tags ?? []}
              templates={ws?.templates ?? []}
              saving={saving}
              error={error}
              onText={(text) => update({ text })}
              onRanges={(ranges) => update({ ranges })}
              onNoteType={(noteType) => update({ noteType })}
              statusLine={
                status === 'error' ? tr.notKept
                : status === 'saving' ? tr.keeping
                : status === 'dirty' ? tr.notKeptYet
                : status === 'local' ? tr.keptLocal
                : savedAt ? `${tr.kept} ${new Date(savedAt).toLocaleTimeString(locale === 'fr' ? 'fr-FR' : 'en-GB', { hour: '2-digit', minute: '2-digit' })}`
                : undefined
              }
              onSave={save}
              onMinimize={() => { minimize(); router.back(); }}
              onCancel={leaveKeeping}
              onDiscard={savedAt || draft.text.trim() ? throwAway : undefined}
            />
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: TT.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        <EdHeader kicker={tr.kicker} title={tr.title} onBack={() => router.back()} />

        <FadeIn style={{ paddingHorizontal: 22, paddingTop: 20 }}>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
            <Toggle label={tr.upcoming} on={mode === 'upcoming'} onPress={() => setMode('upcoming')} />
            <Toggle label={tr.byPatient} on={mode === 'patient'} onPress={() => setMode('patient')} />
          </View>

          {!loaded && <ActivityIndicator />}
          {loaded && !ws && <LoadFailed onRetry={() => setAttempt((a) => a + 1)} />}
          {loaded && ws && ws.sessions.length === 0 && <Text style={{ fontSize: 14, color: TT.inkSoft }}>{tr.none}</Text>}

          {mode === 'upcoming' && (ws?.sessions ?? []).map((s, i, all) => (
            <View key={s.id}>
              {s.past && !all[i - 1]?.past ? <EdSection label={tr.recent} /> : null}
              <EdCard onPress={() => { void start(s); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15.5, fontWeight: '700', color: TT.ink }}>{s.who}</Text>
                  <Text style={{ fontSize: 12.5, color: TT.inkSoft, marginTop: 2 }}>{when(s.scheduledAt)} · {s.durationMinutes} min</Text>
                </View>
                {opening === s.id ? <ActivityIndicator size="small" color={TT.faint} /> : <ChevronRight size={16} color={TT.faint} />}
              </EdCard>
            </View>
          ))}

          {mode === 'patient' && Object.entries(byPatient).map(([id, group]) => (
            <View key={id} style={{ marginBottom: 18 }}>
              <EdSection label={group.who} />
              {group.items.map((s) => (
                <EdCard key={s.id} onPress={() => { void start(s); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                  <Text style={{ flex: 1, fontSize: 14.5, color: TT.ink }}>{when(s.scheduledAt)}</Text>
                  {opening === s.id ? <ActivityIndicator size="small" color={TT.faint} /> : <ChevronRight size={16} color={TT.faint} />}
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
  const { t: TT } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={{ flex: 1, alignItems: 'center', paddingVertical: 11, borderRadius: 14, backgroundColor: on ? TT.ink : TT.card, borderWidth: 1, borderColor: on ? TT.ink : TT.line }}
    >
      <Text style={{ fontSize: 14, fontWeight: '700', color: on ? TT.ctaFg : TT.inkSoft }}>{label}</Text>
    </Pressable>
  );
}

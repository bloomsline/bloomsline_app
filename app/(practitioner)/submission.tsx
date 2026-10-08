import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { History } from 'lucide-react-native';
import { EdHeader, EdCard, EdPill, FadeIn } from '@/src/ui/editorial';
import { useConfirm } from '@/src/ui/confirm';
import { useLeaveGuard } from '@/src/ui/leave-guard';
import { Block } from '@/src/resources/blocks';
import { fileUrlIndex } from '@/src/resources/answers';
import { useI18n } from '@/src/i18n';
import { actOnSubmission, fetchDay, fetchSubmission, type SubmissionDetail } from '@/src/api/practitioner';
import { useTheme } from '@/src/ui/theme-mode';
import { usePracticeZone } from '@/src/practitioner/practice-zone';
import { LoadFailed } from '@/src/ui/LoadFailed';

// One submission, read-only.
//
// Rendered against the version it was ANSWERED ON, which is the whole reason
// this screen is not just "the resource with values filled in". A resource
// edited since would have different questions, and drawing old answers against
// new ones silently reattributes them — answer three appearing under a question
// the patient never saw. The banner says which version, because a practitioner
// reading something that looks subtly wrong deserves to know why.
const T = {
  en: {
    kicker: 'SUBMISSION', pinned: 'Rendered against the version this was answered on.',
    missing: 'This submission is no longer available. It may have been deleted.', note: 'YOUR NOTE BACK',
    onEarlier: (d: string) => `Written on ${d}, about the earlier answers. These were sent since.`,
    sources: { app: 'App', web: 'Web', share: 'Shared link', link: 'Shared link' },
  },
  fr: {
    kicker: 'RÉPONSE', pinned: 'Affiché selon la version utilisée pour répondre.',
    missing: 'Cette réponse n’est plus disponible. Elle a peut-être été supprimée.', note: 'VOTRE RETOUR',
    onEarlier: (d: string) => `Écrit le ${d}, sur les réponses précédentes. Celles-ci ont été envoyées depuis.`,
    sources: { app: 'App', web: 'Web', share: 'Lien partagé', link: 'Lien partagé' },
  },
} as const;

export default function SubmissionScreen() {
  const { t: TT } = useTheme();
  const router = useRouter();
  const { locale } = useI18n();
  const zone = usePracticeZone(fetchDay);
  const tr = T[locale] ?? T.en;
  const { id } = useLocalSearchParams<{ id: string }>();

  const [view, setView] = useState<SubmissionDetail | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [gone, setGone] = useState(false);

  // A different id is a different screen: never show the last one while this loads.
  useEffect(() => { setView(null); setLoaded(false); setGone(false); }, [id]);

  const load = useCallback(async (alive: () => boolean = () => true) => {
    const v = await fetchSubmission(String(id));
    if (!alive()) return;
    setGone(v === 'gone');
    // A failed refresh keeps what is already on screen.
    if (v !== 'gone') setView((prev) => v ?? prev);
    else setView(null);
    setLoaded(true);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      void load(() => alive);
      return () => { alive = false; };
    }, [load]),
  );

  // Every file of an answer by its storage key (see `urlsByKey`); an older
  // server's single `mediaUrls` link still reaches the first file.
  const fileUrls = useMemo(() => (view ? fileUrlIndex(view.version.blocks, view.answers, view.fileUrls, view.mediaUrls) : {}), [view]);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/(practitioner)/submissions' as never));
  const loc = locale === 'fr' ? 'fr-FR' : 'en-GB';
  const when = view?.submittedAt
    ? new Date(view.submittedAt).toLocaleString(loc, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', ...zone })
    : '';

  return (
    <View style={{ flex: 1, backgroundColor: TT.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        <EdHeader kicker={tr.kicker} title={view?.who ?? ''} onBack={back} />

        <FadeIn style={{ paddingHorizontal: 22, paddingTop: 18 }}>
          {!loaded && <ActivityIndicator />}
          {loaded && !view && gone && <Text style={{ fontSize: 14, color: TT.inkSoft }}>{tr.missing}</Text>}
          {loaded && !view && !gone && <LoadFailed onRetry={() => load()} />}

          {view && (
            <>
              <EdCard style={{ marginBottom: 14 }}>
                <Text numberOfLines={3} style={{ fontSize: 15, fontWeight: '700', color: TT.ink }}>{view.resourceTitle}</Text>
                <Text style={{ fontSize: 12.5, color: TT.faint, marginTop: 4 }}>
                  {when} · {tr.sources[view.source as keyof typeof tr.sources] ?? view.source}
                </Text>
                {view.score && (
                  <Text style={{ fontSize: 14, fontWeight: '800', color: TT.accent, marginTop: 6 }}>
                    {view.score.total}/{view.score.maxScore}{view.score.label ? ` · ${view.score.label}` : ''}
                  </Text>
                )}
              </EdCard>

              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 9, marginBottom: 18, paddingHorizontal: 2 }}>
                <History size={13} color={TT.faint} style={{ marginTop: 2 }} />
                <Text style={{ flex: 1, fontSize: 12, lineHeight: 18, color: TT.faint }}>{tr.pinned}</Text>
              </View>

              {view.version.blocks.map((b) => (
                <Block
                  key={b.id}
                  block={b}
                  value={view.answers[b.id]}
                  onChange={() => {}}
                  missing={false}
                  readOnly
                  mediaUrl={view.mediaUrls?.[b.id]}
                  fileUrls={fileUrls}
                />
              ))}

              <ReplyCard view={view} loc={loc} zone={zone} onDone={() => load()} />
            </>
          )}
        </FadeIn>
      </ScrollView>
    </View>
  );
}

const R = {
  en: {
    reply: (who: string) => `REPLY TO ${who.toUpperCase()}`, review: 'REVIEW',
    waiting: 'Waiting for your review.',
    reviewed: (d: string) => `Reviewed on ${d}.`,
    handedBack: (who: string) => `Handed back. Waiting for ${who} to send it again.`,
    placeholder: 'A few words back (optional). They see it in their app.',
    sendReview: 'Send and mark reviewed', markReviewed: 'Mark reviewed', update: 'Update my reply', isReviewed: 'Reviewed',
    redo: 'Ask to redo',
    redoTitle: (who: string) => `Hand it back to ${who}?`,
    redoBody: 'They can change their answers and send them again. Anything you wrote above goes with it.',
    redoConfirm: 'Hand it back', cancel: 'Cancel',
    sent: (who: string) => `Sent. ${who} has been told.`, marked: 'Marked reviewed.', handed: (who: string) => `Handed back to ${who}.`,
    leaveTitle: 'Discard your reply?', leaveBody: 'It has not been sent.', discard: 'Discard', keep: 'Keep writing',
    offline: 'Could not reach Bloomsline. Check your connection and try again.',
    goneErr: 'This submission is no longer available.',
    alreadyBack: 'It was already handed back.',
    failed: 'Could not save. Try again in a moment.',
  },
  fr: {
    reply: (who: string) => `RÉPONDRE À ${who.toUpperCase()}`, review: 'RELECTURE',
    waiting: 'En attente de votre relecture.',
    reviewed: (d: string) => `Relu le ${d}.`,
    handedBack: (who: string) => `Renvoyé. En attente du nouvel envoi de ${who}.`,
    placeholder: 'Quelques mots en retour (facultatif). Visibles dans son application.',
    sendReview: 'Envoyer et marquer comme relu', markReviewed: 'Marquer comme relu', update: 'Mettre à jour ma réponse', isReviewed: 'Relu',
    redo: 'Demander de refaire',
    redoTitle: (who: string) => `Renvoyer à ${who} ?`,
    redoBody: 'Ses réponses pourront être modifiées puis renvoyées. Ce que vous avez écrit ci-dessus part avec.',
    redoConfirm: 'Renvoyer', cancel: 'Annuler',
    sent: (who: string) => `Envoyé. ${who} a reçu une notification.`, marked: 'Marqué comme relu.', handed: (who: string) => `Renvoyé à ${who}.`,
    leaveTitle: 'Abandonner votre réponse ?', leaveBody: 'Elle n’a pas été envoyée.', discard: 'Abandonner', keep: 'Continuer',
    offline: 'Impossible de joindre Bloomsline. Vérifiez votre connexion et réessayez.',
    goneErr: 'Cette réponse n’est plus disponible.',
    alreadyBack: 'Elle avait déjà été renvoyée.',
    failed: 'Impossible d’enregistrer. Réessayez dans un instant.',
  },
} as const;

const MAX_REPLY = 4000;

// Reply, mark reviewed, or hand it back, as on the web's response page.
//
// The phone could open a submission but not answer it, so the notification
// that brought the practitioner here ended in "do it at the desk". The server
// runs the web's own actions; this is only the form. A shared-link answer has
// nobody to write back to or hand back to, so it can only be marked reviewed.
function ReplyCard({ view, loc, zone, onDone }: { view: SubmissionDetail; loc: string; zone: { timeZone?: string }; onDone: () => Promise<unknown> }) {
  const { t: TT } = useTheme();
  const { locale } = useI18n();
  const r = R[locale] ?? R.en;
  const confirm = useConfirm();
  const saved = view.practitionerNote ?? '';
  const [text, setText] = useState(saved);
  const [busy, setBusy] = useState<'review' | 'redo' | null>(null);
  const busyRef = useRef(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // A fresh load (after an action, or a refocus) brings the stored reply back in.
  useEffect(() => { setText(view.practitionerNote ?? ''); }, [view.practitionerNote, view.id]);

  const status = view.status ?? (view.noteWrittenAt ? 'reviewed' : 'submitted');
  const handedBack = status === 'draft';
  const person = !!view.memberId;
  const changed = text.trim() !== saved.trim();

  const guard = useLeaveGuard(changed && !handedBack, async (leave) => {
    const ok = await confirm({ title: r.leaveTitle, message: r.leaveBody, confirmLabel: r.discard, cancelLabel: r.keep, destructive: true });
    if (ok) leave();
  });

  const run = async (action: 'review' | 'redo') => {
    if (busyRef.current) return;
    if (action === 'redo') {
      const ok = await confirm({ title: r.redoTitle(view.who), message: r.redoBody, confirmLabel: r.redoConfirm, cancelLabel: r.cancel });
      if (!ok) return;
    }
    busyRef.current = true;
    setBusy(action); setMsg(null);
    const res = await actOnSubmission(view.id, action, person ? text.trim() : '');
    busyRef.current = false;
    setBusy(null);
    if (!res.ok) {
      setMsg({ ok: false, text: res.reason === 'offline' ? r.offline : res.reason === 'gone' ? r.goneErr : res.reason === 'handed_back' ? r.alreadyBack : (res.error ?? r.failed) });
      if (res.reason === 'handed_back') await onDone();
      return;
    }
    guard.release();
    setMsg({ ok: true, text: action === 'redo' ? r.handed(view.who) : text.trim() && person ? r.sent(view.who) : r.marked });
    await onDone();
  };

  const when = view.noteWrittenAt ? new Date(view.noteWrittenAt).toLocaleDateString(loc, { day: 'numeric', month: 'long', ...zone }) : '';
  const statusLine = handedBack ? r.handedBack(view.who) : status === 'reviewed' && when ? r.reviewed(when) : r.waiting;
  const primary = status === 'reviewed'
    ? (changed ? r.update : r.isReviewed)
    : (text.trim() && person ? r.sendReview : r.markReviewed);

  return (
    <View style={{ marginTop: 22 }}>
      <Text style={{ fontSize: 12.5, fontWeight: '700', letterSpacing: 0.2, color: TT.faint, marginBottom: 8 }}>
        {person ? r.reply(view.who) : r.review}
      </Text>
      <EdCard>
        <Text style={{ fontSize: 13, color: TT.inkSoft, marginBottom: 10 }}>{statusLine}</Text>
        {view.noteOnEarlierAnswers && view.noteWrittenAt ? (
          <Text style={{ fontSize: 12, color: TT.faint, marginBottom: 6 }}>{tr2(locale).onEarlier(when)}</Text>
        ) : null}

        {handedBack ? (
          saved ? <Text style={{ fontSize: 14.5, lineHeight: 21, color: TT.ink }}>{saved}</Text> : null
        ) : (
          <>
            {person && (
              <TextInput
                value={text}
                onChangeText={(v) => { setText(v.slice(0, MAX_REPLY)); setMsg(null); }}
                placeholder={r.placeholder}
                placeholderTextColor={TT.faint}
                multiline
                maxLength={MAX_REPLY}
                editable={!busy}
                style={{ minHeight: 96, borderWidth: 1, borderColor: TT.line, borderRadius: 14, padding: 12, fontSize: 14.5, lineHeight: 21, color: TT.ink, textAlignVertical: 'top', backgroundColor: TT.bg }}
              />
            )}
            <EdPill
              label={busy === 'review' ? '…' : primary}
              variant="green"
              disabled={!!busy || (status === 'reviewed' && !changed)}
              onPress={() => { void run('review'); }}
              style={{ marginTop: person ? 12 : 0 }}
            />
            {person && (
              <EdPill
                label={busy === 'redo' ? '…' : r.redo}
                variant="outline"
                disabled={!!busy}
                onPress={() => { void run('redo'); }}
                style={{ marginTop: 10 }}
              />
            )}
          </>
        )}
        {msg && (
          <Text accessibilityLiveRegion="polite" style={{ fontSize: 13, marginTop: 10, color: msg.ok ? TT.accentDeep : TT.danger }}>{msg.text}</Text>
        )}
      </EdCard>
    </View>
  );
}

const tr2 = (locale: string) => T[locale as keyof typeof T] ?? T.en;

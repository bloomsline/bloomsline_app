// Assigned-resource detail + response flow. Opens an assigned resource, renders
// the frozen version's blocks (shared renderer), collects answers, and submits →
// server validates + scores → shows the result. Reached from My Care "To do".
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, BackHandler, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Check, CircleCheckBig, MessageCircle } from 'lucide-react-native';
import { EdHeader, EdPill, FadeIn } from '@/src/ui/editorial';
import { ONBOARDING_IMAGES } from '@/src/onboarding/editorial/images';
import { Block, INTERACTIVE, ResourceIntro, type UploadStatus } from '@/src/resources/blocks';
import { fileUrlIndex, filesOf, isAnswered, missingRequired } from '@/src/resources/answers';
import { parseTypedNumber } from '@/src/resources/number';
import { flushCanvasDrafts } from '@/src/resources/zoned-canvas-field';
import { fetchAssignment, saveAssignmentDraft, submitAssignment, type AssignmentView, type PatientScore } from '@/src/api/resources';
import { useConfirm } from '@/src/ui/confirm';
import { useLeaveGuard } from '@/src/ui/leave-guard';
import { useI18n } from '@/src/i18n';
import { useTheme } from '@/src/ui/theme-mode';
import { OtherPractitionerNote } from '@/src/care/OtherPractitionerNote';
import { GrowFrame, takeGrowOrigin, useGrowFold } from '@/src/ui/grow';
import { clearUnsent, readUnsent, saveUnsent } from '@/src/unsent';
import { track } from '@/src/analytics/client';

const DANGER = '#C0392B';

// "4 August", or "4 August 2025" once the year stops being obvious. Returns null
// for a missing or unparseable date so callers can fall back to a dateless
// label rather than printing "Invalid Date" at a patient.
function formatDone(iso: string | null | undefined, locale: 'en' | 'fr'): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const sameYear = d.getFullYear() === new Date().getFullYear();
  try {
    return d.toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-GB', {
      day: 'numeric',
      month: 'long',
      ...(sameYear ? {} : { year: 'numeric' }),
    });
  } catch {
    // Intl is present on every platform we ship, but a formatting failure must
    // not cost the patient the whole screen.
    return null;
  }
}

const T = {
  en: {
    couldNotSubmit: 'Could not submit. Check your connection and try again. Your answers are still here.',
    missingRequired: 'Please answer the required questions.',
    missingCount: (n: number) => (n === 1 ? '1 question still needs an answer' : `${n} questions still need an answer`),
    waitUploads: 'A file is still uploading. Wait for it to finish, then submit.',
    failedUploads: 'A file did not upload. Try again or remove it, then submit.',
    uploadingTitle: 'A file is still uploading', uploadingBody: 'If you leave now, it will not be added to your answers.',
    draftKept: 'Your answers are kept as you go.', draftSaving: 'Keeping your answers…', draftFailed: 'Not kept yet. Check your connection.',
    unsavedTitle: 'Your answers are not kept', unsavedBody: 'Your latest answers have not reached the server. If you leave now, they will be lost.',
    stay: 'Stay', leaveAnyway: 'Leave anyway',
    unavailable: 'Resource unavailable',
    unavailableBody: 'This resource is no longer available.',
    reading: 'Reading',
    worksheet: 'Worksheet',
    submit: 'Submit',
    markDone: 'Mark as done',
    submittedOn: (d: string) => `Submitted on ${d}`,
    doneOn: (d: string) => `Done on ${d}`,
    alreadySubmitted: 'Already submitted',
    alreadyDone: 'Already marked as done',
    fromPractitioner: 'Message from your practitioner',
    onEarlier: (d: string) => `On your earlier answers · ${d}`,
    lockedNote: 'Your practitioner can reopen this if you need to change it.',
    resultTitle: 'All done',
    resultBodySuffix: ' is saved and shared with your practitioner.',
    yourScore: 'Your score',
    done: 'Done',
  },
  fr: {
    couldNotSubmit: 'Envoi impossible. Vérifiez votre connexion et réessayez. Vos réponses sont toujours là.',
    missingRequired: 'Merci de répondre aux questions obligatoires.',
    missingCount: (n: number) => (n === 1 ? '1 question attend encore une réponse' : `${n} questions attendent encore une réponse`),
    waitUploads: 'Un fichier est encore en cours d’envoi. Attendez la fin, puis envoyez.',
    failedUploads: 'Un fichier n’a pas été envoyé. Réessayez ou retirez-le, puis envoyez.',
    uploadingTitle: 'Un fichier est en cours d’envoi', uploadingBody: 'Si vous partez maintenant, il ne sera pas ajouté à vos réponses.',
    draftKept: 'Vos réponses sont conservées au fur et à mesure.', draftSaving: 'Conservation de vos réponses…', draftFailed: 'Pas encore conservé. Vérifiez votre connexion.',
    unsavedTitle: 'Vos réponses ne sont pas conservées', unsavedBody: 'Vos dernières réponses ne sont pas arrivées sur le serveur. Si vous partez maintenant, elles seront perdues.',
    stay: 'Rester', leaveAnyway: 'Partir quand même',
    unavailable: 'Ressource indisponible',
    unavailableBody: 'Cette ressource n’est plus disponible.',
    reading: 'Lecture',
    worksheet: 'Fiche',
    submit: 'Soumettre',
    markDone: 'Marquer comme fait',
    submittedOn: (d: string) => `Envoyé le ${d}`,
    doneOn: (d: string) => `Terminé le ${d}`,
    alreadySubmitted: 'Déjà envoyé',
    alreadyDone: 'Déjà marqué comme terminé',
    fromPractitioner: 'Message de votre praticien',
    onEarlier: (d: string) => `Sur vos réponses précédentes · ${d}`,
    lockedNote: 'Votre praticien peut le rouvrir si vous devez le modifier.',
    resultTitle: 'Terminé',
    resultBodySuffix: ' est enregistré et partagé avec votre praticien.',
    yourScore: 'Votre score',
    done: 'Terminé',
  },
} as const;

// The to-do card grows into this page, and leaving folds it back (ui/grow).
export default function ResourceDetail() {
  const { t: TT } = useTheme();
  const [origin] = useState(takeGrowOrigin);
  return (
    <GrowFrame origin={origin} kind="page" color={TT.bg}>
      <ResourceDetailPage />
    </GrowFrame>
  );
}

function ResourceDetailPage() {
  const { t: TT } = useTheme();
  const fold = useGrowFold();
  const router = useRouter();
  const { locale } = useI18n();
  const tr = T[locale];
  const { id } = useLocalSearchParams<{ id: string }>();
  const assignmentId = typeof id === 'string' ? id : '';

  const [view, setView] = useState<AssignmentView | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Every required question found empty at the last Submit. Kept as the list
  // found then, and read against the answers on every render, so a mark clears
  // the moment its question is answered and the count under it goes down.
  const [missingIds, setMissingIds] = useState<string[]>([]);
  const [result, setResult] = useState<{ score: PatientScore | null } | null>(null);
  const confirm = useConfirm();
  const insets = useSafeAreaInsets();
  // A state is not enough to stop a double tap: two taps in one frame both read
  // `submitting` as false and sent the answers twice.
  const submittingRef = useRef(false);
  // Submit was held for a file. Said only while it is still true, so the line
  // goes away by itself when the upload lands or the failed file is removed.
  const [uploadHold, setUploadHold] = useState(false);

  // --- where each question is ---------------------------------------------------
  // To bring the first missing one into view. onLayout gives each position
  // relative to its parent, so the chain is added up: the content wrapper in the
  // scroll view, the list in the wrapper, the question in the list.
  const scroller = useRef<ScrollView>(null);
  const wrapY = useRef(0);
  const listY = useRef(0);
  const blockY = useRef<Record<string, number>>({});
  const scrollToBlock = (blockId: string) => {
    const y = blockY.current[blockId];
    if (y === undefined) return;
    // The header scrolls with the page, so only the status bar sits over the
    // top of it. Nudged a little lower so the question's label is not flush
    // against the edge.
    const top = Math.max(0, wrapY.current + listY.current + y - insets.top - 16);
    // With the keyboard up the view is about to grow back; scrolling in the same
    // frame lands short on a phone, so it waits for the keyboard to go.
    const keyboardUp = Platform.OS !== 'web' && Keyboard.isVisible();
    Keyboard.dismiss();
    setTimeout(() => scroller.current?.scrollTo({ y: top, animated: true }), keyboardUp ? 280 : 0);
  };

  // --- uploads ----------------------------------------------------------------
  // Files upload while the patient carries on, and only reach the answers once
  // stored. So a Submit, a way out, or a draft in the middle of one would all
  // silently leave the file behind; the screen needs to know they are running.
  const uploadsRef = useRef<Record<string, UploadStatus>>({});
  const [uploads, setUploads] = useState<UploadStatus>({ uploading: 0, failed: 0 });
  const reportUpload = useCallback((blockId: string, st: UploadStatus) => {
    uploadsRef.current = { ...uploadsRef.current, [blockId]: st };
    const all = Object.values(uploadsRef.current);
    setUploads({ uploading: all.reduce((n, x) => n + x.uploading, 0), failed: all.reduce((n, x) => n + x.failed, 0) });
  }, []);

  // --- keeping answers --------------------------------------------------------
  // Answers used to live only in this screen until Submit, so Back, the OS
  // reclaiming the app behind the photo picker, or a Submit that failed offline
  // lost all of them. They are now kept on the server as a draft while the
  // patient writes (invisible to the practitioner until sent), the same way the
  // journal saves: debounced, queued, retried, and counted so only real changes
  // are sent.
  type Keep = 'idle' | 'saving' | 'saved' | 'failed';
  const [keep, setKeep] = useState<Keep>('idle');
  const latest = useRef<Record<string, unknown>>({});
  const edits = useRef(0);
  const savedEdits = useRef(0);
  const chain = useRef<Promise<boolean>>(Promise.resolve(true));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retry = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);
  const everLoaded = useRef(false);

  const clearTimers = () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    if (retry.current) { clearTimeout(retry.current); retry.current = null; }
  };

  const keepOnce = async (): Promise<boolean> => {
    const carried = edits.current;
    if (carried === savedEdits.current) {
      if (mounted.current) setKeep((k) => (k === 'saving' || k === 'failed' ? (savedEdits.current > 0 ? 'saved' : 'idle') : k));
      return true;
    }
    // A copy on the phone first, so answers survive the app being killed before
    // the server has them (see src/unsent). Removed once they land.
    await saveUnsent('worksheet', assignmentId, latest.current);
    const res = await saveAssignmentDraft(assignmentId, latest.current, locale);
    // Sent or withdrawn meanwhile: nothing to keep, and retrying cannot help.
    if (res.ok || res.final) savedEdits.current = Math.max(savedEdits.current, carried);
    if ((res.ok || res.final) && edits.current === carried) void clearUnsent('worksheet', assignmentId);
    if (!mounted.current) return res.ok;
    if (res.ok || res.final) {
      setKeep(edits.current === savedEdits.current ? (res.ok ? 'saved' : 'idle') : 'saving');
      if (res.ok) refreshFileLinks();
      return true;
    }
    setKeep('failed');
    if (retry.current) clearTimeout(retry.current);
    retry.current = setTimeout(() => { void keepNow(); }, 8000);
    return false;
  };
  // A file added here has no signed link until the server has it. Photos and
  // videos preview from the phone's copy meanwhile, but a document can only be
  // opened by its link, so once a draft carrying new files lands the page is
  // read again for their links. Only then: every save would be a wasted read.
  const viewRef = useRef<AssignmentView | null>(null);
  viewRef.current = view;
  const refreshFileLinks = () => {
    const v = viewRef.current;
    if (!v) return;
    const known = fileUrlIndex(v.version.blocks, v.response?.answers, v.fileUrls, v.mediaUrls);
    const unsigned = v.version.blocks.some((b) => b.type === 'file_upload' && filesOf(latest.current[b.id]).some((f) => !known[f.key]));
    if (!unsigned) return;
    void fetchAssignment(assignmentId).then((fresh) => { if (fresh && mounted.current) setView(fresh); });
  };

  const keepNow = (): Promise<boolean> => {
    const next = chain.current.then(keepOnce, keepOnce);
    chain.current = next;
    return next;
  };
  const keepNowRef = useRef(keepNow);
  keepNowRef.current = keepNow;

  useEffect(() => {
    // Backgrounding is when the OS may end the app; send what is pending first.
    const sub = AppState.addEventListener('change', (st) => { if (st !== 'active') { clearTimers(); void keepNow(); } });
    return () => {
      sub.remove();
      mounted.current = false;
      clearTimers();
      void keepNow();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      fetchAssignment(assignmentId).then((v) => {
        if (!alive) return;
        // A refetch on returning to the screen (from the photo picker, from
        // another tab) must not replace what was typed with the server's older
        // copy, and a refetch that fails must not blank a screen that loaded.
        if (!v) { if (!everLoaded.current) { setView(null); setLoaded(true); } return; }
        setView(v);
        if (!everLoaded.current) {
          everLoaded.current = true;
          const initial = v.response?.answers ?? {};
          latest.current = initial;
          setAnswers(initial);
          const closed = v.locked ?? (v.response?.status === 'submitted' || v.response?.status === 'reviewed');
          // Answers kept on this phone that never reached the server come back
          // and are sent again. Not onto a response that has since been sent, and
          // not over answers written since (on another phone, or on the web by
          // the practitioner): a copy stranded for a week used to win anyway.
          const serverAt = v.response?.updatedAt;
          void readUnsent<Record<string, unknown>>('worksheet', assignmentId).then((kept) => {
            if (!kept || !alive) return;
            if (closed || (serverAt && kept.savedAt <= serverAt)) { void clearUnsent('worksheet', assignmentId); return; }
            latest.current = { ...initial, ...kept.payload };
            setAnswers(latest.current);
            edits.current += 1;
            setKeep('saving');
            // The copy can name files uploaded before the app was closed. They
            // are in storage (a file only joins the answers once it is), and
            // once the copy lands the page is read again for their links (see
            // refreshFileLinks).
            void keepNowRef.current();
          });
        }
        setLoaded(true);
      });
      return () => { alive = false; };
    }, [assignmentId]),
  );

  const blocks = view?.version.blocks ?? [];
  const readNumber = (v: unknown) => (typeof v === 'number' ? v : typeof v === 'string' ? parseTypedNumber(v, locale) : undefined);
  const shownMissing = missingIds.filter((mid) => {
    const b = blocks.find((x) => x.id === mid);
    return !!b && !isAnswered(b, answers[mid], readNumber);
  });
  // Links for files already on the server, by storage key, read against the
  // answers the server signed them for (see `urlsByKey`).
  const fileUrls = useMemo(
    () => (view ? fileUrlIndex(view.version.blocks, view.response?.answers, view.fileUrls, view.mediaUrls) : {}),
    [view],
  );
  const hasInteractive = useMemo(() => (view?.version.blocks ?? []).some((b) => INTERACTIVE.has(b.type)), [view]);
  // Finished either way: a worksheet leaves a submitted response, while a
  // reading-only resource leaves no row at all and only flips the assignment.
  const sentStatus = view?.response?.status === 'submitted' || view?.response?.status === 'reviewed';
  const locked = view?.locked ?? sentStatus;
  const finished = sentStatus || view?.assignment.status === 'completed';
  const finishedAt = formatDone(view?.response?.submittedAt ?? view?.assignment.completedAt, locale);
  const finishedLabel = finishedAt
    ? (hasInteractive ? tr.submittedOn(finishedAt) : tr.doneOn(finishedAt))
    : hasInteractive
      ? tr.alreadySubmitted
      : tr.alreadyDone;
  const set = (blockId: string, value: unknown) => {
    const next = { ...latest.current, [blockId]: value };
    latest.current = next;
    setAnswers(next);
    if (locked || !hasInteractive) return;
    edits.current += 1;
    setKeep('saving');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { timer.current = null; void keepNow(); }, 1200);
  };

  const firstUploadBlock = (key: keyof UploadStatus) => blocks.find((b) => (uploadsRef.current[b.id]?.[key] ?? 0) > 0)?.id;

  const submit = async () => {
    if (submittingRef.current) return;
    setError(null);
    // Canvas text typed but not added counts as written.
    flushCanvasDrafts();
    // A file on its way is not in the answers yet: sending now would send the
    // worksheet without it, and a failed one would be missing without a word.
    const up = Object.values(uploadsRef.current);
    if (up.some((u) => u.uploading > 0) || up.some((u) => u.failed > 0)) {
      const waiting = up.some((u) => u.uploading > 0);
      setUploadHold(true);
      const at = firstUploadBlock(waiting ? 'uploading' : 'failed');
      if (at) scrollToBlock(at);
      return;
    }
    // Every empty required question, marked at once and the first one brought
    // into view, before asking the server (which would name only the first).
    const gaps = missingRequired(blocks, latest.current, readNumber, INTERACTIVE);
    if (gaps.length) {
      setMissingIds(gaps);
      scrollToBlock(gaps[0]);
      return;
    }
    setMissingIds([]);
    setUploadHold(false);
    submittingRef.current = true;
    setSubmitting(true);
    Keyboard.dismiss();
    // Anything waiting to be kept goes first, so a Submit that fails still
    // leaves the latest answers on the server.
    clearTimers();
    await keepNow();
    const res = await submitAssignment(assignmentId, latest.current, locale);
    if (res.ok) {
      track('worksheet_submitted', { scored: res.score != null });
      savedEdits.current = edits.current;
      void clearUnsent('worksheet', assignmentId);
      guard.release();
      setResult({ score: res.score ?? null });
      return;
    }
    submittingRef.current = false;
    setSubmitting(false);
    // The server reads the rules this screen does, so this is only reached when
    // the two disagree (a question it treats differently): mark what it named.
    const named = res.missingBlockId ? blocks.find((b) => b.id === res.missingBlockId) : undefined;
    if (named) {
      setMissingIds([named.id]);
      scrollToBlock(named.id);
    }
    // The count under Submit says it when the mark can show; when this screen
    // reads the named answer as filled (so no mark), the sentence still does.
    const markShows = !!named && !isAnswered(named, latest.current[named.id], readNumber);
    // In the patient's language. The server's own sentences are English only.
    setError(
      res.reason === 'missing_required' ? (markShows ? null : tr.missingRequired)
      : res.reason === 'revoked' ? tr.unavailableBody
      : res.reason === 'already_submitted' ? tr.lockedNote
      : tr.couldNotSubmit,
    );
  };

  const leaveNow = () => (router.canGoBack() ? router.back() : router.navigate('/home' as never));
  // While answers or a file are still being kept, leaving goes straight to the
  // guard below, which may ask to stay: folding the page away first would leave
  // someone who chose to stay looking at a card.
  const holding = !result && (keep === 'saving' || keep === 'failed' || uploads.uploading > 0);
  const back = () => (holding ? leaveNow() : fold(leaveNow));
  const backRef = useRef(back);
  backRef.current = back;
  useFocusEffect(useCallback(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { backRef.current(); return true; });
    return () => sub.remove();
  }, []));

  // Leaving with answers not yet kept: keep them, then go; ask only if that fails.
  // A file still uploading is held the same way: leaving drops it, so that is
  // said first and only a deliberate "leave anyway" goes.
  const guard = useLeaveGuard(holding, async (leave) => {
    clearTimers();
    if (Object.values(uploadsRef.current).some((u) => u.uploading > 0)) {
      const go = await confirm({ title: tr.uploadingTitle, message: tr.uploadingBody, confirmLabel: tr.leaveAnyway, cancelLabel: tr.stay, destructive: true });
      if (!go) return;
      await keepNow();
      leave();
      return;
    }
    if (await keepNow()) { leave(); return; }
    const yes = await confirm({ title: tr.unsavedTitle, message: tr.unsavedBody, confirmLabel: tr.leaveAnyway, cancelLabel: tr.stay, destructive: true });
    if (yes) leave();
  });

  if (!loaded) {
    return (
      <View style={{ flex: 1, backgroundColor: TT.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={TT.accent} />
      </View>
    );
  }
  if (!view) {
    return (
      <View style={{ flex: 1, backgroundColor: TT.bg }}>
        <EdHeader kicker={tr.unavailable} title={tr.unavailable} onBack={back} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: TT.ink }}>{tr.unavailable}</Text>
          <Text style={{ fontSize: 13.5, color: TT.inkSoft, marginTop: 6, textAlign: 'center' }}>{tr.unavailableBody}</Text>
        </View>
      </View>
    );
  }

  if (result) return <ResultView title={view.resource.title} score={result.score} onDone={back} tr={tr} />;

  const kicker = view.resource.type === 'psychoeducation' ? tr.reading : tr.worksheet;


  return (
    <View style={{ flex: 1, backgroundColor: TT.bg }}>
      {/* `padding` on Android too; `undefined` does nothing there and the last
          answer fields sat under the keyboard. */}
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <ScrollView ref={scroller} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <EdHeader source={ONBOARDING_IMAGES.card2} kicker={kicker} title={view.resource.title} onBack={back} />

          <View onLayout={(e) => { wrapY.current = e.nativeEvent.layout.y; }}>
          <FadeIn style={{ paddingHorizontal: 22, paddingTop: 20 }}>
            <OtherPractitionerNote practitioner={view.practitioner} />
            {view.response?.practitionerNote ? (
              // Deliberately unlike the description card above it. Both were the
              // same green tint, so the one thing written personally to this
              // patient read as more page furniture. A white card, a solid green
              // spine, their practitioner named, and it sits ABOVE the exercise.
              <View style={{ flexDirection: 'row', backgroundColor: TT.card, borderRadius: 16, borderWidth: 1, borderColor: TT.line, overflow: 'hidden', marginBottom: 22 }}>
                <View style={{ width: 4, backgroundColor: TT.accent }} />
                <View style={{ flex: 1, paddingVertical: 14, paddingHorizontal: 15 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 7 }}>
                    <MessageCircle size={13} color={TT.accent} strokeWidth={2.5} />
                    <Text style={{ fontSize: 12, fontWeight: '800', color: TT.accentDeep, letterSpacing: 0.2 }}>{tr.fromPractitioner}</Text>
                  </View>
                  {/* Answers sent since the message: it replies to the earlier ones,
                      and read beside the new answers it would seem to answer them. */}
                  {view.response.noteOnEarlierAnswers && view.response.noteWrittenAt ? (
                    <Text style={{ fontSize: 12, color: TT.faint, marginBottom: 6 }}>
                      {tr.onEarlier(new Date(view.response.noteWrittenAt).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-GB', { day: 'numeric', month: 'long' }))}
                    </Text>
                  ) : null}
                  <Text style={{ fontSize: 16, color: TT.ink, lineHeight: 25 }}>{view.response.practitionerNote}</Text>
                </View>
              </View>
            ) : null}
            <ResourceIntro text={view.resource.description} />
            {finished && (
              <View style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: TT.accentTint, borderRadius: 12, paddingVertical: 5, paddingHorizontal: 10, marginBottom: 16 }}>
                <Check size={13} color={TT.accent} strokeWidth={3} />
                <Text style={{ fontSize: 12, fontWeight: '700', color: TT.accent }}>{finishedLabel}</Text>
              </View>
            )}

            <View onLayout={(e) => { listY.current = e.nativeEvent.layout.y; }}>
              {blocks.map((b) => (
                <View key={b.id} onLayout={(e) => { blockY.current[b.id] = e.nativeEvent.layout.y; }}>
                  <Block
                    block={b}
                    value={answers[b.id]}
                    onChange={(v) => set(b.id, v)}
                    missing={shownMissing.includes(b.id)}
                    readOnly={locked}
                    mediaUrl={view.mediaUrls?.[b.id]}
                    fileUrls={fileUrls}
                    onUploadStatus={b.type === 'file_upload' ? (st) => reportUpload(b.id, st) : undefined}
                  />
                </View>
              ))}
            </View>

            {error && <Text style={{ marginTop: 14, fontSize: 13.5, fontWeight: '600', color: DANGER }}>{error}</Text>}
          </FadeIn>
          </View>
        </ScrollView>

        <View style={{ paddingHorizontal: 22, paddingTop: 12, paddingBottom: 10, borderTopWidth: 1, borderTopColor: TT.line }}>
          {/* How many are left, where the thumb is. Tapping it goes to the next
              one, which on a long worksheet is the part that is hard to find. */}
          {shownMissing.length > 0 ? (
            <Pressable onPress={() => scrollToBlock(shownMissing[0])} accessibilityRole="button" accessibilityLiveRegion="polite" style={{ alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: TT.dangerTint, borderRadius: 14, paddingVertical: 6, paddingHorizontal: 12, marginBottom: 10 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: TT.danger }} />
              <Text style={{ fontSize: 13, fontWeight: '700', color: TT.danger }}>{tr.missingCount(shownMissing.length)}</Text>
            </Pressable>
          ) : null}
          {uploadHold && (uploads.uploading > 0 || uploads.failed > 0) ? (
            <Text accessibilityLiveRegion="polite" style={{ fontSize: 13, fontWeight: '600', color: TT.danger, textAlign: 'center', marginBottom: 10 }}>
              {uploads.uploading > 0 ? tr.waitUploads : tr.failedUploads}
            </Text>
          ) : null}
          {hasInteractive && !locked && keep !== 'idle' ? (
            <Text style={{ fontSize: 12, color: keep === 'failed' ? DANGER : TT.faint, textAlign: 'center', marginBottom: 8 }}>
              {keep === 'failed' ? tr.draftFailed : keep === 'saving' ? tr.draftSaving : tr.draftKept}
            </Text>
          ) : null}
          {finished ? (
            // Offering "Submit" again on something already finished reads as if
            // the first one did not take. The state comes first; re-submitting
            // stays possible for a worksheet, but as a deliberate second step.
            <View style={{ gap: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 54, borderRadius: 27, backgroundColor: TT.accentTint, paddingHorizontal: 18 }}>
                <CircleCheckBig size={18} color={TT.accent} strokeWidth={2.5} />
                <Text style={{ fontSize: 15, fontWeight: '700', color: TT.accentDeep, textAlign: 'center' }}>{finishedLabel}</Text>
              </View>
              {hasInteractive && locked && (
                // Deliberately not a button. A sent response belongs to the
                // practitioner until they hand it back, so offering "update"
                // here would promise something the server refuses.
                <Text style={{ fontSize: 12.5, color: TT.faint, textAlign: 'center' }}>{tr.lockedNote}</Text>
              )}
              {hasInteractive && !locked && (
                <Pressable onPress={submit} disabled={submitting} style={{ height: 48, borderRadius: 24, borderWidth: 1.5, borderColor: TT.line, alignItems: 'center', justifyContent: 'center' }}>
                  {submitting ? <ActivityIndicator color={TT.ink} /> : <Text style={{ fontSize: 15, fontWeight: '700', color: TT.ink }}>{tr.submit}</Text>}
                </Pressable>
              )}
            </View>
          ) : (
            <Pressable onPress={submit} disabled={submitting} style={{ height: 54, borderRadius: 27, backgroundColor: submitting ? TT.faint : TT.ctaBg, alignItems: 'center', justifyContent: 'center' }}>
              {submitting ? <ActivityIndicator color={TT.ctaFg} /> : <Text style={{ fontSize: 15.5, fontWeight: '700', color: TT.ctaFg }}>{hasInteractive ? tr.submit : tr.markDone}</Text>}
            </Pressable>
          )}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

function ResultView({ title, score, onDone, tr }: { title: string; score: PatientScore | null; onDone: () => void; tr: (typeof T)[keyof typeof T] }) {
  const { t: TT } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: TT.bg }}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
        <View style={{ width: 76, height: 76, borderRadius: 38, backgroundColor: TT.accentTint, alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
          <CircleCheckBig size={34} color={TT.accent} strokeWidth={2} />
        </View>
        <Text style={{ fontSize: 22, fontWeight: '800', color: TT.ink, textAlign: 'center', letterSpacing: -0.3 }}>{tr.resultTitle}</Text>
        <Text style={{ fontSize: 14, color: TT.inkSoft, textAlign: 'center', marginTop: 6 }}>{title}{tr.resultBodySuffix}</Text>

        {score && (
          <View style={{ marginTop: 24, alignSelf: 'stretch', backgroundColor: TT.card, borderWidth: 1, borderColor: TT.line, borderRadius: 20, padding: 22, alignItems: 'center' }}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: TT.faint, letterSpacing: 0.2 }}>{tr.yourScore}</Text>
            <Text style={{ fontSize: 40, fontWeight: '800', color: TT.accent, marginTop: 6 }}>{score.total}<Text style={{ fontSize: 20, color: TT.faint, fontWeight: '700' }}> / {score.maxScore}</Text></Text>
            {score.interpretation && <Text style={{ fontSize: 15, fontWeight: '700', color: TT.ink, marginTop: 8 }}>{score.interpretation.label}</Text>}
            {score.interpretation?.note && <Text style={{ fontSize: 13, color: TT.inkSoft, textAlign: 'center', marginTop: 4, lineHeight: 19 }}>{score.interpretation.note}</Text>}
          </View>
        )}
      </View>
      <View style={{ paddingHorizontal: 22, paddingBottom: 24 }}>
        <EdPill label={tr.done} variant="dark" onPress={onDone} />
      </View>
    </View>
  );
}

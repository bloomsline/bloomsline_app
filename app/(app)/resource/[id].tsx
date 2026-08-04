// Assigned-resource detail + response flow. Opens an assigned resource, renders
// the frozen version's blocks (shared renderer), collects answers, and submits →
// server validates + scores → shows the result. Reached from My Care "To do".
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Check, CircleCheckBig, MessageCircle } from 'lucide-react-native';
import { EDA, EdHeader, EdPill, FadeIn } from '@/src/ui/editorial';
import { ONBOARDING_IMAGES } from '@/src/onboarding/editorial/images';
import { Block, INTERACTIVE, ResourceIntro } from '@/src/resources/blocks';
import { fetchAssignment, submitAssignment, type AssignmentView, type PatientScore } from '@/src/api/resources';
import { useI18n } from '@/src/i18n';

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
    couldNotSubmit: 'Could not submit. Please try again.',
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
    lockedNote: 'Your practitioner can reopen this if you need to change it.',
    resultTitle: 'All done',
    resultBodySuffix: ' is saved and shared with your practitioner.',
    yourScore: 'Your score',
    done: 'Done',
  },
  fr: {
    couldNotSubmit: 'Envoi impossible. Veuillez réessayer.',
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
    lockedNote: 'Votre praticien peut le rouvrir si vous devez le modifier.',
    resultTitle: 'Terminé',
    resultBodySuffix: ' est enregistré et partagé avec votre praticien.',
    yourScore: 'Votre score',
    done: 'Terminé',
  },
} as const;

export default function ResourceDetail() {
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
  const [missingId, setMissingId] = useState<string | null>(null);
  const [result, setResult] = useState<{ score: PatientScore | null } | null>(null);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      fetchAssignment(assignmentId).then((v) => {
        if (!alive) return;
        setView(v);
        setAnswers(v?.response?.answers ?? {});
        setLoaded(true);
      });
      return () => { alive = false; };
    }, [assignmentId]),
  );

  const blocks = view?.version.blocks ?? [];
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
  const set = (blockId: string, value: unknown) => setAnswers((prev) => ({ ...prev, [blockId]: value }));

  const submit = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    setMissingId(null);
    const res = await submitAssignment(assignmentId, answers);
    if (res.ok) { setResult({ score: res.score ?? null }); return; }
    setSubmitting(false);
    if (res.missingBlockId) setMissingId(res.missingBlockId);
    setError(res.error ?? tr.couldNotSubmit);
  };

  const back = () => (router.canGoBack() ? router.back() : router.navigate('/home' as never));

  if (!loaded) {
    return (
      <View style={{ flex: 1, backgroundColor: EDA.canvas, alignItems: 'center', justifyContent: 'center' }}>
        <StatusBar style="dark" />
        <ActivityIndicator color={EDA.green} />
      </View>
    );
  }
  if (!view) {
    return (
      <View style={{ flex: 1, backgroundColor: EDA.canvas }}>
        <StatusBar style="dark" />
        <EdHeader kicker={tr.unavailable} title={tr.unavailable} onBack={back} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: EDA.ink }}>{tr.unavailable}</Text>
          <Text style={{ fontSize: 13.5, color: EDA.inkSoft, marginTop: 6, textAlign: 'center' }}>{tr.unavailableBody}</Text>
        </View>
      </View>
    );
  }

  if (result) return <ResultView title={view.resource.title} score={result.score} onDone={() => (router.canGoBack() ? router.back() : router.navigate('/home' as never))} tr={tr} />;

  const kicker = view.resource.type === 'psychoeducation' ? tr.reading : tr.worksheet;

  return (
    <View style={{ flex: 1, backgroundColor: EDA.canvas }}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <EdHeader source={ONBOARDING_IMAGES.card2} kicker={kicker} title={view.resource.title} onBack={back} />

          <FadeIn style={{ paddingHorizontal: 22, paddingTop: 20 }}>
            {view.response?.practitionerNote ? (
              // Deliberately unlike the description card above it. Both were the
              // same green tint, so the one thing written personally to this
              // patient read as more page furniture. A white card, a solid green
              // spine, their practitioner named, and it sits ABOVE the exercise.
              <View style={{ flexDirection: 'row', backgroundColor: EDA.card, borderRadius: 16, borderWidth: 1, borderColor: EDA.line, overflow: 'hidden', marginBottom: 22 }}>
                <View style={{ width: 4, backgroundColor: EDA.green }} />
                <View style={{ flex: 1, paddingVertical: 14, paddingHorizontal: 15 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 7 }}>
                    <MessageCircle size={13} color={EDA.green} strokeWidth={2.5} />
                    <Text style={{ fontSize: 12, fontWeight: '800', color: EDA.greenDeep, letterSpacing: 0.2 }}>{tr.fromPractitioner}</Text>
                  </View>
                  <Text style={{ fontSize: 16, color: EDA.ink, lineHeight: 25 }}>{view.response.practitionerNote}</Text>
                </View>
              </View>
            ) : null}
            <ResourceIntro text={view.resource.description} />
            {finished && (
              <View style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: EDA.greenTint, borderRadius: 12, paddingVertical: 5, paddingHorizontal: 10, marginBottom: 16 }}>
                <Check size={13} color={EDA.green} strokeWidth={3} />
                <Text style={{ fontSize: 12, fontWeight: '700', color: EDA.green }}>{finishedLabel}</Text>
              </View>
            )}

            {blocks.map((b) => (
              <Block key={b.id} block={b} value={answers[b.id]} onChange={(v) => set(b.id, v)} missing={missingId === b.id} readOnly={locked} mediaUrl={view.mediaUrls?.[b.id]} />
            ))}

            {error && <Text style={{ marginTop: 14, fontSize: 13.5, fontWeight: '600', color: DANGER }}>{error}</Text>}
          </FadeIn>
        </ScrollView>

        <View style={{ paddingHorizontal: 22, paddingTop: 12, paddingBottom: 10, borderTopWidth: 1, borderTopColor: EDA.line }}>
          {finished ? (
            // Offering "Submit" again on something already finished reads as if
            // the first one did not take. The state comes first; re-submitting
            // stays possible for a worksheet, but as a deliberate second step.
            <View style={{ gap: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 54, borderRadius: 27, backgroundColor: EDA.greenTint, paddingHorizontal: 18 }}>
                <CircleCheckBig size={18} color={EDA.green} strokeWidth={2.5} />
                <Text style={{ fontSize: 15, fontWeight: '700', color: EDA.greenDeep, textAlign: 'center' }}>{finishedLabel}</Text>
              </View>
              {hasInteractive && locked && (
                // Deliberately not a button. A sent response belongs to the
                // practitioner until they hand it back, so offering "update"
                // here would promise something the server refuses.
                <Text style={{ fontSize: 12.5, color: EDA.faint, textAlign: 'center' }}>{tr.lockedNote}</Text>
              )}
              {hasInteractive && !locked && (
                <Pressable onPress={submit} disabled={submitting} style={{ height: 48, borderRadius: 24, borderWidth: 1.5, borderColor: EDA.line, alignItems: 'center', justifyContent: 'center' }}>
                  {submitting ? <ActivityIndicator color={EDA.ink} /> : <Text style={{ fontSize: 15, fontWeight: '700', color: EDA.ink }}>{tr.submit}</Text>}
                </Pressable>
              )}
            </View>
          ) : (
            <Pressable onPress={submit} disabled={submitting} style={{ height: 54, borderRadius: 27, backgroundColor: submitting ? EDA.faint : EDA.ink, alignItems: 'center', justifyContent: 'center' }}>
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={{ fontSize: 15.5, fontWeight: '700', color: '#fff' }}>{hasInteractive ? tr.submit : tr.markDone}</Text>}
            </Pressable>
          )}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

function ResultView({ title, score, onDone, tr }: { title: string; score: PatientScore | null; onDone: () => void; tr: (typeof T)[keyof typeof T] }) {
  return (
    <View style={{ flex: 1, backgroundColor: EDA.canvas }}>
      <StatusBar style="dark" />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
        <View style={{ width: 76, height: 76, borderRadius: 38, backgroundColor: EDA.greenTint, alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
          <CircleCheckBig size={34} color={EDA.green} strokeWidth={2} />
        </View>
        <Text style={{ fontSize: 22, fontWeight: '800', color: EDA.ink, textAlign: 'center', letterSpacing: -0.3 }}>{tr.resultTitle}</Text>
        <Text style={{ fontSize: 14, color: EDA.inkSoft, textAlign: 'center', marginTop: 6 }}>{title}{tr.resultBodySuffix}</Text>

        {score && (
          <View style={{ marginTop: 24, alignSelf: 'stretch', backgroundColor: EDA.card, borderWidth: 1, borderColor: EDA.line, borderRadius: 20, padding: 22, alignItems: 'center' }}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: EDA.faint, textTransform: 'uppercase', letterSpacing: 0.5 }}>{tr.yourScore}</Text>
            <Text style={{ fontSize: 40, fontWeight: '800', color: EDA.green, marginTop: 6 }}>{score.total}<Text style={{ fontSize: 20, color: EDA.faint, fontWeight: '700' }}> / {score.maxScore}</Text></Text>
            {score.interpretation && <Text style={{ fontSize: 15, fontWeight: '700', color: EDA.ink, marginTop: 8 }}>{score.interpretation.label}</Text>}
            {score.interpretation?.note && <Text style={{ fontSize: 13, color: EDA.inkSoft, textAlign: 'center', marginTop: 4, lineHeight: 19 }}>{score.interpretation.note}</Text>}
          </View>
        )}
      </View>
      <View style={{ paddingHorizontal: 22, paddingBottom: 24 }}>
        <EdPill label={tr.done} variant="dark" onPress={onDone} />
      </View>
    </View>
  );
}

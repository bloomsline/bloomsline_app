// e4 — Library activity. Render a self-guided practice, do it, and save a PRIVATE
// run (/api/mobile/library/[id]/run) — kept to the patient, never seen by the
// practitioner. Repeatable. Wired to GET /api/mobile/library/[id].
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Lock, CircleCheckBig } from 'lucide-react-native';
import { notify } from '@/src/ui/alert';
import { EdHeader, EdPill, FadeIn } from '@/src/ui/editorial';
import { ONBOARDING_IMAGES } from '@/src/onboarding/editorial/images';
import { resourceTypeMeta } from '@/src/care/resources';
import { flushCanvasDrafts } from '@/src/resources/zoned-canvas-field';
import { Block, INTERACTIVE, ResourceIntro, type UploadStatus } from '@/src/resources/blocks';
import { getLibraryResource, runLibraryActivity, type LibraryResourceView } from '@/src/api/library';
import type { PatientScore } from '@/src/api/resources';
import { useI18n } from '@/src/i18n';
import { useTheme } from '@/src/ui/theme-mode';
import { OtherPractitionerNote } from '@/src/care/OtherPractitionerNote';
import { useLeaveGuard } from '@/src/ui/leave-guard';
import { useConfirm } from '@/src/ui/confirm';
import { track } from '@/src/analytics/client';

const T = {
  en: {
    couldNotSave: 'Could not save.',
    saveGone: 'This activity is no longer available, so your answers could not be saved.',
    saveBusy: 'Too many tries in a row. Wait a moment and save again.',
    saveOffline: 'Could not reach Bloomsline. Check your connection and save again.',
    waitUploads: 'A file is still uploading. Wait for it to finish, then save.',
    uploadingTitle: 'A file is still uploading', uploadingBody: 'If you leave now, it will not be saved with this practice.',
    stay: 'Stay', leaveAnyway: 'Leave anyway',
    failedUploads: 'A file did not upload. Try again or remove it, then save.',
    unavailable: 'Activity unavailable',
    privateToYou: 'Private to you',
    doneCount: 'done',
    save: 'Save',
    markDone: 'Mark as done',
    resultTitle: 'Nicely done',
    resultBodySuffix: ' is saved and kept private to you. Come back to it anytime.',
    justForYou: 'Just for you',
    done: 'Done',
  },
  fr: {
    couldNotSave: 'Enregistrement impossible.',
    saveGone: 'Cette activité n’est plus disponible, vos réponses n’ont donc pas pu être enregistrées.',
    saveBusy: 'Trop d’essais d’affilée. Patientez un instant et enregistrez à nouveau.',
    saveOffline: 'Impossible de joindre Bloomsline. Vérifiez votre connexion et enregistrez à nouveau.',
    waitUploads: 'Un fichier est encore en cours d’envoi. Attendez la fin, puis enregistrez.',
    uploadingTitle: 'Un fichier est en cours d’envoi', uploadingBody: 'Si vous partez maintenant, il ne sera pas enregistré avec cet exercice.',
    stay: 'Rester', leaveAnyway: 'Partir quand même',
    failedUploads: 'Un fichier n’a pas été envoyé. Réessayez ou retirez-le, puis enregistrez.',
    unavailable: 'Activité indisponible',
    privateToYou: 'Privé',
    doneCount: 'fait',
    save: 'Enregistrer',
    markDone: 'Marquer comme fait',
    resultTitle: 'Bravo',
    resultBodySuffix: ' est enregistré et reste privé. Revenez-y quand vous voulez.',
    justForYou: 'Rien que pour vous',
    done: 'Terminé',
  },
} as const;

export default function LibraryPractice() {
  const { t: TT } = useTheme();
  const router = useRouter();
  const { locale } = useI18n();
  const tr = T[locale];
  const { id } = useLocalSearchParams<{ id?: string }>();
  const resourceId = typeof id === 'string' ? id : '';

  const [view, setView] = useState<LibraryResourceView | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ score: PatientScore | null } | null>(null);

  useEffect(() => {
    let alive = true;
    getLibraryResource(resourceId).then((v) => { if (alive) { setView(v); setLoaded(true); } });
    return () => { alive = false; };
  }, [resourceId]);

  const blocks = view?.version.blocks ?? [];
  const hasInteractive = useMemo(() => (view?.version.blocks ?? []).some((b) => INTERACTIVE.has(b.type)), [view]);
  // Read through a ref at save time, so answers set a moment before (canvas text
  // flushed on Save) are included rather than the last render's copy.
  const latestAnswers = useRef<Record<string, unknown>>({});
  const set = (blockId: string, value: unknown) => {
    latestAnswers.current = { ...latestAnswers.current, [blockId]: value };
    setAnswers(latestAnswers.current);
  };

  // Files join the answers only once uploaded, so a Save in the middle of one
  // would keep the run without it. There are no required questions to check
  // here: a self-guided practice saves whatever was done.
  const uploads = useRef<Record<string, UploadStatus>>({});
  // Mirrored in state for the leave guard below, which must re-render to arm.
  const [uploadingNow, setUploadingNow] = useState(false);
  const confirm = useConfirm();
  // Leaving mid-upload asks, as the worksheet screen does. Without it the file
  // was simply dropped, with nothing said.
  useLeaveGuard(!result && uploadingNow, async (leave) => {
    const go = await confirm({ title: tr.uploadingTitle, message: tr.uploadingBody, confirmLabel: tr.leaveAnyway, cancelLabel: tr.stay, destructive: true });
    if (go) leave();
  });
  // A ref, not the `saving` state: two taps in one frame both read the state as
  // false, and the run was saved twice.
  const savingRef = useRef(false);

  const save = async () => {
    if (savingRef.current) return;
    flushCanvasDrafts();
    const up = Object.values(uploads.current);
    if (up.some((u) => u.uploading > 0)) { notify(tr.waitUploads); return; }
    if (up.some((u) => u.failed > 0)) { notify(tr.failedUploads); return; }
    savingRef.current = true;
    setSaving(true);
    const res = await runLibraryActivity(resourceId, latestAnswers.current, view?.version.id, locale);
    if (res.ok) { track('library_activity_completed', { scored: res.score != null }); setResult({ score: res.score ?? null }); return; }
    savingRef.current = false;
    setSaving(false);
    notify(res.reason === 'gone' ? tr.saveGone : res.reason === 'busy' ? tr.saveBusy : res.reason === 'offline' ? tr.saveOffline : tr.couldNotSave);
  };

  const back = () => (router.canGoBack() ? router.back() : router.navigate('/library' as never));

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
        </View>
      </View>
    );
  }

  if (result) return <ResultView title={view.resource.title} score={result.score} onDone={back} tr={tr} />;

  const meta = resourceTypeMeta(view.resource.type, locale);

  return (
    <View style={{ flex: 1, backgroundColor: TT.bg }}>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <EdHeader source={ONBOARDING_IMAGES.card4} kicker={meta.label} title={view.resource.title} onBack={back} />

          <FadeIn style={{ paddingHorizontal: 22, paddingTop: 20 }}>
            {/* Whose library this comes from, when it is not the practitioner
                selected (opened from a link). */}
            <OtherPractitionerNote practitioner={view.practitioner} />
            {/* Private-to-you note */}
            <View style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: TT.accentTint, borderRadius: 12, paddingVertical: 5, paddingHorizontal: 10, marginBottom: 16 }}>
              <Lock size={12} color={TT.accent} strokeWidth={2} />
              <Text style={{ fontSize: 12.5, fontWeight: '700', color: TT.accent }}>{tr.privateToYou}{view.runCount > 0 ? ` · ${tr.doneCount} ${view.runCount}×` : ''}</Text>
            </View>

            <ResourceIntro text={view.resource.description} />
            {blocks.map((b) => (
              <Block
                key={b.id}
                block={b}
                value={answers[b.id]}
                onChange={(v) => set(b.id, v)}
                missing={false}
                mediaUrl={view.mediaUrls?.[b.id]}
                onUploadStatus={b.type === 'file_upload' ? (st) => {
                  uploads.current = { ...uploads.current, [b.id]: st };
                  setUploadingNow(Object.values(uploads.current).some((u) => u.uploading > 0));
                } : undefined}
              />
            ))}
          </FadeIn>
        </ScrollView>

        <View style={{ position: 'absolute', left: 22, right: 22, bottom: 24 }}>
          <Pressable onPress={save} disabled={saving} style={{ height: 54, borderRadius: 27, backgroundColor: saving ? TT.faint : TT.ctaBg, alignItems: 'center', justifyContent: 'center' }}>
            {saving ? <ActivityIndicator color={TT.ctaFg} /> : <Text style={{ fontSize: 15.5, fontWeight: '700', color: TT.ctaFg }}>{hasInteractive ? tr.save : tr.markDone}</Text>}
          </Pressable>
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
            <Text style={{ fontSize: 12, fontWeight: '600', color: TT.faint, letterSpacing: 0.2 }}>{tr.justForYou}</Text>
            <Text style={{ fontSize: 40, fontWeight: '800', color: TT.accent, marginTop: 6 }}>{score.total}<Text style={{ fontSize: 20, color: TT.faint, fontWeight: '700' }}> / {score.maxScore}</Text></Text>
            {score.interpretation && <Text style={{ fontSize: 15, fontWeight: '700', color: TT.ink, marginTop: 8 }}>{score.interpretation.label}</Text>}
          </View>
        )}
      </View>
      <View style={{ paddingHorizontal: 22, paddingBottom: 24 }}>
        <EdPill label={tr.done} variant="dark" onPress={onDone} />
      </View>
    </View>
  );
}

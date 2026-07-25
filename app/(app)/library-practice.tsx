// e4 — Library activity. Render a self-guided practice, do it, and save a PRIVATE
// run (/api/mobile/library/[id]/run) — kept to the patient, never seen by the
// practitioner. Repeatable. Wired to GET /api/mobile/library/[id].
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Lock, CircleCheckBig } from 'lucide-react-native';
import { EDA, EdHeader, EdPill, FadeIn } from '@/src/ui/editorial';
import { ONBOARDING_IMAGES } from '@/src/onboarding/editorial/images';
import { resourceTypeMeta } from '@/src/care/resources';
import { Block, INTERACTIVE } from '@/src/resources/blocks';
import { getLibraryResource, runLibraryActivity, type LibraryResourceView } from '@/src/api/library';
import type { PatientScore } from '@/src/api/resources';
import { useI18n } from '@/src/i18n';

const T = {
  en: {
    couldNotSave: 'Could not save.',
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
  const set = (blockId: string, value: unknown) => setAnswers((prev) => ({ ...prev, [blockId]: value }));

  const save = async () => {
    if (saving) return;
    setSaving(true);
    const res = await runLibraryActivity(resourceId, answers);
    if (res.ok) { setResult({ score: res.score ?? null }); return; }
    setSaving(false);
    if (Platform.OS === 'web') globalThis.alert?.(res.error ?? tr.couldNotSave);
  };

  const back = () => (router.canGoBack() ? router.back() : router.navigate('/library' as never));

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
        </View>
      </View>
    );
  }

  if (result) return <ResultView title={view.resource.title} score={result.score} onDone={back} tr={tr} />;

  const meta = resourceTypeMeta(view.resource.type, locale);

  return (
    <View style={{ flex: 1, backgroundColor: EDA.canvas }}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <EdHeader source={ONBOARDING_IMAGES.card4} kicker={meta.label} title={view.resource.title} onBack={back} />

          <FadeIn style={{ paddingHorizontal: 22, paddingTop: 20 }}>
            {/* Private-to-you note */}
            <View style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: EDA.greenTint, borderRadius: 12, paddingVertical: 5, paddingHorizontal: 10, marginBottom: 16 }}>
              <Lock size={12} color={EDA.green} strokeWidth={2} />
              <Text style={{ fontSize: 12.5, fontWeight: '700', color: EDA.green }}>{tr.privateToYou}{view.runCount > 0 ? ` · ${tr.doneCount} ${view.runCount}×` : ''}</Text>
            </View>

            {view.resource.description ? <Text style={{ fontSize: 15, color: EDA.inkSoft, lineHeight: 24, marginBottom: 18 }}>{view.resource.description}</Text> : null}
            {blocks.map((b) => (
              <Block key={b.id} block={b} value={answers[b.id]} onChange={(v) => set(b.id, v)} missing={false} />
            ))}
          </FadeIn>
        </ScrollView>

        <View style={{ position: 'absolute', left: 22, right: 22, bottom: 24 }}>
          <Pressable onPress={save} disabled={saving} style={{ height: 54, borderRadius: 27, backgroundColor: saving ? EDA.faint : EDA.ink, alignItems: 'center', justifyContent: 'center' }}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={{ fontSize: 15.5, fontWeight: '700', color: '#fff' }}>{hasInteractive ? tr.save : tr.markDone}</Text>}
          </Pressable>
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
            <Text style={{ fontSize: 12, fontWeight: '600', color: EDA.faint, textTransform: 'uppercase', letterSpacing: 0.5 }}>{tr.justForYou}</Text>
            <Text style={{ fontSize: 40, fontWeight: '800', color: EDA.green, marginTop: 6 }}>{score.total}<Text style={{ fontSize: 20, color: EDA.faint, fontWeight: '700' }}> / {score.maxScore}</Text></Text>
            {score.interpretation && <Text style={{ fontSize: 15, fontWeight: '700', color: EDA.ink, marginTop: 8 }}>{score.interpretation.label}</Text>}
          </View>
        )}
      </View>
      <View style={{ paddingHorizontal: 22, paddingBottom: 24 }}>
        <EdPill label={tr.done} variant="dark" onPress={onDone} />
      </View>
    </View>
  );
}

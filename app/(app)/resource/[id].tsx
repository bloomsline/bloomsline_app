// Assigned-resource detail + response flow. Opens an assigned resource, renders
// the frozen version's blocks (shared renderer), collects answers, and submits →
// server validates + scores → shows the result. Reached from My Care "To do".
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Check, CircleCheckBig } from 'lucide-react-native';
import { CareHeader } from '@/src/care/CareHeader';
import { CARE } from '@/src/care/theme';
import { Block, INTERACTIVE } from '@/src/resources/blocks';
import { fetchAssignment, submitAssignment, type AssignmentView, type PatientScore } from '@/src/api/resources';

export default function ResourceDetail() {
  const router = useRouter();
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
    setError(res.error ?? 'Could not submit. Please try again.');
  };

  if (!loaded) {
    return (
      <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: CARE.canvas }}>
        <CareHeader />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={CARE.teal} /></View>
      </SafeAreaView>
    );
  }
  if (!view) {
    return (
      <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: CARE.canvas }}>
        <CareHeader />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: CARE.ink }}>Resource unavailable</Text>
          <Text style={{ fontSize: 13.5, color: '#999', marginTop: 6, textAlign: 'center' }}>This resource is no longer available.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (result) return <ResultView title={view.resource.title} score={result.score} onDone={() => (router.canGoBack() ? router.back() : router.navigate('/home' as never))} />;

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: CARE.canvas }}>
      <CareHeader title={view.resource.type === 'psychoeducation' ? 'Reading' : 'Worksheet'} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 8, paddingBottom: 40 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Text style={{ fontSize: 24, fontWeight: '700', letterSpacing: -0.4, color: CARE.ink, marginBottom: view.resource.description ? 6 : 18 }}>{view.resource.title}</Text>
          {view.resource.description ? <Text style={{ fontSize: 14, color: '#7A7A7A', lineHeight: 21, marginBottom: 18 }}>{view.resource.description}</Text> : null}
          {view.response?.status === 'submitted' && (
            <View style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: CARE.mint, borderRadius: 12, paddingVertical: 5, paddingHorizontal: 10, marginBottom: 16 }}>
              <Check size={13} color={CARE.teal} strokeWidth={3} />
              <Text style={{ fontSize: 12, fontWeight: '600', color: CARE.teal }}>Completed · you can update it</Text>
            </View>
          )}

          {blocks.map((b) => (
            <Block key={b.id} block={b} value={answers[b.id]} onChange={(v) => set(b.id, v)} missing={missingId === b.id} />
          ))}

          {error && <Text style={{ marginTop: 14, fontSize: 13.5, fontWeight: '600', color: CARE.danger }}>{error}</Text>}
        </ScrollView>

        <View style={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: 10, borderTopWidth: 1, borderTopColor: '#EEE' }}>
          <TouchableOpacity onPress={submit} disabled={submitting} activeOpacity={0.85} style={{ height: 54, borderRadius: 27, backgroundColor: submitting ? '#E5E5E5' : CARE.teal, alignItems: 'center', justifyContent: 'center' }}>
            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={{ fontSize: 16, fontWeight: '600', color: '#fff' }}>{hasInteractive ? 'Submit' : 'Mark as done'}</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function ResultView({ title, score, onDone }: { title: string; score: PatientScore | null; onDone: () => void }) {
  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: CARE.canvas }}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
        <View style={{ width: 76, height: 76, borderRadius: 38, backgroundColor: CARE.mint, alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
          <CircleCheckBig size={34} color={CARE.teal} strokeWidth={2} />
        </View>
        <Text style={{ fontSize: 22, fontWeight: '700', color: CARE.ink, textAlign: 'center' }}>All done</Text>
        <Text style={{ fontSize: 14, color: '#7A7A7A', textAlign: 'center', marginTop: 6 }}>{title} is saved and shared with your practitioner.</Text>

        {score && (
          <View style={{ marginTop: 24, alignSelf: 'stretch', backgroundColor: '#fff', borderWidth: 1, borderColor: CARE.border, borderRadius: 20, padding: 22, alignItems: 'center' }}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: '#9A9A9A', textTransform: 'uppercase', letterSpacing: 0.5 }}>Your score</Text>
            <Text style={{ fontSize: 40, fontWeight: '800', color: CARE.teal, marginTop: 6 }}>{score.total}<Text style={{ fontSize: 20, color: '#B4B4B4', fontWeight: '700' }}> / {score.maxScore}</Text></Text>
            {score.interpretation && <Text style={{ fontSize: 15, fontWeight: '700', color: CARE.ink, marginTop: 8 }}>{score.interpretation.label}</Text>}
            {score.interpretation?.note && <Text style={{ fontSize: 13, color: '#7A7A7A', textAlign: 'center', marginTop: 4, lineHeight: 19 }}>{score.interpretation.note}</Text>}
          </View>
        )}
      </View>
      <View style={{ paddingHorizontal: 24, paddingBottom: 16 }}>
        <TouchableOpacity onPress={onDone} activeOpacity={0.85} style={{ height: 54, borderRadius: 27, backgroundColor: CARE.teal, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 16, fontWeight: '600', color: '#fff' }}>Done</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

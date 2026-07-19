// e4 — Library activity. Render a self-guided practice, do it, and save a PRIVATE
// run (/api/mobile/library/[id]/run) — kept to the patient, never seen by the
// practitioner. Repeatable. Wired to GET /api/mobile/library/[id].
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, Lock, CircleCheckBig } from 'lucide-react-native';
import { CARE } from '@/src/care/theme';
import { resourceTypeMeta } from '@/src/care/resources';
import { Block, INTERACTIVE } from '@/src/resources/blocks';
import { getLibraryResource, runLibraryActivity, type LibraryResourceView } from '@/src/api/library';
import type { PatientScore } from '@/src/api/resources';

export default function LibraryPractice() {
  const router = useRouter();
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
    if (Platform.OS === 'web') globalThis.alert?.(res.error ?? 'Could not save.');
  };

  const back = () => (router.canGoBack() ? router.back() : router.navigate('/library' as never));

  if (!loaded) {
    return (
      <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: CARE.canvas }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={CARE.teal} /></View>
      </SafeAreaView>
    );
  }
  if (!view) {
    return (
      <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: CARE.canvas }}>
        <View style={{ paddingHorizontal: 24, paddingTop: 8 }}>
          <TouchableOpacity onPress={back} activeOpacity={0.7} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: '#fff', borderWidth: 1, borderColor: CARE.border, alignItems: 'center', justifyContent: 'center' }}>
            <ChevronLeft size={18} color="#333" strokeWidth={2} />
          </TouchableOpacity>
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: CARE.ink }}>Activity unavailable</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (result) return <ResultView title={view.resource.title} score={result.score} onDone={back} />;

  const meta = resourceTypeMeta(view.resource.type);

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: CARE.canvas }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ paddingBottom: 110 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* Hero */}
          <LinearGradient colors={['#009B8E', '#00B4A3']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ paddingHorizontal: 24, paddingTop: 8, paddingBottom: 28 }}>
            <TouchableOpacity onPress={back} activeOpacity={0.7} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
              <ChevronLeft size={18} color="#fff" strokeWidth={2} />
            </TouchableOpacity>
            <View style={{ width: 52, height: 52, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
              <meta.Icon size={24} color="#fff" strokeWidth={2} />
            </View>
            <Text style={{ fontSize: 23, fontWeight: '700', color: '#fff', letterSpacing: -0.3 }}>{view.resource.title}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
              <Lock size={12} color="rgba(255,255,255,0.85)" strokeWidth={2} />
              <Text style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.85)' }}>Private to you{view.runCount > 0 ? ` · done ${view.runCount}×` : ''}</Text>
            </View>
          </LinearGradient>

          <View style={{ paddingHorizontal: 24, paddingTop: 20 }}>
            {view.resource.description ? <Text style={{ fontSize: 15, color: '#3A3A3A', lineHeight: 24, marginBottom: 18 }}>{view.resource.description}</Text> : null}
            {blocks.map((b) => (
              <Block key={b.id} block={b} value={answers[b.id]} onChange={(v) => set(b.id, v)} missing={false} />
            ))}
          </View>
        </ScrollView>

        <View style={{ position: 'absolute', left: 24, right: 24, bottom: 24 }}>
          <TouchableOpacity onPress={save} disabled={saving} activeOpacity={0.85} style={{ height: 56, borderRadius: 28, backgroundColor: saving ? '#E5E5E5' : CARE.teal, alignItems: 'center', justifyContent: 'center' }}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={{ fontSize: 16, fontWeight: '600', color: '#fff' }}>{hasInteractive ? 'Save' : 'Mark as done'}</Text>}
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
        <Text style={{ fontSize: 22, fontWeight: '700', color: CARE.ink, textAlign: 'center' }}>Nicely done</Text>
        <Text style={{ fontSize: 14, color: '#7A7A7A', textAlign: 'center', marginTop: 6 }}>{title} is saved and kept private to you. Come back to it anytime.</Text>

        {score && (
          <View style={{ marginTop: 24, alignSelf: 'stretch', backgroundColor: '#fff', borderWidth: 1, borderColor: CARE.border, borderRadius: 20, padding: 22, alignItems: 'center' }}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: '#9A9A9A', textTransform: 'uppercase', letterSpacing: 0.5 }}>Just for you</Text>
            <Text style={{ fontSize: 40, fontWeight: '800', color: CARE.teal, marginTop: 6 }}>{score.total}<Text style={{ fontSize: 20, color: '#B4B4B4', fontWeight: '700' }}> / {score.maxScore}</Text></Text>
            {score.interpretation && <Text style={{ fontSize: 15, fontWeight: '700', color: CARE.ink, marginTop: 8 }}>{score.interpretation.label}</Text>}
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

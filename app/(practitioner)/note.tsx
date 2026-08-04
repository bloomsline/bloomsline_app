import { useCallback, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Check, Search } from 'lucide-react-native';
import { Screen } from '@/src/ui/Screen';
import { useI18n } from '@/src/i18n';
import { fetchPatients, createNote, type PatientListItem } from '@/src/api/practitioner';

// Take a note. Reached from the tab bar's action button with nobody chosen, or
// from a patient with them already chosen — the same screen either way, because
// the only difference is whether the first question is already answered.
const T = {
  en: {
    title: 'Take a note', who: 'Who is this about?', search: 'Search by name',
    placeholder: 'What happened, what you noticed, what to pick up next time…',
    save: 'Save note', saved: 'Saved', empty: 'No patients yet.',
    titlePlaceholder: 'Title (optional)',
  },
  fr: {
    title: 'Prendre une note', who: 'À propos de qui ?', search: 'Rechercher par nom',
    placeholder: 'Ce qui s’est passé, ce que vous avez remarqué, à reprendre la prochaine fois…',
    save: 'Enregistrer', saved: 'Enregistré', empty: 'Aucun patient.',
    titlePlaceholder: 'Titre (facultatif)',
  },
} as const;

export default function TakeNote() {
  const router = useRouter();
  const { patientId } = useLocalSearchParams<{ patientId?: string }>();
  const { locale } = useI18n();
  const tr = T[locale] ?? T.en;

  const [picked, setPicked] = useState<string | null>(typeof patientId === 'string' ? patientId : null);
  const [patients, setPatients] = useState<PatientListItem[]>([]);
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

  const needle = q.trim().toLowerCase();
  const shown = needle ? patients.filter((p) => p.name.toLowerCase().includes(needle)) : patients;
  const pickedName = patients.find((p) => p.id === picked)?.name;

  const save = async () => {
    if (!picked || !content.trim()) return;
    setError('');
    setSaving(true);
    const res = await createNote(picked, content.trim(), title.trim() || undefined);
    setSaving(false);
    if (!res.ok) { setError(res.error ?? ''); return; }
    // Back to wherever they came from, with the note already in that patient's
    // list — the screen behind reloads on focus.
    router.back();
  };

  return (
    <Screen bg="bg-surface-soft" scroll className="px-6">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10} className="mt-2 h-9 w-9 items-center justify-center rounded-full bg-white">
          <ArrowLeft size={18} color="#1A1A1A" />
        </TouchableOpacity>

        <Text className="mt-4 text-[26px] font-bold tracking-[-0.6px] text-ink">{tr.title}</Text>

        {!picked ? (
          <>
            <Text className="mt-6 text-[12px] font-extrabold uppercase tracking-[0.6px] text-muted">{tr.who}</Text>
            <View className="mt-3 flex-row items-center gap-2 rounded-2xl bg-white px-4 py-3">
              <Search size={16} color="#9A9A9A" />
              <TextInput value={q} onChangeText={setQ} placeholder={tr.search} placeholderTextColor="#BBB" className="flex-1 text-[15px] text-ink" autoCorrect={false} />
            </View>
            {shown.length === 0 && <Text className="mt-6 text-[14px] text-muted">{tr.empty}</Text>}
            {shown.map((p) => (
              <TouchableOpacity key={p.id} onPress={() => setPicked(p.id)} activeOpacity={0.85} className="mt-3 rounded-2xl bg-white p-4">
                <Text className="text-[15px] font-semibold text-ink">{p.name}</Text>
              </TouchableOpacity>
            ))}
          </>
        ) : (
          <>
            <TouchableOpacity onPress={() => setPicked(null)} className="mt-4 self-start rounded-full bg-brand-tint px-3 py-1.5">
              <Text className="text-[13px] font-bold text-brand">{pickedName ?? tr.who}</Text>
            </TouchableOpacity>

            <View className="mt-4 rounded-2xl bg-white px-4 py-3">
              <TextInput value={title} onChangeText={setTitle} placeholder={tr.titlePlaceholder} placeholderTextColor="#BBB" className="text-[15px] font-semibold text-ink" />
            </View>

            <View className="mt-3 rounded-2xl bg-white px-4 py-3">
              <TextInput
                value={content}
                onChangeText={setContent}
                placeholder={tr.placeholder}
                placeholderTextColor="#BBB"
                multiline
                textAlignVertical="top"
                className="min-h-[180px] text-[15.5px] leading-[24px] text-ink"
                autoFocus
              />
            </View>

            <TouchableOpacity
              onPress={save}
              disabled={saving || !content.trim()}
              activeOpacity={0.85}
              className="mt-5 flex-row items-center justify-center gap-2 rounded-full bg-ink py-3.5"
              style={{ opacity: saving || !content.trim() ? 0.4 : 1 }}
            >
              {saving ? <ActivityIndicator color="#fff" size="small" /> : <Check size={16} color="#fff" strokeWidth={2.5} />}
              <Text className="text-[15px] font-bold text-white">{tr.save}</Text>
            </TouchableOpacity>
            {error ? <Text className="mt-2 text-[13px] text-[#C0392B]">{error}</Text> : null}
          </>
        )}
        <View className="h-16" />
      </KeyboardAvoidingView>
    </Screen>
  );
}

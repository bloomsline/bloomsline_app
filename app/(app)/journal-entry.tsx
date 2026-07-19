// e2 — Journal writing. Distraction-free editor that SAVES AS YOU GO (debounced
// autosave) to /api/mobile/journal. New entries are created on first real edit;
// existing ones are patched. Delete via the ⋯ menu. Private to the patient.
import { useEffect, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, Check, Trash2 } from 'lucide-react-native';
import { CARE } from '@/src/care/theme';
import { createJournal, deleteJournal, getJournal, updateJournal } from '@/src/api/journal';

type Status = 'idle' | 'saving' | 'saved';

export default function JournalEntry() {
  const router = useRouter();
  const { id: paramId } = useLocalSearchParams<{ id?: string }>();

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [loaded, setLoaded] = useState(false);

  const idRef = useRef<string | null>(typeof paramId === 'string' ? paramId : null);
  const latest = useRef({ title: '', body: '' });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);

  // Load an existing entry.
  useEffect(() => {
    let alive = true;
    if (idRef.current) {
      getJournal(idRef.current).then((e) => {
        if (!alive || !e) { setLoaded(true); return; }
        setTitle(e.title ?? '');
        setBody(e.body);
        latest.current = { title: e.title ?? '', body: e.body };
        setLoaded(true);
      });
    } else {
      setLoaded(true);
    }
    return () => { alive = false; };
  }, []);

  const doSave = async () => {
    const { title: t, body: b } = latest.current;
    if (!t.trim() && !b.trim()) { if (mounted.current) setStatus('idle'); return; } // never persist an empty entry
    if (idRef.current) {
      await updateJournal(idRef.current, { title: t.trim() || null, body: b });
    } else {
      const created = await createJournal({ title: t.trim() || null, body: b });
      if (created) idRef.current = created.id;
    }
    if (mounted.current) setStatus('saved');
  };

  const schedule = () => {
    setStatus('saving');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(doSave, 900);
  };

  // Flush on unmount (covers the back button too).
  useEffect(() => {
    return () => {
      mounted.current = false;
      if (timer.current) clearTimeout(timer.current);
      void doSave();
    };
  }, []);

  const onTitle = (t: string) => { setTitle(t); latest.current.title = t; schedule(); };
  const onBody = (b: string) => { setBody(b); latest.current.body = b; schedule(); };

  const back = () => (router.canGoBack() ? router.back() : router.navigate('/journal' as never));

  const remove = async () => {
    if (timer.current) clearTimeout(timer.current);
    if (idRef.current) await deleteJournal(idRef.current);
    idRef.current = null;
    latest.current = { title: '', body: '' }; // stop the unmount flush from re-creating it
    back();
  };
  const confirmDelete = () => {
    if (!idRef.current) { back(); return; }
    if (Platform.OS === 'web') { if (globalThis.confirm?.('Delete this entry?')) remove(); }
    else Alert.alert('Delete entry', 'This can’t be undone.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: remove }]);
  };

  const words = body.trim() ? body.trim().split(/\s+/).length : 0;

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: '#fff' }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingVertical: 12 }}>
          <TouchableOpacity onPress={back} activeOpacity={0.7} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: '#F4F4F2', alignItems: 'center', justifyContent: 'center' }}>
            <ChevronLeft size={18} color="#333" strokeWidth={2} />
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            {status === 'saved' && <Check size={13} color={CARE.muted} strokeWidth={2.5} />}
            <Text style={{ fontSize: 12, fontWeight: '600', color: CARE.muted }}>{status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved' : ''}</Text>
          </View>
          <TouchableOpacity onPress={confirmDelete} activeOpacity={0.7} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: '#F4F4F2', alignItems: 'center', justifyContent: 'center' }}>
            <Trash2 size={16} color="#999" strokeWidth={2} />
          </TouchableOpacity>
        </View>

        {loaded && (
          <ScrollView contentContainerStyle={{ paddingHorizontal: 26, paddingTop: 12, paddingBottom: 24 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <TextInput
              value={title}
              onChangeText={onTitle}
              placeholder="Title"
              placeholderTextColor="#CFCFCF"
              style={{ fontSize: 22, fontWeight: '700', color: CARE.ink, letterSpacing: -0.3, marginBottom: 16 }}
            />
            <TextInput
              value={body}
              onChangeText={onBody}
              placeholder="Start writing…"
              placeholderTextColor="#CFCFCF"
              multiline
              style={{ fontSize: 15.5, color: '#3A3A3A', lineHeight: 27, minHeight: 320, textAlignVertical: 'top' }}
            />
          </ScrollView>
        )}

        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#F2F2F0' }}>
          <Text style={{ marginLeft: 'auto', fontSize: 13, fontWeight: '600', color: CARE.muted }}>{words} words</Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

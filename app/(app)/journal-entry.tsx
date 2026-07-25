// e2 — Journal writing. Distraction-free editor that SAVES AS YOU GO (debounced
// autosave) to /api/mobile/journal. New entries are created on first real edit;
// existing ones are patched. Delete via the trash action. Private to the patient.
// Hybrid editorial re-skin.
import { useEffect, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, Check, Trash2 } from 'lucide-react-native';
import { EDA, MonoLabel } from '@/src/ui/editorial';
import { createJournal, deleteJournal, getJournal, updateJournal } from '@/src/api/journal';
import { useI18n } from '@/src/i18n';

type Status = 'idle' | 'saving' | 'saved';

const T = {
  en: {
    saving: 'Saving…',
    saved: 'Saved',
    titlePlaceholder: 'Title',
    bodyPlaceholder: 'Start writing…',
    words: 'words',
    confirmWeb: 'Delete this entry?',
    deleteTitle: 'Delete entry',
    deleteMessage: 'This can’t be undone.',
    cancel: 'Cancel',
    delete: 'Delete',
  },
  fr: {
    saving: 'Enregistrement…',
    saved: 'Enregistré',
    titlePlaceholder: 'Titre',
    bodyPlaceholder: 'Commencez à écrire…',
    words: 'mots',
    confirmWeb: 'Supprimer cette entrée ?',
    deleteTitle: 'Supprimer l’entrée',
    deleteMessage: 'Cette action est irréversible.',
    cancel: 'Annuler',
    delete: 'Supprimer',
  },
} as const;

export default function JournalEntry() {
  const router = useRouter();
  const { locale } = useI18n();
  const tr = T[locale];
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
    if (Platform.OS === 'web') { if (globalThis.confirm?.(tr.confirmWeb)) remove(); }
    else Alert.alert(tr.deleteTitle, tr.deleteMessage, [{ text: tr.cancel, style: 'cancel' }, { text: tr.delete, style: 'destructive', onPress: remove }]);
  };

  const words = body.trim() ? body.trim().split(/\s+/).length : 0;

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: EDA.canvas }}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        {/* Slim editorial top bar */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 22, paddingVertical: 12 }}>
          <TouchableOpacity onPress={back} activeOpacity={0.7} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: EDA.card, borderWidth: 1, borderColor: EDA.line, alignItems: 'center', justifyContent: 'center' }}>
            <ChevronLeft size={18} color={EDA.ink} strokeWidth={2} />
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            {status === 'saved' && <Check size={13} color={EDA.green} strokeWidth={2.5} />}
            {status !== 'idle' ? <MonoLabel color={EDA.faint} size={9.5}>{status === 'saving' ? tr.saving : tr.saved}</MonoLabel> : null}
          </View>
          <TouchableOpacity onPress={confirmDelete} activeOpacity={0.7} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: EDA.card, borderWidth: 1, borderColor: EDA.line, alignItems: 'center', justifyContent: 'center' }}>
            <Trash2 size={16} color={EDA.faint} strokeWidth={2} />
          </TouchableOpacity>
        </View>

        {loaded && (
          <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: 24 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <TextInput
              value={title}
              onChangeText={onTitle}
              placeholder={tr.titlePlaceholder}
              placeholderTextColor={EDA.faint}
              style={{ fontSize: 23, fontWeight: '800', color: EDA.ink, letterSpacing: -0.4, marginBottom: 16 }}
            />
            <TextInput
              value={body}
              onChangeText={onBody}
              placeholder={tr.bodyPlaceholder}
              placeholderTextColor={EDA.faint}
              multiline
              style={{ fontSize: 15.5, color: EDA.inkSoft, lineHeight: 27, minHeight: 320, textAlignVertical: 'top' }}
            />
          </ScrollView>
        )}

        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 12, borderTopWidth: 1, borderTopColor: EDA.line }}>
          <View style={{ marginLeft: 'auto' }}>
            <MonoLabel color={EDA.faint}>{words} {tr.words}</MonoLabel>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

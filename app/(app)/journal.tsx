// e1 — Journal home. Private long-form writing, wired to /api/mobile/journal.
import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { ChevronLeft, Lock, PenLine } from 'lucide-react-native';
import { CARE } from '@/src/care/theme';
import { listJournal, type JournalEntry } from '@/src/api/journal';

export default function Journal() {
  const router = useRouter();
  const [entries, setEntries] = useState<JournalEntry[] | null>(null);
  const back = () => (router.canGoBack() ? router.back() : router.navigate('/for-you' as never));

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      listJournal().then((e) => { if (alive) setEntries(e ?? []); });
      return () => { alive = false; };
    }, []),
  );

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: CARE.canvas }}>
      <View style={{ paddingHorizontal: 24, paddingTop: 8 }}>
        <TouchableOpacity onPress={back} activeOpacity={0.7} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: '#fff', borderWidth: 1, borderColor: CARE.border, alignItems: 'center', justifyContent: 'center' }}>
          <ChevronLeft size={18} color="#333" strokeWidth={2} />
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 14, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <Text style={{ fontSize: 28, fontWeight: '700', letterSpacing: -0.6, color: CARE.ink }}>Journal</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fff', borderWidth: 1, borderColor: CARE.border, borderRadius: 20, paddingVertical: 6, paddingHorizontal: 12 }}>
            <Lock size={13} color="#666" strokeWidth={2} />
            <Text style={{ fontSize: 12, fontWeight: '600', color: '#666' }}>Private</Text>
          </View>
        </View>
        <Text style={{ fontSize: 13.5, color: '#9A9A9A', marginBottom: 22 }}>A quiet place to write freely. Only you can read this.</Text>

        {entries === null ? (
          <View style={{ paddingTop: 30, alignItems: 'center' }}><ActivityIndicator color={CARE.teal} /></View>
        ) : entries.length === 0 ? (
          <View style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: CARE.border, borderRadius: 18, padding: 26, alignItems: 'center' }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: CARE.ink }}>Nothing written yet</Text>
            <Text style={{ fontSize: 13, color: '#999', marginTop: 6, textAlign: 'center', lineHeight: 19 }}>Tap the pencil to start your first entry. It stays private to you.</Text>
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            {entries.map((e) => (
              <TouchableOpacity key={e.id} onPress={() => router.navigate(`/journal-entry?id=${e.id}` as never)} activeOpacity={0.85} style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: CARE.border, borderRadius: 18, padding: 18 }}>
                <Text style={{ fontSize: 12, color: CARE.muted, marginBottom: 6 }}>{when(e.updatedAt)}</Text>
                <Text style={{ fontSize: 16, fontWeight: '700', color: CARE.ink, marginBottom: e.body ? 6 : 0 }}>{e.title || 'Untitled'}</Text>
                {e.body ? <Text style={{ fontSize: 13.5, color: '#7A7A7A', lineHeight: 21 }} numberOfLines={2}>{e.body}</Text> : null}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      <TouchableOpacity
        onPress={() => router.navigate('/journal-entry' as never)}
        activeOpacity={0.85}
        style={{ position: 'absolute', right: 22, bottom: 28, width: 58, height: 58, borderRadius: 29, backgroundColor: CARE.teal, alignItems: 'center', justifyContent: 'center', shadowColor: CARE.teal, shadowOpacity: 0.4, shadowRadius: 22, shadowOffset: { width: 0, height: 8 }, elevation: 8 }}
      >
        <PenLine size={24} color="#fff" strokeWidth={2} />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

function when(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sod = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((sod(now) - sod(d)) / 86400000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

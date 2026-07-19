// c7 — "What your practitioner can see": the patient's currently-shared moments,
// with working Unshare. Wired to GET /api/mobile/care/sharing +
// POST /api/moments/[id]/share {shared:false}. (Global "pause all sharing" needs
// a user-level flag that doesn't exist yet — deferred.)
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Lock } from 'lucide-react-native';
import { CareHeader } from '@/src/care/CareHeader';
import { CARE } from '@/src/care/theme';
import { useOnboarding } from '@/src/onboarding/context';
import { fetchSharing, type SharedItem } from '@/src/api/care';
import { shareMoment } from '@/src/api/moments';
import { moodLabel } from '@/src/moments/moods';

export default function Sharing() {
  const { practitionerName } = useOnboarding();
  const first = (practitionerName ?? 'Dr. Maya').replace(/^dr\.?\s*/i, '').split(/\s+/)[0];
  const [items, setItems] = useState<SharedItem[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetchSharing().then((s) => { if (alive) setItems(s ?? []); });
    return () => { alive = false; };
  }, []);

  const unshare = async (id: string) => {
    if (busy) return;
    setBusy(id);
    try {
      await shareMoment(id, false);
      setItems((prev) => (prev ? prev.filter((x) => x.id !== id) : prev));
    } catch {
      if (Platform.OS === 'web') globalThis.alert?.('Could not update. Please try again.');
    }
    setBusy(null);
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: CARE.canvas }}>
      <CareHeader title={`What ${first} can see`} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 8, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        {items === null ? (
          <View style={{ paddingTop: 40, alignItems: 'center' }}><ActivityIndicator color={CARE.teal} /></View>
        ) : (
          <>
            <Text style={{ fontSize: 12, fontWeight: '600', letterSpacing: 0.5, color: '#9A9A9A', textTransform: 'uppercase', marginBottom: 12 }}>
              Shared with {first} ({items.length})
            </Text>

            {items.length === 0 ? (
              <View style={{ backgroundColor: CARE.card, borderWidth: 1, borderColor: CARE.border, borderRadius: 16, padding: 20, alignItems: 'center', marginBottom: 18 }}>
                <Text style={{ fontSize: 13.5, color: '#999', textAlign: 'center' }}>Nothing is shared right now. You choose what to share from each moment.</Text>
              </View>
            ) : (
              <View style={{ gap: 10, marginBottom: 18 }}>
                {items.map((it) => (
                  <View key={it.id} style={{ backgroundColor: CARE.card, borderWidth: 1, borderColor: CARE.border, borderRadius: 16, padding: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: CARE.teal }} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: CARE.ink }} numberOfLines={1}>{label(it)}</Text>
                      <Text style={{ fontSize: 12, color: '#999' }}>{when(it.when)}</Text>
                    </View>
                    <TouchableOpacity onPress={() => unshare(it.id)} hitSlop={8} disabled={busy === it.id}>
                      {busy === it.id ? <ActivityIndicator size="small" color={CARE.unshare} /> : <Text style={{ fontSize: 13, color: CARE.unshare, fontWeight: '600' }}>Unshare</Text>}
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            <View style={{ backgroundColor: CARE.mint, borderRadius: 16, padding: 16, flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
              <Lock size={15} color={CARE.teal} strokeWidth={2} />
              <Text style={{ flex: 1, fontSize: 13, color: CARE.mintInk, lineHeight: 19 }}>
                Your private moments, journal and chats stay with you — only what&apos;s listed here is shared.
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function label(it: SharedItem): string {
  if (it.moods && it.moods.length > 0) return `Note · ${moodLabel(it.moods[0])}`;
  if (it.text) return it.text.length > 40 ? `${it.text.slice(0, 40)}…` : it.text;
  return 'Moment';
}
function when(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString(undefined, { weekday: 'short' })}, ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

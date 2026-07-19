// Session history — the patient's past sessions. Wired to GET /api/mobile/care/history.
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CareHeader } from '@/src/care/CareHeader';
import { CARE } from '@/src/care/theme';
import { fetchHistory, type CareSession } from '@/src/api/care';

const STATUS: Record<string, { label: string; color: string; bg: string }> = {
  completed: { label: 'Attended', color: '#2F6E5F', bg: CARE.mint },
  scheduled: { label: 'Past', color: '#8A8A8A', bg: '#F1F1EF' },
  pending: { label: 'Past', color: '#8A8A8A', bg: '#F1F1EF' },
  cancelled: { label: 'Cancelled', color: '#9A6A54', bg: '#F6EEE8' },
  no_show: { label: 'Missed', color: '#B98A66', bg: '#F6EEE8' },
};

export default function SessionHistory() {
  const [items, setItems] = useState<CareSession[] | null>(null);
  useEffect(() => {
    let alive = true;
    fetchHistory().then((s) => { if (alive) setItems(s ?? []); });
    return () => { alive = false; };
  }, []);

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: CARE.canvas }}>
      <CareHeader title="Session history" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 8, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        {items === null ? (
          <View style={{ paddingTop: 40, alignItems: 'center' }}><ActivityIndicator color={CARE.teal} /></View>
        ) : items.length === 0 ? (
          <View style={{ backgroundColor: CARE.card, borderWidth: 1, borderColor: CARE.border, borderRadius: 18, padding: 24, alignItems: 'center', marginTop: 8 }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: CARE.ink }}>No past sessions yet</Text>
            <Text style={{ fontSize: 13, color: '#999', marginTop: 6, textAlign: 'center' }}>Your completed sessions will appear here.</Text>
          </View>
        ) : (
          <View style={{ gap: 10, marginTop: 4 }}>
            {items.map((s) => {
              const st = STATUS[s.status] ?? STATUS.scheduled;
              return (
                <View key={s.id} style={{ backgroundColor: CARE.card, borderWidth: 1, borderColor: CARE.border, borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{ width: 46, alignItems: 'center' }}>
                    <Text style={{ fontSize: 11, fontWeight: '600', color: CARE.teal, textTransform: 'uppercase', letterSpacing: 0.5 }}>{monthShort(s.scheduledAt)}</Text>
                    <Text style={{ fontSize: 20, fontWeight: '700', color: CARE.ink, lineHeight: 22 }}>{dayNum(s.scheduledAt)}</Text>
                  </View>
                  <View style={{ width: 1, height: 32, backgroundColor: '#EEE' }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: CARE.ink }}>{clock(s.scheduledAt)} · {fmtFormat(s.sessionFormat)}</Text>
                    <Text style={{ fontSize: 12, color: '#999', marginTop: 1 }}>{s.durationMinutes} min</Text>
                  </View>
                  <View style={{ backgroundColor: st.bg, borderRadius: 10, paddingVertical: 4, paddingHorizontal: 9 }}>
                    <Text style={{ fontSize: 11.5, fontWeight: '600', color: st.color }}>{st.label}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const monthShort = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: 'short' });
const dayNum = (iso: string) => String(new Date(iso).getDate());
const clock = (iso: string) => { const d = new Date(iso); return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`; };
const fmtFormat = (f: string) => (f === 'video' ? 'Video' : f === 'phone' ? 'Phone' : f === 'in_person' ? 'In person' : f);

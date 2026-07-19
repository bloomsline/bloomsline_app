// c3 — Book a session, choose a time. Wired to GET /api/mobile/care/slots (real
// availability from the practitioner's schedule). Falls back to demo days only
// under FORCE_CARE_HUB (no linked practitioner) so the design stays reviewable.
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { CareHeader } from '@/src/care/CareHeader';
import { CARE } from '@/src/care/theme';
import { useOnboarding } from '@/src/onboarding/context';
import { FORCE_CARE_HUB } from '@/src/config';
import { fetchSlots, type SlotDay } from '@/src/api/booking';

// Demo availability for the FORCE_CARE_HUB preview only (no real practitioner).
function demoDays(): { days: SlotDay[]; sessionTypeId: string; format: string; durationMinutes: number } {
  const mk = (addDays: number, hours: number[]) => {
    const d = new Date();
    d.setDate(d.getDate() + addDays);
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const slots = hours.map((h) => { const s = new Date(d); s.setHours(h, 0, 0, 0); return s.toISOString(); });
    return { date, slots };
  };
  return { days: [mk(3, [9, 10, 14, 16]), mk(5, [11, 15]), mk(7, [9, 13, 17])], sessionTypeId: 'follow_up', format: 'video', durationMinutes: 50 };
}

export default function Book() {
  const router = useRouter();
  const params = useLocalSearchParams<{ rescheduleId?: string; sessionTypeId?: string; format?: string; demo?: string }>();
  const rescheduleId = typeof params.rescheduleId === 'string' ? params.rescheduleId : '';
  const { practitionerName } = useOnboarding();
  const name = practitionerName ?? 'your practitioner';

  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState<SlotDay[]>([]);
  const [meta, setMeta] = useState<{ sessionTypeId: string; format: string; durationMinutes: number } | null>(null);
  const [demo, setDemo] = useState(false);
  const [openDay, setOpenDay] = useState<string>('');
  const [pick, setPick] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetchSlots({ sessionTypeId: params.sessionTypeId, format: params.format }).then((res) => {
      if (!alive) return;
      if (res && res.days.length > 0) {
        setDays(res.days);
        setMeta({ sessionTypeId: res.sessionType.id, format: res.format, durationMinutes: res.sessionType.durationMinutes });
        setOpenDay(res.days[0].date);
        setPick(res.days[0].slots[0] ?? null);
      } else if (FORCE_CARE_HUB || params.demo === '1') {
        const d = demoDays();
        setDemo(true);
        setDays(d.days);
        setMeta({ sessionTypeId: d.sessionTypeId, format: d.format, durationMinutes: d.durationMinutes });
        setOpenDay(d.days[0].date);
        setPick(d.days[0].slots[0] ?? null);
      }
      setLoading(false);
    });
    return () => { alive = false; };
  }, [params.sessionTypeId, params.format, params.demo]);

  const goConfirm = () => {
    if (!pick || !meta) return;
    router.navigate({
      pathname: '/book-confirm',
      params: { slotIso: pick, sessionTypeId: meta.sessionTypeId, format: meta.format, durationMinutes: String(meta.durationMinutes), demo: demo ? '1' : '', rescheduleId },
    } as never);
  };

  const fmtLabel = meta ? `${name} · ${meta.durationMinutes} min · ${meta.format === 'video' ? 'video' : meta.format === 'phone' ? 'phone' : 'in person'}` : `With ${name}`;

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: CARE.canvas }}>
      <CareHeader title={rescheduleId ? 'Reschedule' : 'Book a session'} close />

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={CARE.teal} />
        </View>
      ) : days.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: CARE.ink }}>No times available</Text>
          <Text style={{ fontSize: 13.5, color: '#999', textAlign: 'center', marginTop: 6, lineHeight: 20 }}>
            Your practitioner has no open slots right now. Please check back later.
          </Text>
        </View>
      ) : (
        <>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 8, paddingBottom: 110 }} showsVerticalScrollIndicator={false}>
            <Text style={{ fontSize: 14, color: '#9A9A9A', marginBottom: 16 }}>With {fmtLabel}</Text>
            {days.map((d) => {
              const open = openDay === d.date;
              return (
                <View key={d.date} style={{ backgroundColor: CARE.card, borderWidth: 1, borderColor: CARE.border, borderRadius: 16, overflow: 'hidden', marginBottom: 10 }}>
                  <TouchableOpacity onPress={() => setOpenDay(open ? '' : d.date)} activeOpacity={0.7} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 }}>
                    <Text style={{ fontSize: 15, fontWeight: '600', color: CARE.ink }}>{dayLabel(d.date)}</Text>
                    {open ? <ChevronUp size={18} color="#B6AB98" strokeWidth={2} /> : <ChevronDown size={18} color="#B6AB98" strokeWidth={2} />}
                  </TouchableOpacity>
                  {open && (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, paddingBottom: 16 }}>
                      {d.slots.map((s) => {
                        const on = pick === s;
                        return (
                          <TouchableOpacity key={s} onPress={() => setPick(s)} activeOpacity={0.8} style={{ paddingVertical: 11, paddingHorizontal: 18, borderRadius: 14, backgroundColor: on ? CARE.teal : '#F1ECE2' }}>
                            <Text style={{ fontSize: 14, fontWeight: '600', color: on ? '#fff' : CARE.ink }}>{slotTime(s)}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                </View>
              );
            })}
          </ScrollView>

          <View style={{ position: 'absolute', left: 24, right: 24, bottom: 24 }}>
            <TouchableOpacity onPress={goConfirm} disabled={!pick} activeOpacity={0.85} style={{ height: 56, borderRadius: 28, backgroundColor: pick ? CARE.teal : '#E5E5E5', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: pick ? '#fff' : '#999' }}>{pick ? `Continue · ${slotTime(pick)}` : 'Choose a time'}</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

// 'YYYY-MM-DD' → "Monday, 14 July" (built from parts to avoid tz rollover).
function dayLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d, 12);
  return `${dt.toLocaleDateString(undefined, { weekday: 'long' })}, ${d} ${dt.toLocaleDateString(undefined, { month: 'long' })}`;
}

// ISO instant → local 24h "9:00" / "14:00".
function slotTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

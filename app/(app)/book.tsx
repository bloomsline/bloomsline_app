// c3 — Book a session. A wizard: choose the session TYPE, then the FORMAT,
// then a TIME. Mirrors v1 mobile's service → format → datetime sequence. Wired
// to GET /api/mobile/care/slots (real availability + the practitioner's own
// session types and offered formats). Falls back to demo days only under
// FORCE_CARE_HUB (no linked practitioner) so the design stays reviewable.
//
// RESCHEDULE skips the type/format steps: the session already has both, and the
// practitioner modal follows the same rule. It opens straight on the time step.
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronDown, ChevronUp, Check, Video, Phone, MapPin } from 'lucide-react-native';
import { CareHeader } from '@/src/care/CareHeader';
import { CARE } from '@/src/care/theme';
import { useOnboarding } from '@/src/onboarding/context';
import { FORCE_CARE_HUB } from '@/src/config';
import { fetchSlots, type SlotDay, type BookingSlots } from '@/src/api/booking';

type Step = 'service' | 'format' | 'time';

// Demo availability for the FORCE_CARE_HUB preview only (no real practitioner).
function demo(): BookingSlots {
  const mk = (addDays: number, hours: number[]) => {
    const d = new Date();
    d.setDate(d.getDate() + addDays);
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return { date, slots: hours.map((h) => { const s = new Date(d); s.setHours(h, 0, 0, 0); return s.toISOString(); }) };
  };
  return {
    days: [mk(3, [9, 10, 14, 16]), mk(5, [11, 15]), mk(7, [9, 13, 17])],
    timezone: 'Europe/Paris',
    sessionType: { id: 'follow_up', name: 'Follow-up', durationMinutes: 50, priceCents: 8000 },
    format: 'video',
    sessionTypes: [
      { id: 'intro', name: 'Intro call', durationMinutes: 30, priceCents: null, defaultFormat: 'video' },
      { id: 'follow_up', name: 'Follow-up', durationMinutes: 50, priceCents: 8000, defaultFormat: 'video' },
    ],
    offeredFormats: ['video', 'phone', 'in_person'],
    currency: 'EUR',
  };
}

const FORMAT_META: Record<string, { label: string; icon: typeof Video }> = {
  video: { label: 'Video call', icon: Video },
  phone: { label: 'Phone call', icon: Phone },
  in_person: { label: 'In person', icon: MapPin },
};

function priceLabel(cents: number | null, currency: string): string {
  if (cents == null) return 'No charge';
  const symbol = currency === 'EUR' ? '€' : currency === 'USD' ? '$' : currency === 'GBP' ? '£' : `${currency} `;
  const amount = cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2);
  return `${symbol}${amount}`;
}

export default function Book() {
  const router = useRouter();
  const params = useLocalSearchParams<{ rescheduleId?: string; sessionTypeId?: string; format?: string; demo?: string }>();
  const rescheduleId = typeof params.rescheduleId === 'string' ? params.rescheduleId : '';
  const isReschedule = !!rescheduleId;
  const { practitionerName } = useOnboarding();
  const name = practitionerName ?? 'your practitioner';

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<BookingSlots | null>(null);
  const [isDemo, setIsDemo] = useState(false);

  // Reschedule already knows type + format, so it opens on the time step.
  const [step, setStep] = useState<Step>(isReschedule ? 'time' : 'service');
  const [typeId, setTypeId] = useState<string | null>(params.sessionTypeId ?? null);
  const [format, setFormat] = useState<string | null>(params.format ?? null);

  const [days, setDays] = useState<SlotDay[]>([]);
  const [openDay, setOpenDay] = useState<string>('');
  const [pick, setPick] = useState<string | null>(null);
  const [slotsLoading, setSlotsLoading] = useState(false);

  // First load: fetch the options (and, for reschedule, the initial slots).
  useEffect(() => {
    let alive = true;
    fetchSlots({ sessionTypeId: params.sessionTypeId, format: params.format }).then((res) => {
      if (!alive) return;
      if (res && res.sessionTypes.length > 0) {
        setData(res);
        if (isReschedule) {
          setTypeId(res.sessionType.id);
          setFormat(res.format);
          setDays(res.days);
          setOpenDay(res.days[0]?.date ?? '');
          setPick(res.days[0]?.slots[0] ?? null);
        }
      } else if (FORCE_CARE_HUB || params.demo === '1') {
        setIsDemo(true);
        setData(demo());
      }
      setLoading(false);
    });
    return () => { alive = false; };
  }, [params.sessionTypeId, params.format, params.demo, isReschedule]);

  // Slots depend on type (duration) and format, so both drive the fetch.
  const loadSlots = async (t: string | null, f: string | null) => {
    if (isDemo) { const d = demo(); setDays(d.days); setOpenDay(d.days[0].date); setPick(d.days[0].slots[0] ?? null); return; }
    setSlotsLoading(true);
    const res = await fetchSlots({ sessionTypeId: t ?? undefined, format: f ?? undefined });
    setDays(res?.days ?? []);
    setOpenDay(res?.days[0]?.date ?? '');
    setPick(res?.days[0]?.slots[0] ?? null);
    setSlotsLoading(false);
  };

  // Choosing a type preselects its default format, so a single-format practice
  // never asks twice; the format step still lets them change it.
  const chooseType = (id: string) => {
    setTypeId(id);
    const t = data?.sessionTypes.find((x) => x.id === id);
    const offered = data?.offeredFormats ?? [];
    const preferred = t && offered.includes(t.defaultFormat) ? t.defaultFormat : offered[0] ?? null;
    setFormat(preferred);
    if (offered.length <= 1) { setStep('time'); void loadSlots(id, preferred); }
    else setStep('format');
  };

  const chooseFormat = (f: string) => {
    setFormat(f);
    setStep('time');
    void loadSlots(typeId, f);
  };

  const back = () => {
    if (step === 'time' && !isReschedule) setStep((data?.offeredFormats.length ?? 0) <= 1 ? 'service' : 'format');
    else if (step === 'format') setStep('service');
    else if (router.canGoBack()) router.back();
    else router.navigate('/home' as never);
  };

  const goConfirm = () => {
    if (!pick || !typeId || !format || !data) return;
    const dur = data.sessionTypes.find((t) => t.id === typeId)?.durationMinutes ?? 50;
    router.navigate({
      pathname: '/book-confirm',
      params: { slotIso: pick, sessionTypeId: typeId, format, durationMinutes: String(dur), demo: isDemo ? '1' : '', rescheduleId },
    } as never);
  };

  const title = isReschedule ? 'Reschedule' : 'Book a session';

  if (loading) {
    return (
      <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: CARE.canvas }}>
        <CareHeader title={title} close />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={CARE.teal} /></View>
      </SafeAreaView>
    );
  }

  if (!data) {
    return (
      <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: CARE.canvas }}>
        <CareHeader title={title} close />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: CARE.ink }}>Booking isn’t available</Text>
          <Text style={{ fontSize: 13.5, color: '#999', textAlign: 'center', marginTop: 6, lineHeight: 20 }}>
            Please check back later, or reach out to {name}.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // The visible steps (reschedule shows only the last; a single-format practice
  // has no format step).
  const stepList: Step[] = isReschedule ? ['time'] : data.offeredFormats.length <= 1 ? ['service', 'time'] : ['service', 'format', 'time'];
  const stepIdx = stepList.indexOf(step);

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: CARE.canvas }}>
      <CareHeader title={title} onBack={back} />

      {/* Progress rail */}
      {stepList.length > 1 && (
        <View style={{ flexDirection: 'row', gap: 6, paddingHorizontal: 24, marginBottom: 4 }}>
          {stepList.map((sName, i) => (
            <View key={sName} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: i <= stepIdx ? CARE.teal : '#E7E1D6' }} />
          ))}
        </View>
      )}

      {step === 'service' ? (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          <Text style={{ fontSize: 22, fontWeight: '700', color: CARE.ink, marginBottom: 4 }}>What kind of session?</Text>
          <Text style={{ fontSize: 14, color: '#9A9A9A', marginBottom: 18 }}>With {name}</Text>
          {data.sessionTypes.map((t) => (
            <TouchableOpacity key={t.id} onPress={() => chooseType(t.id)} activeOpacity={0.85}
              style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: CARE.card, borderWidth: 1, borderColor: typeId === t.id ? CARE.teal : CARE.border, borderRadius: 16, padding: 16, marginBottom: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15.5, fontWeight: '600', color: CARE.ink }}>{t.name}</Text>
                <Text style={{ fontSize: 13, color: '#9A9A9A', marginTop: 2 }}>{t.durationMinutes} min · {priceLabel(t.priceCents, data.currency)}</Text>
              </View>
              {typeId === t.id && <Check size={18} color={CARE.teal} strokeWidth={2.5} />}
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : step === 'format' ? (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          <Text style={{ fontSize: 22, fontWeight: '700', color: CARE.ink, marginBottom: 18 }}>How would you like to meet?</Text>
          {data.offeredFormats.map((f) => {
            const meta = FORMAT_META[f] ?? { label: f, icon: Video };
            const Icon = meta.icon;
            return (
              <TouchableOpacity key={f} onPress={() => chooseFormat(f)} activeOpacity={0.85}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: CARE.card, borderWidth: 1, borderColor: format === f ? CARE.teal : CARE.border, borderRadius: 16, padding: 16, marginBottom: 10 }}>
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#EAF4F1', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={19} color={CARE.teal} strokeWidth={2} />
                </View>
                <Text style={{ flex: 1, fontSize: 15.5, fontWeight: '600', color: CARE.ink }}>{meta.label}</Text>
                {format === f && <Check size={18} color={CARE.teal} strokeWidth={2.5} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      ) : slotsLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={CARE.teal} /></View>
      ) : days.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: CARE.ink }}>No times available</Text>
          <Text style={{ fontSize: 13.5, color: '#999', textAlign: 'center', marginTop: 6, lineHeight: 20 }}>
            Your practitioner has no open slots for this session right now. Try another format, or check back later.
          </Text>
        </View>
      ) : (
        <>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: 110 }} showsVerticalScrollIndicator={false}>
            <Text style={{ fontSize: 22, fontWeight: '700', color: CARE.ink, marginBottom: 4 }}>Choose a time</Text>
            <Text style={{ fontSize: 14, color: '#9A9A9A', marginBottom: 16 }}>
              {data.sessionTypes.find((t) => t.id === typeId)?.name ?? 'Session'} · {FORMAT_META[format ?? '']?.label ?? format}
            </Text>
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
                      {d.slots.map((sl) => {
                        const on = pick === sl;
                        return (
                          <TouchableOpacity key={sl} onPress={() => setPick(sl)} activeOpacity={0.8} style={{ paddingVertical: 11, paddingHorizontal: 18, borderRadius: 14, backgroundColor: on ? CARE.teal : '#F1ECE2' }}>
                            <Text style={{ fontSize: 14, fontWeight: '600', color: on ? '#fff' : CARE.ink }}>{slotTime(sl)}</Text>
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

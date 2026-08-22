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
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronDown, ChevronUp, Check, Video, Phone, MapPin } from 'lucide-react-native';
import { EdHeader, EdPill, FadeIn } from '@/src/ui/editorial';
import { ONBOARDING_IMAGES } from '@/src/onboarding/editorial/images';
import { useOnboarding } from '@/src/onboarding/context';
import { FORCE_CARE_HUB } from '@/src/config';
import { fetchSlots, type SlotDay, type BookingSlots } from '@/src/api/booking';
import { useI18n, type Locale } from '@/src/i18n';
import { useTheme } from '@/src/ui/theme-mode';

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

const FORMAT_ICON: Record<string, typeof Video> = {
  video: Video,
  phone: Phone,
  in_person: MapPin,
};

const T = {
  en: {
    bookTitle: 'Book a session',
    reschedule: 'Reschedule',
    yourPractitioner: 'your practitioner',
    unavailable: "Booking isn't available",
    unavailableBody: (n: string) => `Please check back later, or reach out to ${n}.`,
    whatKind: 'What kind of session?',
    withName: (n: string) => `With ${n}`,
    min: 'min',
    noCharge: 'No charge',
    howMeet: 'How would you like to meet?',
    noTimes: 'No times available',
    noTimesBody: 'Your practitioner has no open slots for this session right now. Try another format, or check back later.',
    chooseTime: 'Choose a time',
    session: 'Session',
    continueAt: (tm: string) => `Continue · ${tm}`,
    formats: { video: 'Video call', phone: 'Phone call', in_person: 'In person' } as Record<string, string>,
  },
  fr: {
    bookTitle: 'Prendre rendez-vous',
    reschedule: 'Reprogrammer',
    yourPractitioner: 'votre praticien',
    unavailable: "La réservation n'est pas disponible",
    unavailableBody: (n: string) => `Revenez un peu plus tard, ou contactez ${n}.`,
    whatKind: 'Quel type de séance ?',
    withName: (n: string) => `Avec ${n}`,
    min: 'min',
    noCharge: 'Gratuit',
    howMeet: 'Comment souhaitez-vous échanger ?',
    noTimes: 'Aucun créneau disponible',
    noTimesBody: "Votre praticien n'a aucun créneau libre pour cette séance pour le moment. Essayez un autre format, ou revenez plus tard.",
    chooseTime: 'Choisissez un horaire',
    session: 'Séance',
    continueAt: (tm: string) => `Continuer · ${tm}`,
    formats: { video: 'Appel vidéo', phone: 'Appel téléphonique', in_person: 'En personne' } as Record<string, string>,
  },
} as const;

function priceLabel(cents: number | null, currency: string, noChargeLabel: string): string {
  if (cents == null) return noChargeLabel;
  const symbol = currency === 'EUR' ? '€' : currency === 'USD' ? '$' : currency === 'GBP' ? '£' : `${currency} `;
  const amount = cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2);
  return `${symbol}${amount}`;
}

export default function Book() {
  const { t: TT } = useTheme();
  const router = useRouter();
  const { locale } = useI18n();
  const tr = T[locale];
  const formatLabel = (f: string) => tr.formats[f] ?? f;
  const params = useLocalSearchParams<{ rescheduleId?: string; sessionTypeId?: string; format?: string; demo?: string }>();
  const rescheduleId = typeof params.rescheduleId === 'string' ? params.rescheduleId : '';
  const isReschedule = !!rescheduleId;
  const { practitionerName } = useOnboarding();
  const name = practitionerName ?? tr.yourPractitioner;

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

  const title = isReschedule ? tr.reschedule : tr.bookTitle;
  const kicker = title.toUpperCase();

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: TT.bg }}>
        <StatusBar style="dark" />
        <EdHeader kicker={kicker} title={title} source={ONBOARDING_IMAGES.card4} onBack={back} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={TT.accent} /></View>
      </View>
    );
  }

  if (!data) {
    return (
      <View style={{ flex: 1, backgroundColor: TT.bg }}>
        <StatusBar style="dark" />
        <EdHeader kicker={kicker} title={title} source={ONBOARDING_IMAGES.card4} onBack={back} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: TT.ink }}>{tr.unavailable}</Text>
          <Text style={{ fontSize: 13.5, color: TT.inkSoft, textAlign: 'center', marginTop: 6, lineHeight: 20 }}>
            {tr.unavailableBody(name)}
          </Text>
        </View>
      </View>
    );
  }

  // The visible steps (reschedule shows only the last; a single-format practice
  // has no format step).
  const stepList: Step[] = isReschedule ? ['time'] : data.offeredFormats.length <= 1 ? ['service', 'time'] : ['service', 'format', 'time'];
  const stepIdx = stepList.indexOf(step);

  // Header title/subtitle track the active step.
  const headerTitle = step === 'service' ? tr.whatKind : step === 'format' ? tr.howMeet : tr.chooseTime;
  const headerSubtitle =
    step === 'service' ? tr.withName(name)
    : step === 'time' ? `${data.sessionTypes.find((t) => t.id === typeId)?.name ?? tr.session} · ${formatLabel(format ?? '')}`
    : undefined;

  const rail = stepList.length > 1 ? (
    <View style={{ flexDirection: 'row', gap: 6, marginBottom: 18 }}>
      {stepList.map((sName, i) => (
        <View key={sName} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: i <= stepIdx ? TT.accent : TT.line }} />
      ))}
    </View>
  ) : null;

  return (
    <View style={{ flex: 1, backgroundColor: TT.bg }}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={{ paddingBottom: step === 'time' ? 120 : 40 }} showsVerticalScrollIndicator={false}>
        <EdHeader kicker={kicker} title={headerTitle} subtitle={headerSubtitle} source={ONBOARDING_IMAGES.card4} onBack={back} />
        <FadeIn style={{ paddingHorizontal: 22, paddingTop: 20 }}>
          {rail}

          {step === 'service' ? (
            data.sessionTypes.map((t) => {
              const on = typeId === t.id;
              return (
                <TouchableOpacity key={t.id} onPress={() => chooseType(t.id)} activeOpacity={0.85}
                  style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: on ? TT.accentTint : TT.card, borderWidth: 1, borderColor: on ? TT.accent : TT.line, borderRadius: 18, padding: 16, marginBottom: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15.5, fontWeight: '700', color: TT.ink }}>{t.name}</Text>
                    <Text style={{ fontSize: 13, color: TT.inkSoft, marginTop: 2 }}>{t.durationMinutes} {tr.min} · {priceLabel(t.priceCents, data.currency, tr.noCharge)}</Text>
                  </View>
                  {on && <Check size={18} color={TT.accent} strokeWidth={2.5} />}
                </TouchableOpacity>
              );
            })
          ) : step === 'format' ? (
            data.offeredFormats.map((f) => {
              const Icon = FORMAT_ICON[f] ?? Video;
              const on = format === f;
              return (
                <TouchableOpacity key={f} onPress={() => chooseFormat(f)} activeOpacity={0.85}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: on ? TT.accentTint : TT.card, borderWidth: 1, borderColor: on ? TT.accent : TT.line, borderRadius: 18, padding: 16, marginBottom: 10 }}>
                  <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: TT.accentTint, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={19} color={TT.accent} strokeWidth={2} />
                  </View>
                  <Text style={{ flex: 1, fontSize: 15.5, fontWeight: '700', color: TT.ink }}>{formatLabel(f)}</Text>
                  {on && <Check size={18} color={TT.accent} strokeWidth={2.5} />}
                </TouchableOpacity>
              );
            })
          ) : slotsLoading ? (
            <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 80 }}><ActivityIndicator color={TT.accent} /></View>
          ) : days.length === 0 ? (
            <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 60, paddingHorizontal: 10 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: TT.ink }}>{tr.noTimes}</Text>
              <Text style={{ fontSize: 13.5, color: TT.inkSoft, textAlign: 'center', marginTop: 6, lineHeight: 20 }}>
                {tr.noTimesBody}
              </Text>
            </View>
          ) : (
            days.map((d) => {
              const open = openDay === d.date;
              return (
                <View key={d.date} style={{ backgroundColor: TT.card, borderWidth: 1, borderColor: TT.line, borderRadius: 18, overflow: 'hidden', marginBottom: 10 }}>
                  <TouchableOpacity onPress={() => setOpenDay(open ? '' : d.date)} activeOpacity={0.7} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 }}>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: TT.ink }}>{dayLabel(d.date, locale)}</Text>
                    {open ? <ChevronUp size={18} color={TT.faint} strokeWidth={2} /> : <ChevronDown size={18} color={TT.faint} strokeWidth={2} />}
                  </TouchableOpacity>
                  {open && (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, paddingBottom: 16 }}>
                      {d.slots.map((sl) => {
                        const on = pick === sl;
                        return (
                          <TouchableOpacity key={sl} onPress={() => setPick(sl)} activeOpacity={0.8} style={{ paddingVertical: 11, paddingHorizontal: 18, borderRadius: 14, backgroundColor: on ? TT.accent : TT.card, borderWidth: 1, borderColor: on ? TT.accent : TT.line }}>
                            <Text style={{ fontSize: 14, fontWeight: '700', color: on ? '#fff' : TT.ink }}>{slotTime(sl)}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                </View>
              );
            })
          )}
        </FadeIn>
      </ScrollView>

      {step === 'time' && !slotsLoading && days.length > 0 && (
        <View style={{ position: 'absolute', left: 22, right: 22, bottom: 24 }}>
          <EdPill label={pick ? tr.continueAt(slotTime(pick)) : tr.chooseTime} variant="dark" disabled={!pick} onPress={goConfirm} />
        </View>
      )}
    </View>
  );
}

// 'YYYY-MM-DD' → "Monday, 14 July" (built from parts to avoid tz rollover).
function dayLabel(dateStr: string, locale: Locale): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d, 12);
  const bcp = locale === 'fr' ? 'fr-FR' : 'en-GB';
  return `${dt.toLocaleDateString(bcp, { weekday: 'long' })}, ${d} ${dt.toLocaleDateString(bcp, { month: 'long' })}`;
}

// ISO instant → local 24h "9:00" / "14:00".
function slotTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

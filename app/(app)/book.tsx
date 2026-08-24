// c3 — Book a session. ONE page, not a wizard.
//
// It was three steps living in one route's local state, and every complaint
// about it came from that shape:
//
//   · Tapping a card NAVIGATED. You touched "Bilan" to read it and you had
//     already moved on. A wizard is a machine for pushing someone forward, and
//     booking a therapy session is not a checkout.
//   · The three steps shared one route, so the OS back gesture did not undo a
//     step — it dropped you out of booking entirely, losing type and format.
//     Only the chevron stepped back, and nobody uses the chevron.
//   · The state survived re-entry: coming back landed you mid-flow with a slot
//     already picked from last time.
//   · The progress rail showed three segments and then skipped one whenever the
//     practice offered a single format.
//
// Now: type, format and time are sections on one scroll. Choosing never
// navigates. A section that has an answer collapses to a summary row you can
// tap to reopen and compare; the next one reveals below it. The page grows
// downward as you decide, and what you have chosen is always on screen.
//
// Nothing is pre-picked for you. The old code selected the first available slot
// on load, so the button read "Continue · 9:00" before the patient had chosen
// anything. The format IS defaulted to the practitioner's own default, but it
// sits in plain sight as a summary row, one tap from being changed.
//
// RESCHEDULE keeps type and format fixed — the session already has both — so
// they show as a static line and only the time is editable.
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronDown, ChevronUp, Check, Video, Phone, MapPin } from 'lucide-react-native';
import { EdHeader, EdPill, FadeIn, Kicker } from '@/src/ui/editorial';
import { ONBOARDING_IMAGES } from '@/src/onboarding/editorial/images';
import { useOnboarding } from '@/src/onboarding/context';
import { FORCE_CARE_HUB } from '@/src/config';
import { fetchSlots, type SlotDay, type BookingSlots } from '@/src/api/booking';
import { useI18n, type Locale } from '@/src/i18n';
import { useTheme } from '@/src/ui/theme-mode';

/** Which section the patient has deliberately reopened to change their mind. */
type Editing = 'type' | 'format' | null;

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
    withName: (n: string) => `With ${n}`,
    min: 'min',
    noCharge: 'No charge',
    sectionType: 'Session',
    sectionFormat: 'How you will meet',
    sectionTime: 'When',
    change: 'Change',
    noTimes: 'No times available',
    noTimesBody: 'Your practitioner has no open slots for this session right now. Try another format, or check back later.',
    chooseTime: 'Choose a time',
    session: 'Session',
    bookAt: (when: string) => `Book ${when}`,
    moveTo: (when: string) => `Move to ${when}`,
    formats: { video: 'Video call', phone: 'Phone call', in_person: 'In person' } as Record<string, string>,
  },
  fr: {
    bookTitle: 'Réserver une séance',
    reschedule: 'Reprogrammer',
    yourPractitioner: 'votre praticien',
    unavailable: "La réservation n'est pas disponible",
    unavailableBody: (n: string) => `Revenez un peu plus tard, ou contactez ${n}.`,
    withName: (n: string) => `Avec ${n}`,
    min: 'min',
    noCharge: 'Gratuit',
    sectionType: 'Séance',
    sectionFormat: 'Comment vous échangerez',
    sectionTime: 'Quand',
    change: 'Modifier',
    noTimes: 'Aucun créneau disponible',
    noTimesBody: "Votre praticien n'a aucun créneau libre pour cette séance pour le moment. Essayez un autre format, ou revenez plus tard.",
    chooseTime: 'Choisissez un horaire',
    session: 'Séance',
    bookAt: (when: string) => `Réserver ${when}`,
    moveTo: (when: string) => `Déplacer au ${when}`,
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

  const [typeId, setTypeId] = useState<string | null>(params.sessionTypeId ?? null);
  const [format, setFormat] = useState<string | null>(params.format ?? null);
  const [editing, setEditing] = useState<Editing>(null);

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
        }
      } else if (FORCE_CARE_HUB || params.demo === '1') {
        setIsDemo(true);
        setData(demo());
      }
      setLoading(false);
    });
    return () => { alive = false; };
  }, [params.sessionTypeId, params.format, params.demo, isReschedule]);

  // Opening booking starts from nothing.
  //
  // Half-finished choices used to survive: you would leave, come back, and land
  // on a screen already holding a session type and a time from whenever you were
  // last here. Coming BACK from the confirmation screen is the one case where
  // that is wrong — you went there deliberately and returned to adjust — so
  // `goConfirm` marks the trip and this skips exactly once.
  //
  // Reschedule is exempt: it is always entered fresh from a specific session,
  // and its type and format come from the fetch, not from the patient.
  const returningFromConfirm = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (returningFromConfirm.current) { returningFromConfirm.current = false; return; }
      if (isReschedule) return;
      setTypeId(params.sessionTypeId ?? null);
      setFormat(params.format ?? null);
      setEditing(null);
      setDays([]);
      setOpenDay('');
      setPick(null);
    }, [isReschedule, params.sessionTypeId, params.format]),
  );

  // Slots depend on type (duration) and format, so both drive the fetch.
  // Deliberately does NOT pre-pick a slot: choosing the time is the patient's
  // decision, and a pre-filled one makes the button look like it is waiting on
  // them to agree rather than to choose.
  const loadSlots = async (t: string | null, f: string | null) => {
    if (isDemo) { const d = demo(); setDays(d.days); setOpenDay(d.days[0].date); setPick(null); return; }
    setSlotsLoading(true);
    const res = await fetchSlots({ sessionTypeId: t ?? undefined, format: f ?? undefined });
    setDays(res?.days ?? []);
    setOpenDay(res?.days[0]?.date ?? '');
    setPick(null);
    setSlotsLoading(false);
  };

  // Choosing a type defaults the format to the practitioner's own, so a
  // single-format practice is never asked. The format stays visible as a summary
  // row, one tap from being changed — a default in plain sight, not a decision
  // taken quietly on the patient's behalf.
  const chooseType = (id: string) => {
    if (id === typeId) { setEditing(null); return; }
    setTypeId(id);
    setEditing(null);
    const t = data?.sessionTypes.find((x) => x.id === id);
    const offered = data?.offeredFormats ?? [];
    const preferred = t && offered.includes(t.defaultFormat) ? t.defaultFormat : offered[0] ?? null;
    setFormat(preferred);
    void loadSlots(id, preferred);
  };

  const chooseFormat = (f: string) => {
    setEditing(null);
    if (f === format) return;
    setFormat(f);
    void loadSlots(typeId, f);
  };

  // One screen, so back means back. No step to unwind first.
  const back = () => (router.canGoBack() ? router.back() : router.navigate('/home' as never));

  const goConfirm = () => {
    if (!pick || !typeId || !format || !data) return;
    const dur = data.sessionTypes.find((t) => t.id === typeId)?.durationMinutes ?? 50;
    returningFromConfirm.current = true;
    router.navigate({
      pathname: '/book-confirm',
      params: { slotIso: pick, sessionTypeId: typeId, format, durationMinutes: String(dur), demo: isDemo ? '1' : '', rescheduleId },
    } as never);
  };

  const title = isReschedule ? tr.reschedule : tr.bookTitle;

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: TT.bg }}>
        <StatusBar style="dark" />
        <EdHeader title={title} source={ONBOARDING_IMAGES.card4} onBack={back} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={TT.accent} /></View>
      </View>
    );
  }

  if (!data) {
    return (
      <View style={{ flex: 1, backgroundColor: TT.bg }}>
        <StatusBar style="dark" />
        <EdHeader title={title} source={ONBOARDING_IMAGES.card4} onBack={back} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: TT.ink }}>{tr.unavailable}</Text>
          <Text style={{ fontSize: 13.5, color: TT.inkSoft, textAlign: 'center', marginTop: 6, lineHeight: 20 }}>
            {tr.unavailableBody(name)}
          </Text>
        </View>
      </View>
    );
  }

  const chosenType = data.sessionTypes.find((t) => t.id === typeId) ?? null;
  const manyFormats = data.offeredFormats.length > 1;

  // A section is open while it has no answer, or while the patient has reopened
  // it. Reschedule's type and format are not the patient's to change.
  const typeOpen = !isReschedule && (!typeId || editing === 'type');
  const formatOpen = !isReschedule && manyFormats && !!typeId && editing === 'format';
  const showTime = !!typeId && !!format;

  // "Wednesday, 26 August · 10:00" — a middot, because dayLabel already
  // carries a comma and two in one button reads as a list.
  const whenLabel = pick ? `${dayLabel(dayOf(pick), locale)} · ${slotTime(pick)}` : '';

  return (
    <View style={{ flex: 1, backgroundColor: TT.bg }}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={{ paddingBottom: showTime ? 120 : 40 }} showsVerticalScrollIndicator={false}>
        <EdHeader title={title} subtitle={tr.withName(name)} source={ONBOARDING_IMAGES.card4} onBack={back} />
        <FadeIn style={{ paddingHorizontal: 22, paddingTop: 20 }}>

          {/* ── Session type ─────────────────────────────────────────────── */}
          {!isReschedule && (
            <Section label={tr.sectionType}>
              {typeOpen ? (
                data.sessionTypes.map((t) => (
                  <Choice
                    key={t.id}
                    title={t.name}
                    sub={`${t.durationMinutes} ${tr.min} · ${priceLabel(t.priceCents, data.currency, tr.noCharge)}`}
                    selected={typeId === t.id}
                    onPress={() => chooseType(t.id)}
                  />
                ))
              ) : (
                <Summary
                  text={chosenType ? `${chosenType.name} · ${chosenType.durationMinutes} ${tr.min} · ${priceLabel(chosenType.priceCents, data.currency, tr.noCharge)}` : tr.session}
                  action={tr.change}
                  onPress={() => setEditing('type')}
                />
              )}
            </Section>
          )}

          {/* ── How you will meet ────────────────────────────────────────── */}
          {!!typeId && manyFormats && !isReschedule && (
            <Section label={tr.sectionFormat}>
              {formatOpen ? (
                data.offeredFormats.map((f) => (
                  <Choice
                    key={f}
                    Icon={FORMAT_ICON[f] ?? Video}
                    title={formatLabel(f)}
                    selected={format === f}
                    onPress={() => chooseFormat(f)}
                  />
                ))
              ) : (
                <Summary text={formatLabel(format ?? '')} action={tr.change} onPress={() => setEditing('format')} />
              )}
            </Section>
          )}

          {/* Reschedule cannot change either, so it states them once. */}
          {isReschedule && chosenType && (
            <Section label={tr.sectionType}>
              <Summary text={`${chosenType.name} · ${formatLabel(format ?? '')}`} />
            </Section>
          )}

          {/* ── When ─────────────────────────────────────────────────────── */}
          {showTime && (
            <Section label={tr.sectionTime}>
              {slotsLoading ? (
                <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 44 }}><ActivityIndicator color={TT.accent} /></View>
              ) : days.length === 0 ? (
                <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 34, paddingHorizontal: 10 }}>
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
                                <Text style={{ fontSize: 14, fontWeight: '700', color: on ? TT.onAccent : TT.ink }}>{slotTime(sl)}</Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      )}
                    </View>
                  );
                })
              )}
            </Section>
          )}
        </FadeIn>
      </ScrollView>

      {/* Names the booking rather than saying "Continue", and stays inert until
          the patient has actually chosen a time. */}
      {showTime && !slotsLoading && days.length > 0 && (
        <View style={{ position: 'absolute', left: 22, right: 22, bottom: 24 }}>
          <EdPill
            label={pick ? (isReschedule ? tr.moveTo(whenLabel) : tr.bookAt(whenLabel)) : tr.chooseTime}
            variant="dark"
            disabled={!pick}
            onPress={goConfirm}
          />
        </View>
      )}
    </View>
  );
}

/** A titled group. The label is what makes the page readable as a summary of
 *  decisions rather than a list of controls. */
function Section({ label, children }: { label: string; children: React.ReactNode }) {
  const { t: TT } = useTheme();
  return (
    <View style={{ marginBottom: 22 }}>
      <Kicker color={TT.faint} style={{ marginBottom: 10 }}>{label}</Kicker>
      {children}
    </View>
  );
}

/** One option among several. Tapping it selects — it never navigates. */
function Choice({ Icon, title, sub, selected, onPress }: {
  Icon?: typeof Video;
  title: string;
  sub?: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { t: TT } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: selected ? TT.accentTint : TT.card, borderWidth: 1, borderColor: selected ? TT.accent : TT.line, borderRadius: 18, padding: 16, marginBottom: 10 }}
    >
      {Icon ? (
        <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: TT.accentTint, alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={19} color={TT.accent} strokeWidth={2} />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15.5, fontWeight: '700', color: TT.ink }}>{title}</Text>
        {sub ? <Text style={{ fontSize: 13, color: TT.inkSoft, marginTop: 2 }}>{sub}</Text> : null}
      </View>
      {selected && <Check size={18} color={TT.accent} strokeWidth={2.5} />}
    </TouchableOpacity>
  );
}

/** A decision already made, still on screen. Without `onPress` it is a
 *  statement (reschedule); with one, it reopens the section. */
function Summary({ text, action, onPress }: { text: string; action?: string; onPress?: () => void }) {
  const { t: TT } = useTheme();
  const body = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: TT.card, borderWidth: 1, borderColor: TT.line, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 15 }}>
      <Text style={{ flex: 1, fontSize: 15, fontWeight: '700', color: TT.ink }}>{text}</Text>
      {action ? <Text style={{ fontSize: 13.5, fontWeight: '700', color: TT.accent }}>{action}</Text> : null}
    </View>
  );
  if (!onPress) return body;
  return <TouchableOpacity onPress={onPress} activeOpacity={0.8}>{body}</TouchableOpacity>;
}

// 'YYYY-MM-DD' → "Monday, 14 July" (built from parts to avoid tz rollover).
function dayLabel(dateStr: string, locale: Locale): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d, 12);
  const bcp = locale === 'fr' ? 'fr-FR' : 'en-GB';
  // English puts a comma after the weekday, French does not — "Wednesday, 26
  // August" but "mercredi 26 août". Intl will not do this for us: en-GB's own
  // long date has no comma either, which is why these are hand-built.
  const sep = locale === 'fr' ? ' ' : ', ';
  return `${dt.toLocaleDateString(bcp, { weekday: 'long' })}${sep}${d} ${dt.toLocaleDateString(bcp, { month: 'long' })}`;
}

// The local calendar day an instant falls on, as 'YYYY-MM-DD'.
function dayOf(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ISO instant → local 24h "9:00" / "14:00".
function slotTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { EdHeader, EdCard, EdPill, EdSection, FadeIn } from '@/src/ui/editorial';
import { MonthCalendar } from '@/src/ui/MonthCalendar';
import { notify } from '@/src/ui/alert';
import { useI18n } from '@/src/i18n';
import { patientLabel } from '@/src/practitioner/pending-label';
import { fetchPatients, fetchBookingOptions, rescheduleSession, type PatientListItem, type SessionTypeOption, type NextAvailableDay } from '@/src/api/practitioner';
import { useTheme } from '@/src/ui/theme-mode';
import { localizeServerMessage } from '@/src/api/server-messages';
import { LoadFailed } from '@/src/ui/LoadFailed';

// Book a session: who, what kind, which day, which slot.
//
// The slots are NOT computed here. They come from the same availability the web
// uses — schedule, overrides, existing appointments — so a slot offered on the
// phone is a slot that genuinely exists. Booking goes through the same action
// too, which snapshots the price, mirrors to Google and emails the patient.

const T = {
  en: {
    kicker: 'BOOK', title: 'Book a session',
    who: 'WHO IS IT WITH?', kind: 'WHAT KIND?', day: 'WHICH DAY?', slot: 'WHICH TIME?',
    noSlots: 'No free slots that day.', nextFree: 'NEXT FREE', slotOne: 'slot', slotMany: 'slots',
    noPatients: 'No patients yet.', change: 'Change',
    moveKicker: 'MOVE', moveTitle: 'Move this session', moving: 'Moving…', moved: 'Session moved.',
    continueWith: 'Continue with {time}',
    nearestNote: 'Nothing free at {asked}. The closest is {got} — or pick another below.',
  },
  fr: {
    kicker: 'RÉSERVER', title: 'Réserver une séance',
    who: 'AVEC QUI ?', kind: 'QUEL TYPE ?', day: 'QUEL JOUR ?', slot: 'QUELLE HEURE ?',
    noSlots: 'Aucun créneau libre ce jour-là.', nextFree: 'PROCHAINES DISPOS', slotOne: 'créneau', slotMany: 'créneaux',
    noPatients: 'Aucun patient.', change: 'Changer',
    moveKicker: 'DÉPLACER', moveTitle: 'Déplacer cette séance', moving: 'Déplacement…', moved: 'Séance déplacée.',
    continueWith: 'Continuer à {time}',
    nearestNote: 'Rien de libre à {asked}. Le plus proche est {got} — ou choisissez ci-dessous.',
  },
} as const;

const fill = (s: string, vars: Record<string, string>) => s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');

export default function Book() {
  const { t: TT } = useTheme();
  const router = useRouter();
  const { locale, t } = useI18n();
  const tr = T[locale] ?? T.en;

  // Three ways in, one screen:
  //   nothing            → the full flow (who → kind → day → slot)
  //   initialDate/Time   → tapped a gap in the day calendar; the day is decided
  //   rescheduleId       → moving an existing session; who and kind are decided
  //
  // Moving a session is the same question as booking one ("which free slot?"),
  // asked about an appointment that already exists. Giving it its own screen
  // would mean maintaining two copies of the availability UI, and the second
  // copy is always the one that goes stale.
  const params = useLocalSearchParams<{
    initialDate?: string; initialTime?: string;
    rescheduleId?: string; name?: string; duration?: string; format?: string; sessionType?: string;
  }>();
  const moveId = typeof params.rescheduleId === 'string' && params.rescheduleId ? params.rescheduleId : null;
  const moveDuration = Number(params.duration) || 60;

  const [patientsFailed, setPatientsFailed] = useState(false);
  // Bumped by Try again; the focus effect below reads it, so a retry re-runs
  // exactly the same load.
  const [attempt, setAttempt] = useState(0);
  const [patients, setPatients] = useState<PatientListItem[]>([]);
  const [types, setTypes] = useState<SessionTypeOption[]>([]);
  const [patient, setPatient] = useState<PatientListItem | null>(null);
  const [type, setType] = useState<SessionTypeOption | null>(null);
  const [date, setDate] = useState<string | null>(typeof params.initialDate === 'string' ? params.initialDate : null);
  const [slots, setSlots] = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [nextFree, setNextFree] = useState<NextAvailableDay[]>([]);
  const [moving, setMoving] = useState(false);
  // Only set once the practitioner picks a different time from the one they
  // tapped; until then the tapped one stands.
  const [picked, setPicked] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      void Promise.all([fetchPatients(), fetchBookingOptions()]).then(([pats, opts]) => {
        if (!alive) return;
        // A failed read is not an empty caseload. Without this the booking
        // screen told a practitioner with 40 patients that she had none.
        setPatientsFailed(!pats);
        if (pats) setPatients(pats);
        setTypes(opts?.sessionTypes ?? []);
        setNextFree(opts?.nextAvailable ?? []);
        // Keep a type the practitioner already picked; only default when none.
        if (opts?.sessionTypes?.length) setType((cur) => cur ?? opts.sessionTypes[0]);
      });
      return () => { alive = false; };
      // `attempt` is the retry trigger: it is not read inside, changing it is
      // the whole point.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [attempt]),
  );

  // Re-ask for slots whenever the day or the kind changes: duration and format
  // both move the answer.
  useEffect(() => {
    if (!date) return;
    // Moving a session asks about ITS length and format, not the default type's
    // — a 90-minute session offered 60-minute gaps would be offered slots it
    // cannot actually fit in.
    const duration = moveId ? moveDuration : type?.durationMinutes;
    const format = moveId ? (params.format ?? 'video') : type?.defaultFormat;
    if (!duration || !format) return;
    let alive = true;
    setSlotsLoading(true);
    // A time chosen on one day means nothing on another.
    setPicked(null);
    void fetchBookingOptions({ date, duration, format }).then((res) => {
      if (!alive) return;
      if (res?.timezone) setTz(res.timezone);
      setSlots(res?.slots ?? []);
      setSlotsLoading(false);
    });
    return () => { alive = false; };
  }, [date, type, moveId, moveDuration, params.format]);

  // Without a date the server answers with the days that actually have room, so
  // "next available" is a real answer rather than a guess the user has to hunt
  // for by tapping days one at a time.
  useEffect(() => {
    if (!type) return;
    let alive = true;
    void fetchBookingOptions({ duration: type.durationMinutes, format: type.defaultFormat }).then((res) => {
      if (alive) setNextFree(res?.nextAvailable ?? []);
    });
    return () => { alive = false; };
  }, [type]);

  // Times in the PRACTICE's timezone, the one the calendar is drawn in. They were
  // shown in the phone's, so a practitioner travelling (or on a laptop set to
  // another zone) tapped 10:00, was offered "09:00", and booked it.
  const [tz, setTz] = useState<string | undefined>(undefined);
  const zone = tz ? { timeZone: tz } : {};
  const time = (iso: string) => new Date(iso).toLocaleTimeString(locale === 'fr' ? 'fr-FR' : 'en-GB', { hour: '2-digit', minute: '2-digit', ...zone });
  /** Minutes past midnight of an instant, on the practice's clock. */
  const minutesOf = (iso: string) => {
    const parts = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', ...zone }).formatToParts(new Date(iso));
    const get = (t: string) => Number(parts.find((x) => x.type === t)?.value ?? 0);
    return get('hour') * 60 + get('minute');
  };

  // Picking a time does NOT book it. It goes to a confirmation, the same shape
  // as the patient's flow — booking is the one action here that reaches into
  // somebody else's calendar and inbox, so it gets a deliberate second step.
  const review = (slot: string) => {
    if (!patient || !type) return;
    router.navigate({
      pathname: '/(practitioner)/book-confirm',
      params: {
        memberId: patient.id, name: patient.name, sessionTypeId: type.id, label: type.label,
        scheduledAt: slot, format: type.defaultFormat, duration: String(type.durationMinutes), ...(tz ? { tz } : {}),
      },
    } as never);
  };

  // Moving is a single step, unlike booking. Booking gets a confirmation because
  // it creates a commitment in someone else's calendar out of nothing; moving
  // one that already exists, to a slot the server just said was free, is the
  // change the practitioner already decided on when they opened this screen.
  const move = (slot: string) => {
    if (!moveId || moving) return;
    setMoving(true);
    void rescheduleSession(moveId, { scheduledAt: slot, durationMinutes: moveDuration }).then((res) => {
      setMoving(false);
      if (!res.ok) { notify(tr.moveTitle, localizeServerMessage(res.error, locale) ?? t.common.somethingWrong); return; }
      notify(tr.moveTitle, tr.moved);
      back();
    });
  };

  // The slot nearest the time tapped on the day grid.
  //
  // Arriving from a tap, this becomes the SELECTED slot rather than a hint:
  // the tap already answered "when", and asking again — with the answer sitting
  // right there, ringed, waiting to be tapped a second time — is the app not
  // listening. It stays changeable, because "around 16:00" is what a tap can
  // honestly mean, and the exact free slots may sit either side of it.
  const nearest = (() => {
    if (typeof params.initialTime !== 'string' || slots.length === 0) return null;
    const [h, m] = params.initialTime.split(':').map(Number);
    if (!Number.isFinite(h)) return null;
    const want = h * 60 + (m || 0);
    let best: string | null = null;
    let bestGap = Infinity;
    for (const s of slots) {
      const gap = Math.abs(minutesOf(s) - want);
      if (gap < bestGap) { bestGap = gap; best = s; }
    }
    return best;
  })();

  // Booking straight from the + button asks for a time in the usual way, and a
  // tap on a slot goes on to the confirmation. Only the tapped-a-gap route
  // arrives with an answer already, and only it gets the Continue button.
  // Only while they are still on the day they tapped. Stepping to another day
  // makes the tapped time meaningless, and preselecting a time on a day nobody
  // chose would be worse than asking.
  const fromTap = typeof params.initialTime === 'string' && !moveId && date === params.initialDate;
  const chosen = fromTap ? (picked ?? nearest) : picked;
  // Whether the tap landed on a real free slot or merely near one — worth
  // saying, because "you asked for 16:00, the nearest free time is 16:30" is
  // information, and silently moving them is not.
  const exact = (() => {
    if (!fromTap || !chosen || typeof params.initialTime !== 'string') return true;
    const mins = minutesOf(chosen);
    return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}` === params.initialTime;
  })();

  const back = () => (router.canGoBack() ? router.back() : router.navigate('/(practitioner)/home' as never));

  return (
    <View style={{ flex: 1, backgroundColor: TT.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        <EdHeader kicker={moveId ? tr.moveKicker : tr.kicker} title={moveId ? tr.moveTitle : tr.title} onBack={back} />

        <FadeIn style={{ paddingHorizontal: 22, paddingTop: 20 }}>
          {/* Moving a session already knows who and what kind. Asking again
              would invite changing them by accident on the way past. */}
          {moveId ? (
            <EdCard style={{ marginBottom: 22 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: TT.ink }}>{params.name ?? ''}</Text>
              <Text style={{ fontSize: 12.5, color: TT.faint, marginTop: 2 }}>
                {params.sessionType ? `${params.sessionType} · ` : ''}{moveDuration} min
              </Text>
            </EdCard>
          ) : (
            <>
          <EdSection label={tr.who} />
          {!patient ? (
            <>
              {patients.length === 0 && patientsFailed && <LoadFailed compact onRetry={() => { setAttempt((n) => n + 1); }} />}
              {patients.length === 0 && !patientsFailed && <Text style={{ fontSize: 14, color: TT.inkSoft }}>{tr.noPatients}</Text>}
              {patients.map((p) => (
                <EdCard key={p.id} onPress={() => setPatient(p)} style={{ marginBottom: 10 }}>
                  <Text style={{ fontSize: 15, fontWeight: '600', color: TT.ink }}>{patientLabel(p, locale)}</Text>
                </EdCard>
              ))}
            </>
          ) : (
            <EdCard onPress={() => setPatient(null)} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 22 }}>
              <Text style={{ flex: 1, fontSize: 15, fontWeight: '700', color: TT.ink }}>{patient.name}</Text>
              <Text style={{ fontSize: 13, fontWeight: '700', color: TT.accent }}>{tr.change}</Text>
            </EdCard>
          )}

          {patient && types.length > 0 && (
            <>
              <EdSection label={tr.kind} />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 22 }}>
                {types.map((t) => {
                  const on = t.id === type?.id;
                  return (
                    <Pressable
                      key={t.id}
                      onPress={() => setType(t)}
                      style={{ borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: on ? TT.accentTint : TT.card, borderWidth: 1.5, borderColor: on ? TT.accent : TT.line }}
                    >
                      <Text style={{ fontSize: 14, fontWeight: '700', color: on ? TT.accentDeep : TT.inkSoft }}>{t.label}</Text>
                      <Text style={{ fontSize: 11.5, color: TT.faint, marginTop: 1 }}>{t.durationMinutes} min</Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}
            </>
          )}

          {(moveId || (patient && type)) && (
            <>
              <EdSection label={tr.day} />
              <MonthCalendar
                selected={date}
                onSelect={setDate}
                locale={locale}
                markedDays={new Set(nextFree.map((d) => d.date))}
              />

              {nextFree.length > 0 && (
                <View style={{ marginTop: 16 }}>
                  <EdSection label={tr.nextFree} />
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      {nextFree.map((d) => (
                        <Pressable
                          key={d.date}
                          onPress={() => setDate(d.date)}
                          style={{ borderRadius: 16, paddingHorizontal: 13, paddingVertical: 10, backgroundColor: TT.card, borderWidth: 1.5, borderColor: d.date === date ? TT.accent : TT.line }}
                        >
                          <Text style={{ fontSize: 13, fontWeight: '700', color: TT.ink }}>
                            {new Date(`${d.date}T00:00:00`).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                          </Text>
                          <Text style={{ fontSize: 11.5, color: TT.accent, marginTop: 1 }}>
                            {d.slots.length} {d.slots.length === 1 ? tr.slotOne : tr.slotMany}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </ScrollView>
                </View>
              )}
              <View style={{ height: 22 }} />
            </>
          )}

          {(moveId || (patient && type)) && date && (
            <>
              <EdSection label={tr.slot} />
              {(slotsLoading || moving) && <ActivityIndicator />}
              {!slotsLoading && slots.length === 0 && <Text style={{ fontSize: 14, color: TT.inkSoft }}>{tr.noSlots}</Text>}
              {/* Say so when the tapped time was not itself free, rather than
                  quietly substituting the nearest one. */}
              {fromTap && chosen && !exact && !slotsLoading && (
                <Text style={{ fontSize: 13, color: TT.inkSoft, marginBottom: 10, lineHeight: 19 }}>
                  {fill(tr.nearestNote, { asked: params.initialTime as string, got: time(chosen) })}
                </Text>
              )}

              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                {slots.map((s) => {
                  const on = s === chosen;
                  return (
                    <Pressable
                      key={s}
                      // Coming from a tap, a slot only CHANGES the selection —
                      // Continue is what commits. Booking from scratch keeps the
                      // straight-through tap, which is the flow that already
                      // worked and the one people know.
                      onPress={() => (moveId ? move(s) : fromTap ? setPicked(s) : review(s))}
                      disabled={moving}
                      style={{ borderRadius: 18, paddingHorizontal: 16, paddingVertical: 11, backgroundColor: on ? TT.accent : TT.card, borderWidth: 1.5, borderColor: on ? TT.accent : TT.line, opacity: moving ? 0.5 : 1 }}
                    >
                      <Text style={{ fontSize: 14.5, fontWeight: '700', color: on ? TT.onAccent : TT.ink }}>{time(s)}</Text>
                    </Pressable>
                  );
                })}
              </View>

              {fromTap && chosen && (
                <EdPill
                  label={fill(tr.continueWith, { time: time(chosen) })}
                  variant="green"
                  onPress={() => review(chosen)}
                  style={{ marginTop: 22 }}
                />
              )}
            </>
          )}

        </FadeIn>
      </ScrollView>
    </View>
  );
}

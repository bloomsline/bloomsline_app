import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect, useRouter } from 'expo-router';
import { EDA, EdHeader, EdCard, EdSection, FadeIn } from '@/src/ui/editorial';
import { MonthCalendar } from '@/src/ui/MonthCalendar';
import { useI18n } from '@/src/i18n';
import { fetchPatients, fetchBookingOptions, type PatientListItem, type SessionTypeOption, type NextAvailableDay } from '@/src/api/practitioner';

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
  },
  fr: {
    kicker: 'RÉSERVER', title: 'Réserver une séance',
    who: 'AVEC QUI ?', kind: 'QUEL TYPE ?', day: 'QUEL JOUR ?', slot: 'QUELLE HEURE ?',
    noSlots: 'Aucun créneau libre ce jour-là.', nextFree: 'PROCHAINES DISPOS', slotOne: 'créneau', slotMany: 'créneaux',
    noPatients: 'Aucun patient.', change: 'Changer',
  },
} as const;

export default function Book() {
  const router = useRouter();
  const { locale } = useI18n();
  const tr = T[locale] ?? T.en;

  const [patients, setPatients] = useState<PatientListItem[]>([]);
  const [types, setTypes] = useState<SessionTypeOption[]>([]);
  const [patient, setPatient] = useState<PatientListItem | null>(null);
  const [type, setType] = useState<SessionTypeOption | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [nextFree, setNextFree] = useState<NextAvailableDay[]>([]);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      void Promise.all([fetchPatients(), fetchBookingOptions()]).then(([pats, opts]) => {
        if (!alive) return;
        setPatients(pats ?? []);
        setTypes(opts?.sessionTypes ?? []);
        setNextFree(opts?.nextAvailable ?? []);
        // Keep a type the practitioner already picked; only default when none.
        if (opts?.sessionTypes?.length) setType((cur) => cur ?? opts.sessionTypes[0]);
      });
      return () => { alive = false; };
    }, []),
  );

  // Re-ask for slots whenever the day or the kind changes: duration and format
  // both move the answer.
  useEffect(() => {
    if (!date || !type) return;
    let alive = true;
    setSlotsLoading(true);
    void fetchBookingOptions({ date, duration: type.durationMinutes, format: type.defaultFormat }).then((res) => {
      if (!alive) return;
      setSlots(res?.slots ?? []);
      setSlotsLoading(false);
    });
    return () => { alive = false; };
  }, [date, type]);

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

  const time = (iso: string) => new Date(iso).toLocaleTimeString(locale === 'fr' ? 'fr-FR' : 'en-GB', { hour: '2-digit', minute: '2-digit' });

  // Picking a time does NOT book it. It goes to a confirmation, the same shape
  // as the patient's flow — booking is the one action here that reaches into
  // somebody else's calendar and inbox, so it gets a deliberate second step.
  const review = (slot: string) => {
    if (!patient || !type) return;
    router.navigate({
      pathname: '/(practitioner)/book-confirm',
      params: {
        memberId: patient.id, name: patient.name, sessionTypeId: type.id, label: type.label,
        scheduledAt: slot, format: type.defaultFormat, duration: String(type.durationMinutes),
      },
    } as never);
  };

  const back = () => (router.canGoBack() ? router.back() : router.navigate('/(practitioner)/home' as never));

  return (
    <View style={{ flex: 1, backgroundColor: EDA.canvas }}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        <EdHeader kicker={tr.kicker} title={tr.title} onBack={back} />

        <FadeIn style={{ paddingHorizontal: 22, paddingTop: 20 }}>
          <EdSection label={tr.who} />
          {!patient ? (
            <>
              {patients.length === 0 && <Text style={{ fontSize: 14, color: EDA.inkSoft }}>{tr.noPatients}</Text>}
              {patients.map((p) => (
                <EdCard key={p.id} onPress={() => setPatient(p)} style={{ marginBottom: 10 }}>
                  <Text style={{ fontSize: 15, fontWeight: '600', color: EDA.ink }}>{p.name}</Text>
                </EdCard>
              ))}
            </>
          ) : (
            <EdCard onPress={() => setPatient(null)} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 22 }}>
              <Text style={{ flex: 1, fontSize: 15, fontWeight: '700', color: EDA.ink }}>{patient.name}</Text>
              <Text style={{ fontSize: 13, fontWeight: '700', color: EDA.green }}>{tr.change}</Text>
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
                      style={{ borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: on ? EDA.greenTint : EDA.card, borderWidth: 1.5, borderColor: on ? EDA.green : EDA.line }}
                    >
                      <Text style={{ fontSize: 14, fontWeight: '700', color: on ? EDA.greenDeep : EDA.inkSoft }}>{t.label}</Text>
                      <Text style={{ fontSize: 11.5, color: EDA.faint, marginTop: 1 }}>{t.durationMinutes} min</Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}

          {patient && type && (
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
                          style={{ borderRadius: 16, paddingHorizontal: 13, paddingVertical: 10, backgroundColor: EDA.card, borderWidth: 1.5, borderColor: d.date === date ? EDA.green : EDA.line }}
                        >
                          <Text style={{ fontSize: 13, fontWeight: '700', color: EDA.ink }}>
                            {new Date(`${d.date}T00:00:00`).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                          </Text>
                          <Text style={{ fontSize: 11.5, color: EDA.green, marginTop: 1 }}>
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

          {patient && type && date && (
            <>
              <EdSection label={tr.slot} />
              {slotsLoading && <ActivityIndicator />}
              {!slotsLoading && slots.length === 0 && <Text style={{ fontSize: 14, color: EDA.inkSoft }}>{tr.noSlots}</Text>}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                {slots.map((s) => (
                  <Pressable
                    key={s}
                    onPress={() => review(s)}
                    style={{ borderRadius: 18, paddingHorizontal: 16, paddingVertical: 11, backgroundColor: EDA.card, borderWidth: 1.5, borderColor: EDA.line }}
                  >
                    <Text style={{ fontSize: 14.5, fontWeight: '700', color: EDA.ink }}>{time(s)}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}

        </FadeIn>
      </ScrollView>
    </View>
  );
}

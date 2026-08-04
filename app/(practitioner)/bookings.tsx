import { useCallback, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect, useRouter } from 'expo-router';
import { CalendarPlus, Check, MapPin, Phone, Video, X } from 'lucide-react-native';
import { EDA, EdHeader, EdCard, EdSection, FadeIn } from '@/src/ui/editorial';
import { PractitionerTabBar, PRACTITIONER_TAB_PAD } from '@/src/ui/PractitionerTabBar';
import { useConfirm } from '@/src/ui/confirm';
import { useI18n } from '@/src/i18n';
import { fetchDay, fetchRequests, decideRequest, type PractitionerSession, type BookingRequest } from '@/src/api/practitioner';

// The agenda: what is booked, and what is waiting on a decision.
const T = {
  en: {
    kicker: 'AGENDA', title: 'Your sessions',
    requests: 'WAITING ON YOU', today: 'TODAY', tomorrow: 'TOMORROW',
    nothing: 'Nothing scheduled.', approve: 'Approve', decline: 'Decline',
    declineTitle: 'Decline this request?', declineBody: 'They will be told the time was not confirmed.',
    cancel: 'Cancel', join: 'Join', guest: 'Guest booking',
    offline: 'Could not load. Open the screen again to retry.',
  },
  fr: {
    kicker: 'AGENDA', title: 'Vos séances',
    requests: 'EN ATTENTE DE VOUS', today: 'AUJOURD’HUI', tomorrow: 'DEMAIN',
    nothing: 'Rien de prévu.', approve: 'Accepter', decline: 'Refuser',
    declineTitle: 'Refuser cette demande ?', declineBody: 'La personne sera informée que le créneau n’a pas été confirmé.',
    cancel: 'Annuler', join: 'Rejoindre', guest: 'Réservation invitée',
    offline: 'Chargement impossible. Rouvrez l’écran pour réessayer.',
  },
} as const;

const FORMAT_ICON = { video: Video, in_person: MapPin, phone: Phone } as const;

export default function Bookings() {
  const router = useRouter();
  const confirm = useConfirm();
  const { locale } = useI18n();
  const tr = T[locale] ?? T.en;

  const [sessions, setSessions] = useState<PractitionerSession[]>([]);
  const [requests, setRequests] = useState<BookingRequest[]>([]);
  const [tz, setTz] = useState<string | undefined>();
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    let alive = true;
    void Promise.all([fetchDay(), fetchRequests()]).then(([day, reqs]) => {
      if (!alive) return;
      setFailed(!day && !reqs);
      if (day) { setSessions(day.items); setTz(day.timezone); }
      if (reqs) setRequests(reqs.items);
      setLoaded(true);
    });
    return () => { alive = false; };
  }, []);
  useFocusEffect(load);

  // The practitioner's own timezone decides what "today" is, not the phone's —
  // someone travelling still sees their practice's schedule.
  const zone = tz ? { timeZone: tz } : {};
  const dayKey = (iso: string) => new Date(iso).toLocaleDateString('en-CA', zone);
  const todayKey = new Date().toLocaleDateString('en-CA', zone);
  const time = (iso: string) => new Date(iso).toLocaleTimeString(locale === 'fr' ? 'fr-FR' : 'en-GB', { hour: '2-digit', minute: '2-digit', ...zone });
  const dayLabel = (iso: string) => new Date(iso).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long', ...zone });

  const today = sessions.filter((s) => dayKey(s.scheduledAt) === todayKey);
  const later = sessions.filter((s) => dayKey(s.scheduledAt) !== todayKey);

  const decide = async (r: BookingRequest, action: 'approve' | 'decline') => {
    if (action === 'decline') {
      const ok = await confirm({ title: tr.declineTitle, message: tr.declineBody, confirmLabel: tr.decline, cancelLabel: tr.cancel, destructive: true });
      if (!ok) return;
    }
    setError(''); setBusyId(r.id);
    const res = await decideRequest(r.id, action);
    setBusyId(null);
    // A refused decision means somebody got there first, so the list is stale.
    if (!res.ok) setError(res.error ?? '');
    load();
  };

  return (
    <View style={{ flex: 1, backgroundColor: EDA.canvas }}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={{ paddingBottom: PRACTITIONER_TAB_PAD }} showsVerticalScrollIndicator={false}>
        <EdHeader kicker={tr.kicker} title={tr.title} rightIcon={CalendarPlus} onRight={() => router.navigate('/(practitioner)/book' as never)} />

        <FadeIn style={{ paddingHorizontal: 22, paddingTop: 20 }}>
          {!loaded && <ActivityIndicator />}
          {loaded && failed && <Text style={{ fontSize: 14, color: EDA.inkSoft }}>{tr.offline}</Text>}

          {loaded && !failed && (
            <>
              {requests.length > 0 && (
                <View style={{ marginBottom: 22 }}>
                  <EdSection label={tr.requests} />
                  {requests.map((r) => (
                    <EdCard key={r.id} style={{ marginBottom: 10 }}>
                      <Text style={{ fontSize: 15.5, fontWeight: '700', color: EDA.ink }}>{r.who}</Text>
                      <Text style={{ fontSize: 13, color: EDA.inkSoft, marginTop: 3 }}>
                        {dayLabel(r.scheduledAt)} · {time(r.scheduledAt)} · {r.durationMinutes} min{r.isGuest ? ` · ${tr.guest}` : ''}
                      </Text>
                      <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                        <Pressable
                          onPress={() => decide(r, 'approve')}
                          disabled={busyId === r.id}
                          style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 44, borderRadius: 22, backgroundColor: EDA.ink }}
                        >
                          {busyId === r.id ? <ActivityIndicator color="#fff" size="small" /> : <Check size={15} color="#fff" strokeWidth={3} />}
                          <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff' }}>{tr.approve}</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => decide(r, 'decline')}
                          disabled={busyId === r.id}
                          style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 44, borderRadius: 22, borderWidth: 1.5, borderColor: EDA.line }}
                        >
                          <X size={15} color={EDA.inkSoft} strokeWidth={2.5} />
                          <Text style={{ fontSize: 14, fontWeight: '600', color: EDA.inkSoft }}>{tr.decline}</Text>
                        </Pressable>
                      </View>
                    </EdCard>
                  ))}
                  {error ? <Text style={{ fontSize: 13, color: '#C0392B' }}>{error}</Text> : null}
                </View>
              )}

              <Section label={tr.today} sessions={today} empty={tr.nothing} time={time} join={tr.join} />
              {later.length > 0 && <Section label={tr.tomorrow} sessions={later} time={time} join={tr.join} />}
            </>
          )}
        </FadeIn>
      </ScrollView>

      <PractitionerTabBar active="bookings" />
    </View>
  );
}

function Section({ label, sessions, empty, time, join }: { label: string; sessions: PractitionerSession[]; empty?: string; time: (iso: string) => string; join: string }) {
  return (
    <View style={{ marginBottom: 22 }}>
      <EdSection label={label} />
      {sessions.length === 0 && empty ? (
        <EdCard><Text style={{ fontSize: 14, color: EDA.inkSoft }}>{empty}</Text></EdCard>
      ) : (
        sessions.map((s) => {
          const Icon = FORMAT_ICON[s.sessionFormat as keyof typeof FORMAT_ICON] ?? MapPin;
          return (
            <EdCard key={s.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 10 }}>
              <View style={{ width: 54 }}>
                <Text style={{ fontSize: 15, fontWeight: '800', color: EDA.ink }}>{time(s.scheduledAt)}</Text>
                <Text style={{ fontSize: 11.5, color: EDA.faint }}>{s.durationMinutes} min</Text>
              </View>
              <View style={{ width: 1, height: 30, backgroundColor: EDA.line }} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: EDA.ink }}>{s.who}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                  <Icon size={12} color={EDA.faint} />
                  <Text style={{ fontSize: 12.5, color: EDA.inkSoft }}>{s.location || s.sessionFormat.replace('_', ' ')}</Text>
                </View>
              </View>
              {s.meetLink ? (
                <Pressable onPress={() => { void Linking.openURL(s.meetLink as string); }} style={{ borderRadius: 20, backgroundColor: EDA.greenTint, paddingHorizontal: 12, paddingVertical: 6 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: EDA.green }}>{join}</Text>
                </Pressable>
              ) : null}
            </EdCard>
          );
        })
      )}
    </View>
  );
}

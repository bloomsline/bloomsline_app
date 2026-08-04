import { useCallback, useState } from 'react';
import { ActivityIndicator, Linking, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { CalendarDays, Video, MapPin, Phone, Check, X } from 'lucide-react-native';
import { Screen } from '@/src/ui/Screen';
import { Button } from '@/src/ui/Button';
import { useAuth } from '@/src/auth/auth-context';
import { useConfirm } from '@/src/ui/confirm';
import { useI18n } from '@/src/i18n';
import {
  fetchDay, fetchRequests, decideRequest,
  type PractitionerSession, type BookingRequest,
} from '@/src/api/practitioner';

// The practitioner's phone. Two things only: what today looks like, and what is
// waiting on a decision.
//
// Not the practice. Patient records — notes, journals, documents — stay in the
// care app, because a phone is lost, borrowed and read over shoulders far more
// often than a laptop, and none of that is what you need between sessions. What
// you need is where to be next, and whether somebody is holding a slot waiting
// on you.
const T = {
  en: {
    title: 'Your day',
    today: 'Today',
    tomorrow: 'Tomorrow',
    nothingToday: 'Nothing scheduled today.',
    requests: 'Waiting on you',
    approve: 'Approve',
    decline: 'Decline',
    declineTitle: 'Decline this request?',
    declineBody: 'They will be told the time was not confirmed.',
    cancel: 'Cancel',
    join: 'Join',
    signOut: 'Sign out',
    signOutTitle: 'Sign out?',
    offline: 'Could not load your day. Open the screen again to retry.',
    guest: 'Guest booking',
  },
  fr: {
    title: 'Votre journée',
    today: 'Aujourd’hui',
    tomorrow: 'Demain',
    nothingToday: 'Rien de prévu aujourd’hui.',
    requests: 'En attente de vous',
    approve: 'Accepter',
    decline: 'Refuser',
    declineTitle: 'Refuser cette demande ?',
    declineBody: 'La personne sera informée que le créneau n’a pas été confirmé.',
    cancel: 'Annuler',
    join: 'Rejoindre',
    signOut: 'Se déconnecter',
    signOutTitle: 'Se déconnecter ?',
    offline: 'Chargement impossible. Rouvrez l’écran pour réessayer.',
    guest: 'Réservation invitée',
  },
} as const;

const FORMAT_ICON = { video: Video, in_person: MapPin, phone: Phone } as const;

export default function PractitionerHome() {
  const { signOut } = useAuth();
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
  // someone travelling should still see their practice's schedule.
  const zone = tz ? { timeZone: tz } : {};
  const dayKey = (iso: string) => new Date(iso).toLocaleDateString('en-CA', zone);
  const todayKey = new Date().toLocaleDateString('en-CA', zone);
  const time = (iso: string) =>
    new Date(iso).toLocaleTimeString(locale === 'fr' ? 'fr-FR' : 'en-GB', { hour: '2-digit', minute: '2-digit', ...zone });
  const dayLabel = (iso: string) =>
    new Date(iso).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long', ...zone });

  const today = sessions.filter((s) => dayKey(s.scheduledAt) === todayKey);
  const later = sessions.filter((s) => dayKey(s.scheduledAt) !== todayKey);

  const decide = async (r: BookingRequest, action: 'approve' | 'decline') => {
    if (action === 'decline') {
      const ok = await confirm({ title: tr.declineTitle, message: tr.declineBody, confirmLabel: tr.decline, cancelLabel: tr.cancel, destructive: true });
      if (!ok) return;
    }
    setError('');
    setBusyId(r.id);
    const res = await decideRequest(r.id, action);
    setBusyId(null);
    // A refused decision means somebody got there first, so the list on screen
    // is stale — reload rather than leave a request that no longer exists.
    if (!res.ok) setError(res.error ?? '');
    load();
  };

  const confirmSignOut = async () => {
    if (await confirm({ title: tr.signOutTitle, confirmLabel: tr.signOut, cancelLabel: tr.cancel, destructive: true })) signOut();
  };

  return (
    <Screen bg="bg-surface-soft" scroll className="px-6">
      <Text className="mt-2 text-[26px] font-bold tracking-[-0.6px] text-ink">{tr.title}</Text>
      <Text className="mt-1 text-[14px] text-muted">{dayLabel(new Date().toISOString())}</Text>

      {!loaded && <ActivityIndicator className="mt-10" />}
      {loaded && failed && <Text className="mt-8 text-[14px] text-muted">{tr.offline}</Text>}

      {loaded && !failed && (
        <>
          {requests.length > 0 && (
            <View className="mt-7">
              <Text className="text-[12px] font-extrabold uppercase tracking-[0.6px] text-brand">{tr.requests}</Text>
              {requests.map((r) => (
                <View key={r.id} className="mt-3 rounded-2xl border border-line bg-white p-4">
                  <Text className="text-[15.5px] font-bold text-ink">{r.who}</Text>
                  <Text className="mt-0.5 text-[13px] text-muted">
                    {dayLabel(r.scheduledAt)} · {time(r.scheduledAt)} · {r.durationMinutes} min
                    {r.isGuest ? ` · ${tr.guest}` : ''}
                  </Text>
                  <View className="mt-3 flex-row gap-2">
                    <TouchableOpacity
                      onPress={() => decide(r, 'approve')}
                      disabled={busyId === r.id}
                      className="flex-1 flex-row items-center justify-center gap-1.5 rounded-full bg-ink py-2.5"
                    >
                      {busyId === r.id ? <ActivityIndicator color="#fff" size="small" /> : <Check size={15} color="#fff" strokeWidth={3} />}
                      <Text className="text-[14px] font-bold text-white">{tr.approve}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => decide(r, 'decline')}
                      disabled={busyId === r.id}
                      className="flex-1 flex-row items-center justify-center gap-1.5 rounded-full border border-line py-2.5"
                    >
                      <X size={15} color="#6A6A6A" strokeWidth={2.5} />
                      <Text className="text-[14px] font-semibold text-muted">{tr.decline}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
              {error ? <Text className="mt-2 text-[13px] text-[#C0392B]">{error}</Text> : null}
            </View>
          )}

          <Section label={tr.today} sessions={today} empty={tr.nothingToday} time={time} join={tr.join} />
          {later.length > 0 && <Section label={tr.tomorrow} sessions={later} time={time} join={tr.join} />}
        </>
      )}

      <View className="py-8">
        <Button label={tr.signOut} variant="secondary" onPress={confirmSignOut} />
      </View>
    </Screen>
  );
}

function Section({
  label, sessions, empty, time, join,
}: {
  label: string;
  sessions: PractitionerSession[];
  empty?: string;
  time: (iso: string) => string;
  join: string;
}) {
  return (
    <View className="mt-7">
      <Text className="text-[12px] font-extrabold uppercase tracking-[0.6px] text-muted">{label}</Text>
      {sessions.length === 0 && empty ? (
        <View className="mt-3 flex-row items-center gap-2 rounded-2xl bg-white p-4">
          <CalendarDays size={16} color="#9A9A9A" />
          <Text className="text-[14px] text-muted">{empty}</Text>
        </View>
      ) : (
        sessions.map((s) => {
          const Icon = FORMAT_ICON[s.sessionFormat as keyof typeof FORMAT_ICON] ?? MapPin;
          return (
            <View key={s.id} className="mt-3 flex-row items-center gap-3 rounded-2xl bg-white p-4">
              <View className="w-[52px]">
                <Text className="text-[15px] font-bold text-ink">{time(s.scheduledAt)}</Text>
                <Text className="text-[11.5px] text-muted">{s.durationMinutes} min</Text>
              </View>
              <View className="h-8 w-px bg-line" />
              <View className="flex-1">
                <Text className="text-[15px] font-semibold text-ink">{s.who}</Text>
                <View className="mt-0.5 flex-row items-center gap-1.5">
                  <Icon size={12} color="#9A9A9A" />
                  <Text className="text-[12.5px] text-muted">{s.location || s.sessionFormat.replace('_', ' ')}</Text>
                </View>
              </View>
              {s.meetLink ? (
                <TouchableOpacity onPress={() => { void Linking.openURL(s.meetLink as string); }} className="rounded-full bg-brand-tint px-3 py-1.5">
                  <Text className="text-[13px] font-bold text-brand">{join}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          );
        })
      )}
    </View>
  );
}

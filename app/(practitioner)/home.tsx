import { useCallback, useState } from 'react';
import { ActivityIndicator, Linking, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { CalendarPlus, Clock, PenLine, Share2, UserPlus, Video, MapPin, Phone, type LucideIcon } from 'lucide-react-native';
import { Screen } from '@/src/ui/Screen';
import { Button } from '@/src/ui/Button';
import { PractitionerTabBar, PRACTITIONER_TAB_SPACER } from '@/src/ui/PractitionerTabBar';
import { useAuth } from '@/src/auth/auth-context';
import { useConfirm } from '@/src/ui/confirm';
import { useI18n } from '@/src/i18n';
import { fetchDay, fetchRequests, type PractitionerSession } from '@/src/api/practitioner';

// The practitioner's dashboard: a few things to start, then what is actually
// happening today.
//
// v1's version had ten tiles, several of which were the same thing twice —
// "view calendar" beside a schedule, three different doors onto a session. Ten
// tiles is a menu, not a dashboard. These are the ones that earn a tap on a
// phone; everything else is desk work and stays in the care app.
const T = {
  en: {
    greeting: 'Your practice',
    book: 'Book a session', bookSub: 'With a patient',
    requests: 'Requests', requestsSub: 'To review',
    note: 'Take a note', noteSub: 'After a session',
    share: 'Share', shareSub: 'A resource',
    addPatient: 'Add a patient', addPatientSub: 'New',
    upNext: 'Up next', nothing: 'Nothing scheduled today.',
    soon: 'Coming in the next build.',
    signOut: 'Sign out', signOutTitle: 'Sign out?', cancel: 'Cancel',
  },
  fr: {
    greeting: 'Votre cabinet',
    book: 'Réserver une séance', bookSub: 'Avec un patient',
    requests: 'Demandes', requestsSub: 'À traiter',
    note: 'Prendre une note', noteSub: 'Après une séance',
    share: 'Partager', shareSub: 'Une ressource',
    addPatient: 'Ajouter un patient', addPatientSub: 'Nouveau',
    upNext: 'À venir', nothing: 'Rien de prévu aujourd’hui.',
    soon: 'Bientôt disponible.',
    signOut: 'Se déconnecter', signOutTitle: 'Se déconnecter ?', cancel: 'Annuler',
  },
} as const;

const FORMAT_ICON = { video: Video, in_person: MapPin, phone: Phone } as const;

export default function Dashboard() {
  const router = useRouter();
  const { signOut } = useAuth();
  const confirm = useConfirm();
  const { locale } = useI18n();
  const tr = T[locale] ?? T.en;

  const [sessions, setSessions] = useState<PractitionerSession[]>([]);
  const [requestCount, setRequestCount] = useState(0);
  const [tz, setTz] = useState<string | undefined>();
  const [loaded, setLoaded] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      void Promise.all([fetchDay(), fetchRequests()]).then(([day, reqs]) => {
        if (!alive) return;
        if (day) { setSessions(day.items); setTz(day.timezone); }
        if (reqs) setRequestCount(reqs.items.length);
        setLoaded(true);
      });
      return () => { alive = false; };
    }, []),
  );

  const zone = tz ? { timeZone: tz } : {};
  const todayKey = new Date().toLocaleDateString('en-CA', zone);
  const today = sessions.filter((s) => new Date(s.scheduledAt).toLocaleDateString('en-CA', zone) === todayKey);
  const time = (iso: string) =>
    new Date(iso).toLocaleTimeString(locale === 'fr' ? 'fr-FR' : 'en-GB', { hour: '2-digit', minute: '2-digit', ...zone });
  const heading = new Date().toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long', ...zone });

  const notYet = () => confirm({ title: tr.soon, confirmLabel: 'OK', cancelLabel: tr.cancel });
  const confirmSignOut = async () => {
    if (await confirm({ title: tr.signOutTitle, confirmLabel: tr.signOut, cancelLabel: tr.cancel, destructive: true })) signOut();
  };

  return (
    <Screen bg="bg-surface-soft" scroll className={`px-6 ${PRACTITIONER_TAB_SPACER}`}>
      <Text className="mt-2 text-[26px] font-bold tracking-[-0.6px] text-ink">{tr.greeting}</Text>
      <Text className="mt-1 text-[14px] capitalize text-muted">{heading}</Text>

      <View className="mt-6 flex-row flex-wrap gap-3">
        <Tile Icon={PenLine} label={tr.note} sub={tr.noteSub} tint="#FCEEEE" ink="#C0392B" onPress={() => router.navigate('/(practitioner)/note' as never)} />
        <Tile Icon={Clock} label={tr.requests} sub={tr.requestsSub} tint="#FFF7E6" ink="#B45309" badge={requestCount} onPress={() => router.navigate('/(practitioner)/bookings' as never)} />
        {/* Phase 2 — the tiles exist so the shape is right, and say so rather
            than failing silently when tapped. */}
        <Tile Icon={CalendarPlus} label={tr.book} sub={tr.bookSub} tint="#E7F0EC" ink="#128069" onPress={notYet} />
        <Tile Icon={Share2} label={tr.share} sub={tr.shareSub} tint="#EEF0FF" ink="#4F46E5" onPress={notYet} />
        <Tile Icon={UserPlus} label={tr.addPatient} sub={tr.addPatientSub} tint="#EAF4F1" ink="#2F6E5F" onPress={notYet} />
      </View>

      <Text className="mt-8 text-[12px] font-extrabold uppercase tracking-[0.6px] text-muted">{tr.upNext}</Text>
      {!loaded && <ActivityIndicator className="mt-6" />}
      {loaded && today.length === 0 && (
        <View className="mt-3 rounded-2xl bg-white p-4">
          <Text className="text-[14px] text-muted">{tr.nothing}</Text>
        </View>
      )}
      {today.map((s) => {
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
                <Text className="text-[13px] font-bold text-brand">Join</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        );
      })}

      <View className="mt-8">
        <Button label={tr.signOut} variant="secondary" onPress={confirmSignOut} />
      </View>

      <PractitionerTabBar active="dashboard" />
    </Screen>
  );
}

function Tile({
  Icon, label, sub, tint, ink, badge, onPress,
}: {
  Icon: LucideIcon; label: string; sub: string; tint: string; ink: string; badge?: number; onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      className="min-h-[124px] flex-1 basis-[45%] justify-between rounded-2xl p-4"
      style={{ backgroundColor: tint }}
    >
      <View className="flex-row items-start justify-between">
        <View className="h-10 w-10 items-center justify-center rounded-full" style={{ backgroundColor: '#FFFFFFCC' }}>
          <Icon size={18} color={ink} strokeWidth={2} />
        </View>
        {badge ? (
          <View className="h-5 min-w-[20px] items-center justify-center rounded-full px-1.5" style={{ backgroundColor: ink }}>
            <Text className="text-[11px] font-extrabold text-white">{badge}</Text>
          </View>
        ) : null}
      </View>
      <View>
        <Text className="text-[15px] font-bold text-ink">{label}</Text>
        <Text className="mt-0.5 text-[12px] text-muted">{sub}</Text>
      </View>
    </TouchableOpacity>
  );
}

import { useCallback, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect, useRouter } from 'expo-router';
import { CalendarPlus, Clock, PenLine, Share2, UserPlus, Video, MapPin, Phone, Settings as SettingsIcon, type LucideIcon } from 'lucide-react-native';
import { EDA, EdHeader, EdCard, EdSection, FadeIn } from '@/src/ui/editorial';
import { PractitionerTabBar, PRACTITIONER_TAB_PAD } from '@/src/ui/PractitionerTabBar';
import { useI18n } from '@/src/i18n';
import { fetchDay, fetchRequests, type PractitionerSession } from '@/src/api/practitioner';

// The practitioner's dashboard, in the same editorial language as the patient
// app: the image-less EdHeader, EdCards, one accent.
//
// v1 had ten tiles, several of which were the same thing twice — "view calendar"
// beside a schedule, three separate doors onto a session. Ten tiles is a menu.
// These five are what earn a tap on a phone; everything else is desk work.
const T = {
  en: {
    kicker: 'PRACTICE', title: 'Your day',
    book: 'Book a session', bookSub: 'With a patient',
    requests: 'Requests', requestsSub: 'To review',
    note: 'Take a note', noteSub: 'After a session',
    share: 'Share', shareSub: 'A resource',
    addPatient: 'Add a patient', addPatientSub: 'New',
    upNext: 'UP NEXT', nothing: 'Nothing scheduled today.', join: 'Join',
  },
  fr: {
    kicker: 'CABINET', title: 'Votre journée',
    book: 'Réserver', bookSub: 'Avec un patient',
    requests: 'Demandes', requestsSub: 'À traiter',
    note: 'Prendre une note', noteSub: 'Après une séance',
    share: 'Partager', shareSub: 'Une ressource',
    addPatient: 'Ajouter', addPatientSub: 'Un patient',
    upNext: 'À VENIR', nothing: 'Rien de prévu aujourd’hui.', join: 'Rejoindre',
  },
} as const;

const FORMAT_ICON = { video: Video, in_person: MapPin, phone: Phone } as const;

export default function Dashboard() {
  const router = useRouter();
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
  const time = (iso: string) => new Date(iso).toLocaleTimeString(locale === 'fr' ? 'fr-FR' : 'en-GB', { hour: '2-digit', minute: '2-digit', ...zone });
  const subtitle = new Date().toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long', ...zone });

  return (
    <View style={{ flex: 1, backgroundColor: EDA.canvas }}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={{ paddingBottom: PRACTITIONER_TAB_PAD }} showsVerticalScrollIndicator={false}>
        <EdHeader kicker={tr.kicker} title={tr.title} subtitle={subtitle} rightIcon={SettingsIcon} onRight={() => router.navigate('/(practitioner)/settings' as never)} />

        <FadeIn style={{ paddingHorizontal: 22, paddingTop: 20 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            <Tile Icon={PenLine} label={tr.note} sub={tr.noteSub} onPress={() => router.navigate('/(practitioner)/note' as never)} />
            <Tile Icon={Clock} label={tr.requests} sub={tr.requestsSub} badge={requestCount} onPress={() => router.navigate('/(practitioner)/bookings' as never)} />
            <Tile Icon={CalendarPlus} label={tr.book} sub={tr.bookSub} onPress={() => router.navigate('/(practitioner)/book' as never)} />
            <Tile Icon={Share2} label={tr.share} sub={tr.shareSub} onPress={() => router.navigate('/(practitioner)/resources' as never)} />
            <Tile Icon={UserPlus} label={tr.addPatient} sub={tr.addPatientSub} onPress={() => router.navigate('/(practitioner)/add-patient' as never)} />
          </View>

          <View style={{ marginTop: 28 }}>
            <EdSection label={tr.upNext} />
            {!loaded && <ActivityIndicator />}
            {loaded && today.length === 0 && (
              <EdCard><Text style={{ fontSize: 14, color: EDA.inkSoft }}>{tr.nothing}</Text></EdCard>
            )}
            {today.map((s) => {
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
                      <Text style={{ fontSize: 13, fontWeight: '700', color: EDA.green }}>{tr.join}</Text>
                    </Pressable>
                  ) : null}
                </EdCard>
              );
            })}
          </View>
        </FadeIn>
      </ScrollView>

      <PractitionerTabBar active="dashboard" />
    </View>
  );
}

function Tile({ Icon, label, sub, badge, onPress }: { Icon: LucideIcon; label: string; sub: string; badge?: number; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={{ flexBasis: '47%', flexGrow: 1 }}>
      <View style={{ minHeight: 118, justifyContent: 'space-between', backgroundColor: EDA.card, borderRadius: 20, borderWidth: 1, borderColor: EDA.line, padding: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <View style={{ height: 38, width: 38, borderRadius: 19, backgroundColor: EDA.greenTint, alignItems: 'center', justifyContent: 'center' }}>
            <Icon size={18} color={EDA.green} strokeWidth={2} />
          </View>
          {badge ? (
            <View style={{ height: 20, minWidth: 20, borderRadius: 10, paddingHorizontal: 6, backgroundColor: EDA.green, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 11, fontWeight: '800', color: '#fff' }}>{badge}</Text>
            </View>
          ) : null}
        </View>
        <View>
          <Text style={{ fontSize: 15, fontWeight: '800', color: EDA.ink }}>{label}</Text>
          <Text style={{ fontSize: 12, color: EDA.faint, marginTop: 2 }}>{sub}</Text>
        </View>
      </View>
    </Pressable>
  );
}

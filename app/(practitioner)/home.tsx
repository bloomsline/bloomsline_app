import { useCallback, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect, useRouter } from 'expo-router';
import { CalendarPlus, Check, ChevronDown, ChevronUp, NotebookPen, PenLine, Share2, Sparkles, UserPlus, Video, MapPin, Phone, Settings as SettingsIcon, X, type LucideIcon } from 'lucide-react-native';
import { EDA, EdHeader, EdCard, EdSection, FadeIn } from '@/src/ui/editorial';
import { PractitionerTabBar, PRACTITIONER_TAB_PAD } from '@/src/ui/PractitionerTabBar';
import { useConfirm } from '@/src/ui/confirm';
import { useI18n } from '@/src/i18n';
import { useNoteDraft } from '@/src/notes/draft';
import { PulseSheet } from '@/src/practitioner/PulseSheet';
import { fetchDay, fetchRequests, decideRequest, type PractitionerSession, type BookingRequest } from '@/src/api/practitioner';
import { useTheme } from '@/src/ui/theme-mode';

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
    note: 'Take a note', noteSub: 'After a session',
    share: 'Share', shareSub: 'A resource',
    addPatient: 'Add a patient', addPatientSub: 'New',
    upNext: 'UP NEXT', tomorrow: 'TOMORROW', nothing: 'Nothing scheduled today.', join: 'Join',
    seeMore: 'See {n} more', seeLess: 'Show less',
    requests: 'WAITING ON YOU', approve: 'Approve', decline: 'Decline',
    declineTitle: 'Decline this request?', declineBody: 'They will be told the time was not confirmed.',
    cancel: 'Cancel', guest: 'Guest booking', actions: 'QUICK ACTIONS',
  },
  fr: {
    kicker: 'CABINET', title: 'Votre journée',
    book: 'Réserver', bookSub: 'Avec un patient',
    note: 'Prendre une note', noteSub: 'Après une séance',
    share: 'Partager', shareSub: 'Une ressource',
    addPatient: 'Ajouter', addPatientSub: 'Un patient',
    upNext: 'À VENIR', tomorrow: 'DEMAIN', nothing: 'Rien de prévu aujourd’hui.', join: 'Rejoindre',
    seeMore: 'Voir {n} de plus', seeLess: 'Réduire',
    requests: 'EN ATTENTE DE VOUS', approve: 'Accepter', decline: 'Refuser',
    declineTitle: 'Refuser cette demande ?', declineBody: 'La personne sera informée que le créneau n’a pas été confirmé.',
    cancel: 'Annuler', guest: 'Réservation invitée', actions: 'ACTIONS RAPIDES',
  },
} as const;

const FORMAT_ICON = { video: Video, in_person: MapPin, phone: Phone } as const;

export default function Dashboard() {
  const { t: TT } = useTheme();
  const router = useRouter();
  const { locale } = useI18n();
  const confirm = useConfirm();
  const tr = T[locale] ?? T.en;

  const [sessions, setSessions] = useState<PractitionerSession[]>([]);
  const [requests, setRequests] = useState<BookingRequest[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [tz, setTz] = useState<string | undefined>();
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(() => {
      let alive = true;
      void Promise.all([fetchDay(), fetchRequests()]).then(([day, reqs]) => {
        if (!alive) return;
        if (day) { setSessions(day.items); setTz(day.timezone); }
        if (reqs) setRequests(reqs.items);
        setLoaded(true);
      });
      return () => { alive = false; };
  }, []);
  useFocusEffect(load);

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

  const [prep, setPrep] = useState<PractitionerSession | null>(null);
  const { open: openNote } = useNoteDraft();

  // Opens the editor already bound to THIS session, which is the whole point of
  // the button being on the row: a note belongs to a session, and picking one
  // from a list you have just navigated away from is the step worth removing.
  const openNoteFor = (s: PractitionerSession) => {
    if (!s.memberId) return;
    openNote({
      appointmentId: s.id, memberId: s.memberId, who: s.who,
      when: new Date(s.scheduledAt).toLocaleString(locale === 'fr' ? 'fr-FR' : 'en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
      title: '', text: '', ranges: [], noteType: 'session',
    });
    router.navigate('/(practitioner)/note' as never);
  };

  const zone = tz ? { timeZone: tz } : {};
  const todayKey = new Date().toLocaleDateString('en-CA', zone);
  const today = sessions.filter((s) => new Date(s.scheduledAt).toLocaleDateString('en-CA', zone) === todayKey);
  const later = sessions.filter((s) => new Date(s.scheduledAt).toLocaleDateString('en-CA', zone) !== todayKey);
  const time = (iso: string) => new Date(iso).toLocaleTimeString(locale === 'fr' ? 'fr-FR' : 'en-GB', { hour: '2-digit', minute: '2-digit', ...zone });
  const dayLabel = (iso: string) => new Date(iso).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long', ...zone });
  const subtitle = new Date().toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long', ...zone });

  return (
    <View style={{ flex: 1, backgroundColor: TT.bg }}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={{ paddingBottom: PRACTITIONER_TAB_PAD }} showsVerticalScrollIndicator={false}>
        <EdHeader kicker={tr.kicker} title={tr.title} subtitle={subtitle} rightIcon={SettingsIcon} onRight={() => router.navigate('/(practitioner)/settings' as never)} />

        <FadeIn style={{ paddingHorizontal: 22, paddingTop: 20 }}>
          {/* The day comes first. The actions are what you do about it, and they
              read as an afterthought only if they are on top of it. */}
          <EdSection label={tr.upNext} />
          {!loaded && <ActivityIndicator />}
          {loaded && today.length === 0 && (
            <EdCard><Text style={{ fontSize: 14, color: TT.inkSoft }}>{tr.nothing}</Text></EdCard>
          )}
          <SessionList items={today} time={time} join={tr.join} more={tr.seeMore} less={tr.seeLess} onPrep={setPrep} onNote={openNoteFor} />

          {later.length > 0 && (
            <View style={{ marginTop: 22 }}>
              <EdSection label={tr.tomorrow} />
              <SessionList items={later} time={time} join={tr.join} more={tr.seeMore} less={tr.seeLess} onPrep={setPrep} onNote={openNoteFor} />
            </View>
          )}

          {requests.length > 0 && (
            <View style={{ marginTop: 26 }}>
              <EdSection label={tr.requests} />
              {requests.map((r) => (
                <EdCard key={r.id} style={{ marginBottom: 10 }}>
                  <Text style={{ fontSize: 15.5, fontWeight: '700', color: TT.ink }}>{r.who}</Text>
                  <Text style={{ fontSize: 13, color: TT.inkSoft, marginTop: 3 }}>
                    {dayLabel(r.scheduledAt)} · {time(r.scheduledAt)} · {r.durationMinutes} min{r.isGuest ? ` · ${tr.guest}` : ''}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                    <Pressable onPress={() => decide(r, 'approve')} disabled={busyId === r.id} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 44, borderRadius: 22, backgroundColor: TT.ink }}>
                      {busyId === r.id ? <ActivityIndicator color="#fff" size="small" /> : <Check size={15} color="#fff" strokeWidth={3} />}
                      <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff' }}>{tr.approve}</Text>
                    </Pressable>
                    <Pressable onPress={() => decide(r, 'decline')} disabled={busyId === r.id} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 44, borderRadius: 22, borderWidth: 1.5, borderColor: TT.line }}>
                      <X size={15} color={TT.inkSoft} strokeWidth={2.5} />
                      <Text style={{ fontSize: 14, fontWeight: '600', color: TT.inkSoft }}>{tr.decline}</Text>
                    </Pressable>
                  </View>
                </EdCard>
              ))}
              {error ? <Text style={{ fontSize: 13, color: '#C0392B' }}>{error}</Text> : null}
            </View>
          )}

          <View style={{ marginTop: 28 }}>
            <EdSection label={tr.actions} />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
              <Tile Icon={PenLine} label={tr.note} sub={tr.noteSub} onPress={() => router.navigate('/(practitioner)/note' as never)} />
              <Tile Icon={CalendarPlus} label={tr.book} sub={tr.bookSub} onPress={() => router.navigate('/(practitioner)/book' as never)} />
              <Tile Icon={Share2} label={tr.share} sub={tr.shareSub} onPress={() => router.navigate('/(practitioner)/resources' as never)} />
              <Tile Icon={UserPlus} label={tr.addPatient} sub={tr.addPatientSub} onPress={() => router.navigate('/(practitioner)/add-patient' as never)} />
            </View>
          </View>
        </FadeIn>
      </ScrollView>

      {prep && <PulseSheet memberId={prep.memberId ?? null} who={prep.who} onClose={() => setPrep(null)} />}

      <PractitionerTabBar active="home" />
    </View>
  );
}

// Two, then a way to the rest.
//
// A day's worth of sessions on the screen you open to ask "what am I walking
// into" buries the answer under the rest of the afternoon. Two is what fits
// above the fold and what the question actually wants; the others are one tap
// away and say how many they are, so the count is never a surprise.
const PREVIEW = 2;

function SessionList({ items, time, join, more, less, onPrep, onNote }: {
  items: PractitionerSession[]; time: (iso: string) => string; join: string; more: string; less: string;
  onPrep: (s: PractitionerSession) => void; onNote: (s: PractitionerSession) => void;
}) {
  const { t: TT } = useTheme();
  const [open, setOpen] = useState(false);
  const hidden = items.length - PREVIEW;
  const shown = open ? items : items.slice(0, PREVIEW);
  return (
    <>
      {shown.map((s) => <SessionRow key={s.id} s={s} time={time} join={join} onPrep={onPrep} onNote={onNote} />)}
      {hidden > 0 && (
        <Pressable onPress={() => setOpen((v) => !v)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11 }}>
          <Text style={{ fontSize: 13.5, fontWeight: '700', color: TT.accent }}>
            {open ? less : more.replace('{n}', String(hidden))}
          </Text>
          {open ? <ChevronUp size={15} color={TT.accent} /> : <ChevronDown size={15} color={TT.accent} />}
        </Pressable>
      )}
    </>
  );
}

function SessionRow({ s, time, join, onPrep, onNote }: {
  s: PractitionerSession; time: (iso: string) => string; join: string;
  onPrep: (s: PractitionerSession) => void; onNote: (s: PractitionerSession) => void;
}) {
  const { t: TT } = useTheme();
  const Icon = FORMAT_ICON[s.sessionFormat as keyof typeof FORMAT_ICON] ?? MapPin;
  // Both actions write to, or read from, a MEMBER. A guest booking that was
  // never linked has neither a history to brief from nor a file to write to —
  // the same limit the care app's day list has.
  const canAct = Boolean(s.memberId) && !s.isGuest;
  return (
    <EdCard style={{ marginBottom: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <View style={{ width: 54 }}>
          <Text style={{ fontSize: 15, fontWeight: '800', color: TT.ink }}>{time(s.scheduledAt)}</Text>
          <Text style={{ fontSize: 11.5, color: TT.faint }}>{s.durationMinutes} min</Text>
        </View>
        <View style={{ width: 1, height: 30, backgroundColor: TT.line }} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: TT.ink }}>{s.who}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
            <Icon size={12} color={TT.faint} />
            <Text style={{ fontSize: 12.5, color: TT.inkSoft }}>{s.location || s.sessionFormat.replace('_', ' ')}</Text>
          </View>
        </View>
        {s.meetLink ? (
          <Pressable onPress={() => { void Linking.openURL(s.meetLink as string); }} style={{ borderRadius: 20, backgroundColor: TT.accentTint, paddingHorizontal: 12, paddingVertical: 6 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: TT.accent }}>{join}</Text>
          </Pressable>
        ) : null}
      </View>

      {/* Where to go, and the two things you do about the session.
          
          The address only appears for in-person, and only when there is one:
          "in person" with no street is the state this row used to be stuck in.
          Tapping hands the address to whatever maps app the phone has. */}
      {(canAct || mapsFor(s)) && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, paddingTop: 11, borderTopWidth: 1, borderTopColor: TT.line }}>
          {mapsFor(s) ? (
            <Pressable
              onPress={() => { void Linking.openURL(mapsFor(s) as string); }}
              style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 7, minWidth: 0 }}
            >
              <MapPin size={13} color={TT.accent} />
              <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 12.5, fontWeight: '700', color: TT.accent }}>{s.location}</Text>
            </Pressable>
          ) : <View style={{ flex: 1 }} />}

          {canAct && (
            <>
              <RowAction Icon={Sparkles} onPress={() => onPrep(s)} />
              <RowAction Icon={NotebookPen} onPress={() => onNote(s)} />
            </>
          )}
        </View>
      )}
    </EdCard>
  );
}

/**
 * A maps URL for an in-person session that has an address.
 *
 * The server decides WHICH link: the practitioner's own Google Maps link when
 * they have set one (the case a search cannot serve — a side entrance, one
 * building in a complex), else a search on the address. The fallback here is
 * for a build talking to a server that predates `mapsUrl`.
 */
function mapsFor(s: PractitionerSession): string | null {
  if (s.sessionFormat !== 'in_person' || !s.location) return null;
  return s.mapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.location)}`;
}

function RowAction({ Icon, onPress }: { Icon: LucideIcon; onPress: () => void }) {
  const { t: TT } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      style={{ height: 34, width: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: TT.line, backgroundColor: TT.bg }}
    >
      <Icon size={15} color={TT.inkSoft} />
    </Pressable>
  );
}

function Tile({ Icon, label, sub, badge, onPress }: { Icon: LucideIcon; label: string; sub: string; badge?: number; onPress: () => void }) {
  const { t: TT } = useTheme();
  return (
    <Pressable onPress={onPress} style={{ flexBasis: '47%', flexGrow: 1 }}>
      <View style={{ minHeight: 118, justifyContent: 'space-between', backgroundColor: TT.card, borderRadius: 20, borderWidth: 1, borderColor: TT.line, padding: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <View style={{ height: 38, width: 38, borderRadius: 19, backgroundColor: TT.accentTint, alignItems: 'center', justifyContent: 'center' }}>
            <Icon size={18} color={TT.accent} strokeWidth={2} />
          </View>
          {badge ? (
            <View style={{ height: 20, minWidth: 20, borderRadius: 10, paddingHorizontal: 6, backgroundColor: TT.accent, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 11, fontWeight: '800', color: '#fff' }}>{badge}</Text>
            </View>
          ) : null}
        </View>
        <View>
          <Text style={{ fontSize: 15, fontWeight: '800', color: TT.ink }}>{label}</Text>
          <Text style={{ fontSize: 12, color: TT.faint, marginTop: 2 }}>{sub}</Text>
        </View>
      </View>
    </Pressable>
  );
}

// My Care — v2. A single dark ground rather than the old photo-header-over-light
// hybrid: this is a tab a patient lives in, and the photograph was doing decorative
// work on a screen that is mostly data.
//
// The other structural change is the SESSION CAROUSEL. The old screen showed one
// "next session" block and, much further down, a separate "Upcoming" list — so the
// next two appointments were nowhere near each other. They are one horizontal
// strip now: "Next session", then "Then", then the rest.
import { useCallback, useRef, useState } from 'react';
import { Linking, Platform, ScrollView, Text, TouchableOpacity, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect, useRouter } from 'expo-router';
import { ChevronRight, Plus, Ellipsis, RotateCcw, FileText, MapPin, Settings, type LucideIcon } from 'lucide-react-native';
import { TabBar } from '@/src/ui/TabBar';
import { TabIntro } from '@/src/ui/TabIntro';
import { EDA, EDD, EdCard, FadeIn, MonoLabel } from '@/src/ui/editorial';
import { useLanding } from '@/src/prefs/landing';
import { useI18n, fmt } from '@/src/i18n';
import { useOnboarding } from '@/src/onboarding/context';
import { FORCE_CARE_HUB } from '@/src/config';
import { fetchCare, fetchTodo, type CareSession, type PatientCare, type TodoItem } from '@/src/api/care';
import { resourceTypeMeta, statusLabel } from '@/src/care/resources';
import { notify } from '@/src/ui/alert';

const PREVIEW_NEXT: CareSession = { id: 'preview', scheduledAt: inDays(5, 9), durationMinutes: 50, sessionFormat: 'video', sessionType: 'session', status: 'scheduled', meetLink: null, paymentStatus: null };
const PREVIEW_UPCOMING: CareSession[] = [
  { id: 'p1', scheduledAt: inDays(12, 9), durationMinutes: 50, sessionFormat: 'video', sessionType: 'session', status: 'scheduled', meetLink: null, paymentStatus: null },
  { id: 'p2', scheduledAt: inDays(19, 9), durationMinutes: 50, sessionFormat: 'in_person', sessionType: 'session', status: 'scheduled', meetLink: null, paymentStatus: null },
];
const PREVIEW_TODOS: TodoItem[] = [
  { id: 'dt1', resourceId: '', title: 'A short reflection', type: 'worksheet', status: 'in_progress', dueAt: null, assignedAt: '' },
  { id: 'dt2', resourceId: '', title: 'Evening wind-down', type: 'exercise', status: 'assigned', dueAt: null, assignedAt: '' },
];

export default function MyCare() {
  const router = useRouter();
  const { firstName, practitionerName, hasPractitioner } = useOnboarding();
  const { landing } = useLanding();
  const { t, locale } = useI18n();
  const greetHere = landing === 'care';
  const [care, setCare] = useState<PatientCare | null>(null);
  const [todos, setTodos] = useState<TodoItem[] | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [introActive, setIntroActive] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      fetchCare().then((c) => { if (alive) { setCare(c); setLoaded(true); } });
      fetchTodo().then((r) => { if (alive) setTodos(r); });
      return () => { alive = false; };
    }, []),
  );

  const soon = () => notify(t.common.comingSoon);

  const real = care?.hasPractitioner ? care : null;
  const preview = !real && FORCE_CARE_HUB;
  const perms = real?.permissions ?? { canBook: true, canCancel: true, canReschedule: true, noticeHours: 24 };
  const showHub = !!real || preview || hasPractitioner;

  const name = (firstName ?? '').trim();
  const pretty = name ? name.charAt(0).toUpperCase() + name.slice(1) : preview ? 'Sofia' : '';
  const greeting = new Date().getHours() < 12 ? t.greeting.morning : new Date().getHours() < 18 ? t.greeting.afternoon : t.greeting.evening;
  const headerTitle = greetHere ? (pretty ? `${greeting},\n${pretty}.` : `${greeting}.`) : t.care.title;
  const dateKicker = new Date().toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US', { weekday: 'short', day: 'numeric', month: 'short' });

  const header = (
    <View style={{ paddingHorizontal: 22, paddingTop: 8, paddingBottom: 18 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <MonoLabel color={EDD.faint} size={10.5} style={{ marginBottom: 10 }}>{dateKicker}</MonoLabel>
          <Text style={{ fontSize: 27, fontWeight: '800', color: EDD.text, letterSpacing: -0.9, lineHeight: 31 }}>{headerTitle}</Text>
        </View>
        <TouchableOpacity
          onPress={() => router.navigate('/settings' as never)}
          activeOpacity={0.8}
          style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: EDD.card, borderWidth: 1, borderColor: EDD.cardLine, alignItems: 'center', justifyContent: 'center' }}
        >
          <Settings size={17} color={EDD.textSoft} strokeWidth={2} />
        </TouchableOpacity>
      </View>
    </View>
  );

  // Solo (no practitioner, not previewing): the light connect state is unchanged
  // — it is a different screen doing a different job, and dark would read as an
  // error state rather than an invitation.
  if (loaded && !showHub) {
    return (
      <View style={{ flex: 1, backgroundColor: EDA.canvas }}>
        <StatusBar style="dark" />
        <SafeAreaView edges={['top']} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ paddingBottom: 180 }} showsVerticalScrollIndicator={false}>
            <View style={{ paddingHorizontal: 22, paddingTop: 12 }}>
              <MonoLabel color={EDA.faint} size={10.5} style={{ marginBottom: 10 }}>{dateKicker}</MonoLabel>
              <Text style={{ fontSize: 27, fontWeight: '800', color: EDA.ink, letterSpacing: -0.9, lineHeight: 31 }}>{headerTitle}</Text>
            </View>
            <FadeIn style={{ paddingHorizontal: 22, paddingTop: 20 }}>
              <EdCard style={{ alignItems: 'center', padding: 24 }}>
                <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: EDA.greenTint, alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                  <Plus size={22} color={EDA.green} strokeWidth={2} />
                </View>
                <Text style={{ fontSize: 16, fontWeight: '700', color: EDA.ink }}>{t.care.connectTitle}</Text>
                <Text style={{ fontSize: 13, color: EDA.inkSoft, textAlign: 'center', marginTop: 6, lineHeight: 19 }}>{t.care.connectSub}</Text>
              </EdCard>
            </FadeIn>
          </ScrollView>
        </SafeAreaView>
        <TabBar active="care" />
      </View>
    );
  }

  const pracName = real?.practitionerName ?? practitionerName ?? (preview ? 'Dr. Maya Laurent' : t.care.yourPractitioner);
  const pracHeadline = real?.practitionerHeadline ?? (preview ? 'Clinical psychologist' : null);
  const initial = pracName.replace(/^dr\.?\s*/i, '').charAt(0).toUpperCase() || '?';
  const nextSession = real ? real.nextSession : preview ? PREVIEW_NEXT : null;
  const later = real ? real.upcomingSessions.filter((s) => s.id !== real.nextSession?.id) : preview ? PREVIEW_UPCOMING : [];
  const sessions = [...(nextSession ? [nextSession] : []), ...later];
  const todoItems = real ? (todos ?? []) : preview ? PREVIEW_TODOS : [];

  const openSession = (s: CareSession) =>
    router.navigate({
      pathname: '/session-menu',
      params: { id: s.id, scheduledAt: s.scheduledAt, durationMinutes: String(s.durationMinutes), sessionFormat: s.sessionFormat, sessionType: s.sessionType, meetLink: s.meetLink ?? '', demo: real ? '' : '1', canCancel: perms.canCancel ? '1' : '', canReschedule: perms.canReschedule ? '1' : '', noticeHours: String(perms.noticeHours) },
    } as never);

  const openUrl = (url: string) => {
    if (Platform.OS === 'web') globalThis.open?.(url, '_blank');
    else Linking.openURL(url).catch(() => {});
  };
  const joinSession = (s: CareSession) => (s.meetLink ? openUrl(s.meetLink) : soon());

  // Where an in-person session happens. Both come from the practitioner's own
  // profile, and either may be missing.
  const address = real?.practitioner?.address ?? (preview ? '12 rue des Lilas, 75011 Paris, France' : null);
  const mapsUrl = real?.practitioner?.mapsUrl ?? (preview ? 'https://maps.app.goo.gl/i6t7e2RgonE7LdZT8' : null);

  return (
    <View style={{ flex: 1, backgroundColor: EDD.ground }}>
      <StatusBar style="light" />
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ paddingBottom: 180 }} showsVerticalScrollIndicator={false}>
          {header}
          <FadeIn>
            <View style={{ paddingHorizontal: 22 }}>
              <TabIntro tabKey="care" tone="dark" onActiveChange={setIntroActive} />
            </View>

            <View style={{ opacity: introActive ? 0.3 : 1 }} pointerEvents={introActive ? 'none' : 'auto'}>
              {/* Practitioner — a row, not a card: it names a person, it is not a thing to do. */}
              <TouchableOpacity
                onPress={() => router.navigate('/practitioner' as never)}
                activeOpacity={0.8}
                style={{ marginHorizontal: 22, flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 12 }}
              >
                <Avatar initial={initial} size={44} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15.5, fontWeight: '700', color: EDD.text }}>{pracName}</Text>
                  {pracHeadline ? <Text style={{ fontSize: 12.5, color: EDD.textSoft, marginTop: 1 }}>{pracHeadline}</Text> : null}
                </View>
                <ChevronRight size={18} color={EDD.faint} strokeWidth={2} />
              </TouchableOpacity>

              <SectionRule label={t.care.yourSessions} />

              {sessions.length > 0 ? (
                <SessionCarousel
                  sessions={sessions}
                  locale={locale}
                  t={t}
                  address={address}
                  mapsUrl={mapsUrl}
                  onOpen={openSession}
                  onJoin={joinSession}
                  onMaps={() => mapsUrl && openUrl(mapsUrl)}
                />
              ) : (
                <View style={{ marginHorizontal: 22, backgroundColor: EDD.card, borderWidth: 1, borderColor: EDD.cardLine, borderRadius: 20, padding: 20 }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: EDD.text }}>{t.care.noSession}</Text>
                  <Text style={{ fontSize: 13, color: EDD.textSoft, marginTop: 3 }}>{t.care.noSessionSub}</Text>
                </View>
              )}

              {perms.canBook ? (
                <TouchableOpacity
                  onPress={() => router.navigate('/book' as never)}
                  activeOpacity={0.85}
                  style={{ marginHorizontal: 22, marginTop: 16, height: 50, borderRadius: 25, borderWidth: 1, borderColor: EDD.cardLine, alignItems: 'center', justifyContent: 'center' }}
                >
                  <Text style={{ fontSize: 14.5, fontWeight: '700', color: EDD.text }}>{t.care.bookAnother}</Text>
                </TouchableOpacity>
              ) : (
                <Text style={{ fontSize: 12.5, color: EDD.textSoft, textAlign: 'center', marginTop: 14, paddingHorizontal: 34 }}>{t.care.bookNote}</Text>
              )}

              {todoItems.length > 0 && (
                <>
                  {/* Attribution kept deliberately: "from {name}" tells a patient WHO
                      asked, which the board's plain "My resources" drops. */}
                  <SectionRule
                    label={fmt(t.care.todoFrom, { name: firstNameOf(pracName) })}
                    action={`${t.common.seeAll} (${todoItems.length})`}
                    onAction={() => router.navigate('/from-practitioner' as never)}
                  />
                  <View style={{ gap: 10, paddingHorizontal: 22 }}>
                    {todoItems.slice(0, 3).map((it) => {
                      const meta = resourceTypeMeta(it.type, locale);
                      const open = it.resourceId ? () => router.navigate(`/resource/${it.id}` as never) : () => router.navigate('/from-practitioner' as never);
                      return <ResourceRow key={it.id} Icon={meta.Icon} title={it.title} sub={`${meta.label} · ${statusLabel(it.status, locale)}`} onPress={open} />;
                    })}
                  </View>
                </>
              )}

              <SectionRule label={t.care.archive} />
              <View style={{ marginHorizontal: 22, backgroundColor: EDD.card, borderWidth: 1, borderColor: EDD.cardLine, borderRadius: 18, overflow: 'hidden' }}>
                <UtilityRow Icon={RotateCcw} label={t.care.pastSessions} onPress={() => router.navigate('/session-history' as never)} divider />
                <UtilityRow Icon={FileText} label={t.care.documents} onPress={() => router.navigate('/documents' as never)} />
              </View>
            </View>
          </FadeIn>
        </ScrollView>
      </SafeAreaView>

      <TabBar active="care" tone="dark" />
    </View>
  );
}

/**
 * The sessions strip. Cards are peeked rather than full-width so it reads as a
 * strip you can push, not a page that happens to be cut off.
 */
function SessionCarousel({
  sessions, locale, t, address, mapsUrl, onOpen, onJoin, onMaps,
}: {
  sessions: CareSession[];
  locale: string;
  t: ReturnType<typeof useI18n>['t'];
  address: string | null;
  mapsUrl: string | null;
  onOpen: (s: CareSession) => void;
  onJoin: (s: CareSession) => void;
  onMaps: () => void;
}) {
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const scroller = useRef<ScrollView>(null);
  const CARD_W = Math.min(300, width - 88);
  const GAP = 12;

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / (CARD_W + GAP));
    if (i !== index) setIndex(i);
  };

  return (
    <>
      <ScrollView
        ref={scroller}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={CARD_W + GAP}
        decelerationRate={0.9}
        disableIntervalMomentum
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingHorizontal: 22, gap: GAP }}
      >
        {sessions.map((s, i) => (
          <SessionCard
            key={s.id}
            session={s}
            width={CARD_W}
            first={i === 0}
            locale={locale}
            t={t}
            address={address}
            mapsUrl={mapsUrl}
            onOpen={() => onOpen(s)}
            onJoin={() => onJoin(s)}
            onMaps={onMaps}
          />
        ))}
      </ScrollView>
      {sessions.length > 1 && (
        <View style={{ flexDirection: 'row', gap: 5, paddingHorizontal: 22, marginTop: 12 }}>
          {sessions.map((s, i) => (
            <View
              key={s.id}
              style={{ height: 2, width: i === index ? 16 : 6, borderRadius: 1, backgroundColor: i === index ? EDD.text : 'rgba(255,255,255,0.25)' }}
            />
          ))}
        </View>
      )}
    </>
  );
}

function SessionCard({
  session, width, first, locale, t, address, mapsUrl, onOpen, onJoin, onMaps,
}: {
  session: CareSession;
  width: number;
  first: boolean;
  locale: string;
  t: ReturnType<typeof useI18n>['t'];
  address: string | null;
  mapsUrl: string | null;
  onOpen: () => void;
  onJoin: () => void;
  onMaps: () => void;
}) {
  const inPerson = session.sessionFormat === 'in_person';
  const pay = session.paymentStatus;
  return (
    <View style={{ width, backgroundColor: EDD.card, borderWidth: 1, borderColor: EDD.cardLine, borderRadius: 20, padding: 18 }}>
      <TouchableOpacity
        onPress={onOpen}
        activeOpacity={0.7}
        style={{ position: 'absolute', top: 12, right: 12, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.10)', alignItems: 'center', justifyContent: 'center' }}
      >
        <Ellipsis size={17} color={EDD.text} strokeWidth={2.5} />
      </TouchableOpacity>

      <MonoLabel color={EDD.faint} size={10} style={{ marginBottom: 8 }}>{first ? t.care.nextSession : t.care.then}</MonoLabel>
      <Text style={{ fontSize: 19, fontWeight: '800', color: EDD.text, letterSpacing: -0.4 }}>{longDate(session.scheduledAt, locale)}</Text>
      <Text style={{ fontSize: 13, color: EDD.textSoft, marginTop: 4 }}>
        {clock(session.scheduledAt, locale)}  ·  {fmtFormat(session.sessionFormat, locale)}{first ? '' : ` · ${session.durationMinutes} min`}
      </Text>

      {pay ? (
        <View style={{ alignSelf: 'flex-start', marginTop: 12, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: pay === 'paid' ? 'rgba(127,217,192,0.16)' : 'rgba(233,196,106,0.16)' }}>
          <Text style={{ fontSize: 11.5, fontWeight: '700', color: pay === 'paid' ? EDD.green : EDD.amber }}>
            {pay === 'paid' ? t.care.paid : pay === 'free' ? t.care.noCharge : t.care.awaitingPayment}
          </Text>
        </View>
      ) : null}

      {/* Only the imminent session offers a way to get there, and what that is
          depends on the format:
            video / phone → Join session
            in person     → Open in Maps, when the practitioner saved a Maps link
                          → else the address as plain text, which can still be
                            read out to a driver or copied
                          → else nothing. A button that opens nothing is worse
                            than no button. */}
      {first && !inPerson ? (
        <TouchableOpacity onPress={onJoin} activeOpacity={0.85} style={{ height: 44, borderRadius: 22, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', marginTop: 16 }}>
          <Text style={{ fontSize: 14.5, fontWeight: '700', color: '#141414' }}>{t.care.join}</Text>
        </TouchableOpacity>
      ) : first && inPerson && mapsUrl ? (
        <TouchableOpacity onPress={onMaps} activeOpacity={0.85} style={{ height: 44, borderRadius: 22, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', marginTop: 16, flexDirection: 'row', gap: 7 }}>
          <MapPin size={16} color="#141414" strokeWidth={2.2} />
          <Text style={{ fontSize: 14.5, fontWeight: '700', color: '#141414' }}>{t.care.openInMaps}</Text>
        </TouchableOpacity>
      ) : first && inPerson && address ? (
        <View style={{ flexDirection: 'row', gap: 7, marginTop: 14, alignItems: 'flex-start' }}>
          <MapPin size={15} color={EDD.faint} strokeWidth={2} style={{ marginTop: 1 }} />
          <Text style={{ flex: 1, fontSize: 13, color: EDD.textSoft, lineHeight: 19 }}>{address}</Text>
        </View>
      ) : (
        <View style={{ height: first ? 16 : 4 }} />
      )}
    </View>
  );
}

function SectionRule({ label, action, onAction }: { label: string; action?: string; onAction?: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 22, marginTop: 28, marginBottom: 12 }}>
      <MonoLabel color={EDD.faint} size={10}>{label}</MonoLabel>
      <View style={{ flex: 1, height: 1, backgroundColor: EDD.cardLine }} />
      {action ? (
        <TouchableOpacity onPress={onAction} activeOpacity={0.7}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: EDD.green }}>{action}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

// ---- date helpers ----
function inDays(days: number, hour: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}
function longDate(iso: string, locale: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long' });
}
function clock(iso: string, locale: string): string {
  // Pass the locale explicitly: without it this inherits the device's, which
  // printed "09:00 AM" on a French screen. French is 24-hour.
  return new Date(iso).toLocaleTimeString(locale === 'fr' ? 'fr-FR' : 'en-US', { hour: '2-digit', minute: '2-digit' });
}
function fmtFormat(f: string, locale: string): string {
  const fr = locale === 'fr';
  if (f === 'video') return fr ? 'Visio' : 'Video';
  if (f === 'phone') return fr ? 'Téléphone' : 'Phone';
  if (f === 'in_person') return fr ? 'En cabinet' : 'In person';
  return f;
}

function firstNameOf(name: string): string {
  return name.replace(/^dr\.?\s*/i, '').trim().split(/\s+/)[0] || 'your practitioner';
}

function Avatar({ initial, size }: { initial: string; size: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: 'rgba(127,217,192,0.18)', borderWidth: 1, borderColor: EDD.cardLine, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: EDD.green, fontWeight: '700', fontSize: size * 0.38 }}>{initial}</Text>
    </View>
  );
}

function ResourceRow({ Icon, title, sub, onPress }: { Icon: LucideIcon; title: string; sub: string; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={{ backgroundColor: EDD.card, borderWidth: 1, borderColor: EDD.cardLine, borderRadius: 18, padding: 14, paddingRight: 16, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
      <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(127,217,192,0.14)', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={18} color={EDD.green} strokeWidth={2} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14.5, fontWeight: '700', color: EDD.text }}>{title}</Text>
        <Text style={{ fontSize: 12, color: EDD.textSoft, marginTop: 1 }}>{sub}</Text>
      </View>
      <ChevronRight size={18} color={EDD.faint} strokeWidth={2} />
    </TouchableOpacity>
  );
}

function UtilityRow({ Icon, label, onPress, divider }: { Icon: LucideIcon; label: string; onPress: () => void; divider?: boolean }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={{ padding: 15, paddingRight: 16, flexDirection: 'row', alignItems: 'center', gap: 14, borderBottomWidth: divider ? 1 : 0, borderBottomColor: EDD.cardLine }}>
      <View style={{ width: 22, alignItems: 'center' }}>
        <Icon size={17} color={EDD.textSoft} strokeWidth={2} />
      </View>
      <Text style={{ flex: 1, fontSize: 14.5, fontWeight: '700', color: EDD.text }}>{label}</Text>
      <ChevronRight size={18} color={EDD.faint} strokeWidth={2} />
    </TouchableOpacity>
  );
}

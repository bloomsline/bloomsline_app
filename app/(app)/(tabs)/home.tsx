// My Care — v2. A single dark ground rather than the old photo-header-over-light
// hybrid: this is a tab a patient lives in, and the photograph was doing decorative
// work on a screen that is mostly data.
//
// The other structural change is the SESSION CAROUSEL. The old screen showed one
// "next session" block and, much further down, a separate "Upcoming" list — so the
// next two appointments were nowhere near each other. They are one horizontal
// strip now: "Next session", then "Then", then the rest.
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Platform, ScrollView, Text, TouchableOpacity, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { ArrowLeftRight, ChevronRight, Plus, Ellipsis, RotateCcw, FileText, MapPin, Phone, type LucideIcon } from 'lucide-react-native';
import { TabIntro } from '@/src/ui/TabIntro';
import { EdCard, FadeIn, HEADER_TOP, Kicker } from '@/src/ui/editorial';
import { useLanding } from '@/src/prefs/app-prefs';
import { useI18n, fmt, greetingFor } from '@/src/i18n';
import { useOnboarding } from '@/src/onboarding/context';
import { FORCE_CARE_HUB } from '@/src/config';
import { fetchCare, fetchTodo, type CareSession, type PatientCare, type TodoItem } from '@/src/api/care';
import { resourceTypeMeta, stageLabel, stageLine, todoStage } from '@/src/care/resources';
import { notify } from '@/src/ui/alert';
import { Ground } from '@/src/ui/Ground';
import { PractitionerAvatar } from '@/src/care/PractitionerAvatar';
import { primePractitionerFace } from '@/src/care/practitioner-face';
import { useSelectedPractitioner } from '@/src/care/selected-practitioner';
import { usePractitionerSwitcher } from '@/src/care/PractitionerSwitcher';
import { ProfileButton } from '@/src/profile/ProfileButton';
import { useTheme } from '@/src/ui/theme-mode';
import { veil } from '@/src/ui/tokens';
import { LoadFailed } from '@/src/ui/LoadFailed';
import { useStaleOnReturn } from '@/src/ui/use-stale-on-return';

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
  const { t: TT } = useTheme();
  const router = useRouter();
  const { firstName, practitionerName, hasPractitioner } = useOnboarding();
  const { landing } = useLanding();
  const { t, locale } = useI18n();
  const greetHere = landing === 'care';
  const [care, setCare] = useState<PatientCare | null>(null);
  const [todos, setTodos] = useState<TodoItem[] | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const { selectionKey, selected } = useSelectedPractitioner();
  const switcher = usePractitionerSwitcher();
  // Between choosing another practitioner and their care arriving. What is on
  // screen until then is the PREVIOUS practitioner's sessions and to-dos, and
  // keeping it (as a failed refetch rightly does) would show them under the new
  // name. So a switch empties the hub and says it is loading instead.
  const [switching, setSwitching] = useState(false);
  const shownFor = useRef(selectionKey);
  useEffect(() => {
    if (shownFor.current === selectionKey) return;
    shownFor.current = selectionKey;
    setCare(null);
    setTodos(null);
    setFailed(false);
    setSwitching(true);
  }, [selectionKey]);

  // A failed refetch keeps what is on screen. It used to replace it with
  // nothing: coming back to My Care on a weak connection wiped the next session
  // and said "No upcoming session", with a Book button the practitioner may have
  // turned off. With nothing loaded yet, the screen says it could not load.
  const reload = useCallback(() => {
    let alive = true;
    fetchCare(locale).then((c) => {
      primePractitionerFace(c);
      if (!alive) return;
      if (c) { setCare(c); setFailed(false); } else setFailed(true);
      setLoaded(true);
      setSwitching(false);
    });
    fetchTodo().then((r) => { if (alive && r) setTodos(r); });
    return () => { alive = false; };
    // `selectionKey` is not read here, and it is the point: a new identity is
    // what makes useFocusEffect fetch again, for the practitioner just chosen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale, selectionKey]);
  useFocusEffect(reload);
  // Back from the background after a few minutes: read the hub again. It only
  // refreshed on navigating to it, so yesterday's session, or one the
  // practitioner had since cancelled, stayed on screen for as long as the app did.
  useStaleOnReturn(() => { reload(); }, 5 * 60 * 1000);

  const soon = () => notify(t.common.comingSoon);

  const real = care?.hasPractitioner ? care : null;
  const preview = !real && FORCE_CARE_HUB;
  const perms = real?.permissions ?? { canBook: true, canCancel: true, canReschedule: true, noticeHours: 24 };
  const showHub = !!real || preview || hasPractitioner;

  const name = (firstName ?? '').trim();
  const pretty = name ? name.charAt(0).toUpperCase() + name.slice(1) : preview ? 'Sofia' : '';
  const greeting = greetingFor(t);
  const headerTitle = greetHere ? (pretty ? `${greeting},\n${pretty}.` : `${greeting}.`) : t.care.title;

  const header = (
    <View style={{ paddingHorizontal: 22, paddingTop: HEADER_TOP, paddingBottom: 18 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 27, fontWeight: '800', color: TT.ink, letterSpacing: -0.9, lineHeight: 31 }}>{headerTitle}</Text>
        </View>
        <ProfileButton />
      </View>
    </View>
  );

  // Solo (no practitioner, not previewing): the light connect state is unchanged
  // — it is a different screen doing a different job, and dark would read as an
  // error state rather than an invitation.
  if (loaded && failed && !care && !preview) {
    return (
      <View style={{ flex: 1, backgroundColor: TT.bg }}>
        <SafeAreaView edges={['top']} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ paddingBottom: 180 }} showsVerticalScrollIndicator={false}>
            {header}
            <LoadFailed onRetry={() => { setFailed(false); reload(); }} />
            {/* The way out when it is THIS practitioner's care that will not
                load: the switcher sat on the practitioner row, which a failed
                load never draws, so the patient was stuck on the error until
                they found Settings. */}
            {switcher.canSwitch ? (
              <View style={{ alignItems: 'center', paddingHorizontal: 32, gap: 12 }}>
                {selected?.name ? (
                  <Text style={{ fontSize: 13, lineHeight: 19, color: TT.faint, textAlign: 'center' }}>{t.care.failedShowing.replace('{name}', selected.name)}</Text>
                ) : null}
                <TouchableOpacity
                  onPress={switcher.open}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel={t.care.switchPractitionerA11y}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 40, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1, borderColor: TT.cardLine, backgroundColor: TT.card }}
                >
                  <ArrowLeftRight size={15} color={TT.accent} strokeWidth={2.2} />
                  <Text style={{ fontSize: 14, fontWeight: '700', color: TT.ink }}>{t.care.switchPractitionerA11y}</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </ScrollView>
        </SafeAreaView>
        {switcher.element}
      </View>
    );
  }

  if (loaded && !showHub) {
    return (
      <View style={{ flex: 1, backgroundColor: TT.bg }}>
        <SafeAreaView edges={['top']} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ paddingBottom: 180 }} showsVerticalScrollIndicator={false}>
            {/* The same header as the hub, so it carries ProfileButton: this
                branch used to draw its own title row without it, and a patient
                with no practitioner yet had no way into Settings from here. */}
            {header}
            <FadeIn style={{ paddingHorizontal: 22, paddingTop: 20 }}>
              <EdCard style={{ alignItems: 'center', padding: 24 }}>
                <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: TT.accentTint, alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                  <Plus size={22} color={TT.accent} strokeWidth={2} />
                </View>
                <Text style={{ fontSize: 16, fontWeight: '700', color: TT.ink }}>{t.care.connectTitle}</Text>
                <Text style={{ fontSize: 13, color: TT.inkSoft, textAlign: 'center', marginTop: 6, lineHeight: 19 }}>{t.care.connectSub}</Text>
              </EdCard>
            </FadeIn>
          </ScrollView>
        </SafeAreaView>
      </View>
    );
  }

  const pracName = real?.practitionerName ?? practitionerName ?? (preview ? 'Dr. Maya Laurent' : t.care.yourPractitioner);
  // The selected practitioner's own picture while their care is on its way, so
  // the row changes face the moment the switch is made.
  const pracPhoto = real?.practitioner?.photoUrl ?? selected?.photoUrl ?? null;
  const pracHeadline = real?.practitionerHeadline ?? (preview ? 'Clinical psychologist' : null);
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
    <Ground>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ paddingBottom: 180 }} showsVerticalScrollIndicator={false}>
          {header}
          <FadeIn>
            {/* The intro is a popup over the whole screen now; the page below
                it needs no dimming of its own — see TabIntro. */}
            <View>
              {/* Practitioner — a row, not a card: it names a person, it is not a thing to do. */}
              <View style={{ marginHorizontal: 22, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <TouchableOpacity
                  onPress={() => router.navigate('/practitioner' as never)}
                  activeOpacity={0.8}
                  style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 12 }}
                >
                  <PractitionerAvatar size={44} name={pracName} photoUrl={pracPhoto} />
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={{ fontSize: 15.5, fontWeight: '700', color: TT.ink }}>{pracName}</Text>
                    {pracHeadline ? <Text numberOfLines={1} style={{ fontSize: 12.5, color: TT.inkSoft, marginTop: 1 }}>{pracHeadline}</Text> : null}
                  </View>
                  {/* The chevron gives way to Switch: two trailing controls on
                      one row read as one, and the row itself still opens the
                      profile. */}
                  {switcher.canSwitch ? null : <ChevronRight size={18} color={TT.faint} strokeWidth={2} />}
                </TouchableOpacity>
                {/* Only with several practitioners. A patient with one sees the
                    row exactly as it was. */}
                {switcher.canSwitch ? (
                  <TouchableOpacity
                    onPress={switcher.open}
                    activeOpacity={0.8}
                    hitSlop={6}
                    accessibilityRole="button"
                    accessibilityLabel={t.care.switchPractitionerA11y}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 34, paddingHorizontal: 13, borderRadius: 17, borderWidth: 1, borderColor: TT.cardLine, backgroundColor: TT.card }}
                  >
                    <ArrowLeftRight size={14} color={TT.accent} strokeWidth={2.2} />
                    <Text style={{ fontSize: 13, fontWeight: '700', color: TT.ink }}>{t.care.switchPractitioner}</Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              {switching ? (
                <View accessibilityRole="progressbar" style={{ paddingVertical: 64, alignItems: 'center' }}>
                  <ActivityIndicator color={TT.accent} />
                </View>
              ) : (
              <>

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
                <View style={{ marginHorizontal: 22, backgroundColor: TT.card, borderWidth: 1, borderColor: TT.cardLine, borderRadius: 20, padding: 20 }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: TT.ink }}>{t.care.noSession}</Text>
                  <Text style={{ fontSize: 13, color: TT.inkSoft, marginTop: 3 }}>{t.care.noSessionSub}</Text>
                </View>
              )}

              {perms.canBook ? (
                <TouchableOpacity
                  onPress={() => router.navigate('/book' as never)}
                  activeOpacity={0.85}
                  style={{ marginHorizontal: 22, marginTop: 16, height: 50, borderRadius: 25, borderWidth: 1, borderColor: TT.cardLine, alignItems: 'center', justifyContent: 'center' }}
                >
                  <Text style={{ fontSize: 14.5, fontWeight: '700', color: TT.ink }}>{t.care.bookSession}</Text>
                </TouchableOpacity>
              ) : (
                <Text style={{ fontSize: 12.5, color: TT.inkSoft, textAlign: 'center', marginTop: 14, paddingHorizontal: 34 }}>{t.care.bookNote}</Text>
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
                      const stage = todoStage(it);
                      return <ResourceRow key={it.id} Icon={meta.Icon} title={it.title} sub={`${meta.label} · ${stageLabel(stage, locale)}`} line={stageLine(stage, TT)} onPress={open} />;
                    })}
                  </View>
                </>
              )}

              <SectionRule label={t.care.archive} />
              <View style={{ marginHorizontal: 22, backgroundColor: TT.card, borderWidth: 1, borderColor: TT.cardLine, borderRadius: 18, overflow: 'hidden' }}>
                <UtilityRow Icon={RotateCcw} label={t.care.pastSessions} onPress={() => router.navigate('/session-history' as never)} divider />
                <UtilityRow Icon={FileText} label={t.care.documents} onPress={() => router.navigate('/documents' as never)} />
              </View>
              </>
              )}
            </View>
          </FadeIn>
        </ScrollView>
      </SafeAreaView>

      <TabIntro tabKey="care" />
      {switcher.element}
    </Ground>
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
  const { t: TT, mode } = useTheme();
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
              style={{ height: 2, width: i === index ? 16 : 6, borderRadius: 1, backgroundColor: i === index ? TT.ink : veil(mode, 0.25) }}
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
  const { t: TT, mode } = useTheme();
  const inPerson = session.sessionFormat === 'in_person';
  const pay = session.paymentStatus;
  // Asked for, not yet accepted. It looked like any booked session, Join button
  // and all, while the practitioner could still decline it.
  const pending = session.status === 'pending';
  return (
    <View style={{ width, backgroundColor: TT.card, borderWidth: 1, borderColor: TT.cardLine, borderRadius: 20, padding: 18 }}>
      <Kicker color={TT.faint} size={10} style={{ marginBottom: 8 }}>{first ? t.care.nextSession : t.care.then}</Kicker>
      <Text style={{ fontSize: 19, fontWeight: '800', color: TT.ink, letterSpacing: -0.4 }}>{longDate(session.scheduledAt, locale)}</Text>
      <Text style={{ fontSize: 13, color: TT.inkSoft, marginTop: 4 }}>
        {clock(session.scheduledAt, locale)}  ·  {fmtFormat(session.sessionFormat, locale)}{first ? '' : ` · ${session.durationMinutes} min`}
      </Text>

      {pending ? (
        <View style={{ alignSelf: 'flex-start', marginTop: 12, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: 'rgba(233,196,106,0.16)' }}>
          <Text style={{ fontSize: 11.5, fontWeight: '700', color: TT.amber }}>{t.care.awaitingConfirmation}</Text>
        </View>
      ) : null}

      {pay && !pending ? (
        <View style={{ alignSelf: 'flex-start', marginTop: 12, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: pay === 'paid' ? 'rgba(127,217,192,0.16)' : 'rgba(233,196,106,0.16)' }}>
          <Text style={{ fontSize: 11.5, fontWeight: '700', color: pay === 'paid' ? TT.accent : TT.amber }}>
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
      {/* Join only where there is something to join: a video session with its
          link. A phone session has no link — the practitioner calls — and a
          "Join" that answered "Coming soon" was the button it used to show. */}
      {first && !pending && session.sessionFormat === 'phone' ? (
        <View style={{ flexDirection: 'row', gap: 7, marginTop: 14, alignItems: 'center' }}>
          <Phone size={15} color={TT.faint} strokeWidth={2} />
          <Text style={{ flex: 1, fontSize: 13, color: TT.inkSoft }}>{t.care.phoneCall}</Text>
        </View>
      ) : first && !pending && session.sessionFormat === 'video' && session.meetLink ? (
        <TouchableOpacity onPress={onJoin} activeOpacity={0.85} style={{ height: 44, borderRadius: 22, backgroundColor: TT.ctaBg, alignItems: 'center', justifyContent: 'center', marginTop: 16 }}>
          <Text style={{ fontSize: 14.5, fontWeight: '700', color: TT.ctaFg }}>{t.care.join}</Text>
        </TouchableOpacity>
      ) : first && !pending && inPerson && mapsUrl ? (
        <TouchableOpacity onPress={onMaps} activeOpacity={0.85} style={{ height: 44, borderRadius: 22, backgroundColor: TT.ctaBg, alignItems: 'center', justifyContent: 'center', marginTop: 16, flexDirection: 'row', gap: 7 }}>
          <MapPin size={16} color={TT.ctaFg} strokeWidth={2.2} />
          <Text style={{ fontSize: 14.5, fontWeight: '700', color: TT.ctaFg }}>{t.care.openInMaps}</Text>
        </TouchableOpacity>
      ) : first && !pending && inPerson && address ? (
        <View style={{ flexDirection: 'row', gap: 7, marginTop: 14, alignItems: 'flex-start' }}>
          <MapPin size={15} color={TT.faint} strokeWidth={2} style={{ marginTop: 1 }} />
          <Text style={{ flex: 1, fontSize: 13, color: TT.inkSoft, lineHeight: 19 }}>{address}</Text>
        </View>
      ) : (
        <View style={{ height: first ? 16 : 4 }} />
      )}
      {/* LAST child on purpose. Absolute positioning takes it out of the flow
          but not out of the paint order, so declared first it sat UNDER its own
          siblings: the "Next session" kicker's box runs the full width of the
          card and swallowed a band across the middle of the button. Only the
          top few pixels and the bottom were live, which reads as "the top half
          does not work". Last child paints above, so the whole circle is the
          target — plus hitSlop, because 32px is under the 44px minimum. */}
      <TouchableOpacity
        onPress={onOpen}
        activeOpacity={0.7}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={t.care.sessionOptions}
        style={{ position: 'absolute', top: 12, right: 12, width: 32, height: 32, borderRadius: 16, backgroundColor: veil(mode, 0.08), alignItems: 'center', justifyContent: 'center' }}
      >
        <Ellipsis size={17} color={TT.ink} strokeWidth={2.5} />
      </TouchableOpacity>
    </View>
  );
}

function SectionRule({ label, action, onAction }: { label: string; action?: string; onAction?: () => void }) {
  const { t: TT } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 22, marginTop: 28, marginBottom: 12 }}>
      <Kicker color={TT.faint} size={10}>{label}</Kicker>
      <View style={{ flex: 1, height: 1, backgroundColor: TT.cardLine }} />
      {action ? (
        <TouchableOpacity onPress={onAction} activeOpacity={0.7}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: TT.accent }}>{action}</Text>
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



// `line`: the border says where the item stands (see `stageLine`), beside the
// status written under the title.
function ResourceRow({ Icon, title, sub, line, onPress }: { Icon: LucideIcon; title: string; sub: string; line?: string; onPress: () => void }) {
  const { t: TT } = useTheme();
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={{ backgroundColor: TT.card, borderWidth: 1, borderColor: line ?? TT.cardLine, borderRadius: 18, padding: 14, paddingRight: 16, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
      <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(127,217,192,0.14)', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={18} color={TT.accent} strokeWidth={2} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14.5, fontWeight: '700', color: TT.ink }}>{title}</Text>
        <Text style={{ fontSize: 12, color: TT.inkSoft, marginTop: 1 }}>{sub}</Text>
      </View>
      <ChevronRight size={18} color={TT.faint} strokeWidth={2} />
    </TouchableOpacity>
  );
}

function UtilityRow({ Icon, label, onPress, divider }: { Icon: LucideIcon; label: string; onPress: () => void; divider?: boolean }) {
  const { t: TT } = useTheme();
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={{ padding: 15, paddingRight: 16, flexDirection: 'row', alignItems: 'center', gap: 14, borderBottomWidth: divider ? 1 : 0, borderBottomColor: TT.cardLine }}>
      <View style={{ width: 22, alignItems: 'center' }}>
        <Icon size={17} color={TT.inkSoft} strokeWidth={2} />
      </View>
      <Text style={{ flex: 1, fontSize: 14.5, fontWeight: '700', color: TT.ink }}>{label}</Text>
      <ChevronRight size={18} color={TT.faint} strokeWidth={2} />
    </TouchableOpacity>
  );
}

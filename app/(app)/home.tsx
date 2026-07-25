// My Care — hybrid editorial: a dark photographic header + a mono date kicker
// and greeting, then light editorial content (practitioner, next session,
// booking, to-do, sessions). Wired to real data via GET /api/mobile/care.
import { useCallback, useState } from 'react';
import { Linking, Platform, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect, useRouter } from 'expo-router';
import { ChevronRight, Plus, Ellipsis, RotateCcw, FileText, Settings, type LucideIcon } from 'lucide-react-native';
import { TabBar } from '@/src/ui/TabBar';
import { TabIntro } from '@/src/ui/TabIntro';
import { EDA, EdHeader, EdCard, EdSection, EdPill, FadeIn, MonoLabel } from '@/src/ui/editorial';
import { ONBOARDING_IMAGES } from '@/src/onboarding/editorial/images';
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
  { id: 'p2', scheduledAt: inDays(19, 9), durationMinutes: 50, sessionFormat: 'video', sessionType: 'session', status: 'scheduled', meetLink: null, paymentStatus: null },
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
  // The real first name when signed in; a sample only in the design preview.
  const pretty = name ? name.charAt(0).toUpperCase() + name.slice(1) : preview ? 'Sofia' : '';
  const greeting = new Date().getHours() < 12 ? t.greeting.morning : new Date().getHours() < 18 ? t.greeting.afternoon : t.greeting.evening;
  const headerTitle = greetHere ? (pretty ? `${greeting},\n${pretty}.` : `${greeting}.`) : t.care.title;
  const dateKicker = new Date().toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US', { weekday: 'short', day: 'numeric', month: 'short' });
  const header = (
    <EdHeader source={ONBOARDING_IMAGES.about} kicker={dateKicker} title={headerTitle} rightIcon={Settings} onRight={() => router.navigate('/settings' as never)} />
  );

  // Solo (no practitioner, not previewing): a light connect state.
  if (loaded && !showHub) {
    return (
      <View style={{ flex: 1, backgroundColor: EDA.canvas }}>
        <StatusBar style="dark" />
        <ScrollView contentContainerStyle={{ paddingBottom: 180 }} showsVerticalScrollIndicator={false}>
          {header}
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
        <TabBar active="care" />
      </View>
    );
  }

  const pracName = real?.practitionerName ?? practitionerName ?? (preview ? 'Dr. Maya Laurent' : t.care.yourPractitioner);
  const pracHeadline = real?.practitionerHeadline ?? (preview ? 'Clinical psychologist' : null);
  const initial = pracName.replace(/^dr\.?\s*/i, '').charAt(0).toUpperCase() || '?';
  const nextSession = real ? real.nextSession : preview ? PREVIEW_NEXT : null;
  const upcoming = real ? real.upcomingSessions.filter((s) => s.id !== real.nextSession?.id) : preview ? PREVIEW_UPCOMING : [];
  const todoItems = real ? (todos ?? []) : preview ? PREVIEW_TODOS : [];

  const openSession = (s: CareSession) =>
    router.navigate({
      pathname: '/session-menu',
      params: { id: s.id, scheduledAt: s.scheduledAt, durationMinutes: String(s.durationMinutes), sessionFormat: s.sessionFormat, sessionType: s.sessionType, meetLink: s.meetLink ?? '', demo: real ? '' : '1', canCancel: perms.canCancel ? '1' : '', canReschedule: perms.canReschedule ? '1' : '', noticeHours: String(perms.noticeHours) },
    } as never);

  const joinSession = () => {
    if (nextSession?.meetLink) {
      if (Platform.OS === 'web') globalThis.open?.(nextSession.meetLink, '_blank');
      else Linking.openURL(nextSession.meetLink).catch(() => {});
    } else soon();
  };

  return (
    <View style={{ flex: 1, backgroundColor: EDA.canvas }}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={{ paddingBottom: 180 }} showsVerticalScrollIndicator={false}>
        {header}
        <FadeIn style={{ paddingHorizontal: 22, paddingTop: 20 }}>
          <TabIntro tabKey="care" onActiveChange={setIntroActive} />

          <View style={{ opacity: introActive ? 0.3 : 1 }} pointerEvents={introActive ? 'none' : 'auto'}>
            {/* Practitioner */}
            <EdCard onPress={() => router.navigate('/practitioner' as never)} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 14, padding: 16 }}>
              <Avatar initial={initial} size={48} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: EDA.ink }}>{pracName}</Text>
                {pracHeadline ? <Text style={{ fontSize: 12.5, color: EDA.inkSoft, marginTop: 1 }}>{pracHeadline}</Text> : null}
              </View>
              <ChevronRight size={18} color={EDA.faint} strokeWidth={2} />
            </EdCard>

            {/* Next session — the one dark accent block */}
            {nextSession ? (
              <View style={{ backgroundColor: EDA.ink, borderRadius: 20, padding: 18, marginBottom: 14 }}>
                <TouchableOpacity onPress={() => nextSession && openSession(nextSession)} activeOpacity={0.7} style={{ position: 'absolute', top: 14, right: 14, width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' }}>
                  <Ellipsis size={18} color="#fff" strokeWidth={2.5} />
                </TouchableOpacity>
                <MonoLabel color="rgba(255,255,255,0.6)" style={{ marginBottom: 8 }}>{t.care.nextSession}</MonoLabel>
                <Text style={{ fontSize: 20, fontWeight: '800', color: '#fff', letterSpacing: -0.3 }}>{longDate(nextSession.scheduledAt)} · {clock(nextSession.scheduledAt)}</Text>
                <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.72)', marginTop: 3 }}>{fmtFormat(nextSession.sessionFormat)} · {relDays(nextSession.scheduledAt)}</Text>
                {nextSession.paymentStatus ? (
                  <View style={{ alignSelf: 'flex-start', marginTop: 10, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.14)' }}>
                    <Text style={{ fontSize: 11.5, fontWeight: '700', color: '#fff' }}>{nextSession.paymentStatus === 'paid' ? t.care.paid : nextSession.paymentStatus === 'free' ? t.care.noCharge : t.care.awaitingPayment}</Text>
                  </View>
                ) : null}
                <TouchableOpacity onPress={joinSession} activeOpacity={0.85} style={{ height: 46, borderRadius: 23, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', marginTop: 16 }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: EDA.ink }}>{t.care.join}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <EdCard style={{ marginBottom: 14, padding: 20 }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: EDA.ink }}>{t.care.noSession}</Text>
                <Text style={{ fontSize: 13, color: EDA.inkSoft, marginTop: 3 }}>{t.care.noSessionSub}</Text>
              </EdCard>
            )}

            {/* Book */}
            {perms.canBook ? (
              <EdPill label={t.care.bookSession} variant="outline" onPress={() => router.navigate('/book' as never)} style={{ marginBottom: 28 }} />
            ) : (
              <Text style={{ fontSize: 12.5, color: EDA.inkSoft, textAlign: 'center', marginBottom: 28, paddingHorizontal: 12 }}>{t.care.bookNote}</Text>
            )}

            {/* To do */}
            {todoItems.length > 0 && (
              <>
                <EdSection label={fmt(t.care.todoFrom, { name: firstNameOf(pracName) })} action={`${t.common.seeAll} (${todoItems.length})`} onAction={() => router.navigate('/from-practitioner' as never)} />
                <View style={{ gap: 10, marginBottom: 28 }}>
                  {todoItems.slice(0, 3).map((it) => {
                    const meta = resourceTypeMeta(it.type, locale);
                    const open = it.resourceId ? () => router.navigate(`/resource/${it.id}` as never) : () => router.navigate('/from-practitioner' as never);
                    return <ResourceRow key={it.id} Icon={meta.Icon} title={it.title} sub={`${meta.label} · ${statusLabel(it.status, locale)}`} onPress={open} />;
                  })}
                </View>
              </>
            )}

            {/* Upcoming */}
            {upcoming.length > 0 && (
              <>
                <EdSection label={locale === 'fr' ? 'Séances à venir' : 'Upcoming sessions'} action={t.common.seeAll} onAction={soon} />
                <View style={{ gap: 10, marginBottom: 28 }}>
                  {upcoming.map((s) => (
                    <SessionRow key={s.id} month={monthShort(s.scheduledAt, locale)} day={dayNum(s.scheduledAt)} title={`${weekday(s.scheduledAt, locale)} · ${clock(s.scheduledAt)}`} sub={`${fmtFormat(s.sessionFormat)} · ${s.durationMinutes} min`} onPress={() => openSession(s)} />
                  ))}
                </View>
              </>
            )}

            {/* Utility rows */}
            <EdCard style={{ padding: 0, overflow: 'hidden' }}>
              <UtilityRow Icon={RotateCcw} label={t.care.sessionHistory} onPress={() => router.navigate('/session-history' as never)} divider />
              <UtilityRow Icon={FileText} label={t.care.documents} onPress={() => router.navigate('/documents' as never)} />
            </EdCard>
          </View>
        </FadeIn>
      </ScrollView>

      <TabBar active="care" />
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
function longDate(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString(undefined, { weekday: 'short' })}, ${d.getDate()} ${d.toLocaleDateString(undefined, { month: 'long' })}`;
}
function clock(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
function relDays(iso: string): string {
  const days = Math.round((startOfDay(new Date(iso)) - startOfDay(new Date())) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'tomorrow';
  return `in ${days} days`;
}
function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}
function fmtFormat(f: string): string {
  return f === 'video' ? 'Video' : f === 'phone' ? 'Phone' : f === 'in_person' ? 'In person' : f;
}
const monthShort = (iso: string, locale: string) => new Date(iso).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US', { month: 'short' });
const dayNum = (iso: string) => String(new Date(iso).getDate());
const weekday = (iso: string, locale: string) => new Date(iso).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US', { weekday: 'long' });

function firstNameOf(name: string): string {
  return name.replace(/^dr\.?\s*/i, '').trim().split(/\s+/)[0] || 'your practitioner';
}

function Avatar({ initial, size }: { initial: string; size: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: EDA.green, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#fff', fontWeight: '700', fontSize: size * 0.4 }}>{initial}</Text>
    </View>
  );
}

function ResourceRow({ Icon, title, sub, onPress }: { Icon: LucideIcon; title: string; sub: string; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={{ backgroundColor: EDA.card, borderWidth: 1, borderColor: EDA.line, borderRadius: 18, padding: 15, paddingRight: 16, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
      <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: EDA.greenTint, alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={19} color={EDA.green} strokeWidth={2} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14.5, fontWeight: '700', color: EDA.ink }}>{title}</Text>
        <Text style={{ fontSize: 12, color: EDA.inkSoft, marginTop: 1 }}>{sub}</Text>
      </View>
      <ChevronRight size={18} color={EDA.faint} strokeWidth={2} />
    </TouchableOpacity>
  );
}

function SessionRow({ month, day, title, sub, onPress }: { month: string; day: string; title: string; sub: string; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={{ backgroundColor: EDA.card, borderWidth: 1, borderColor: EDA.line, borderRadius: 18, padding: 14, paddingRight: 16, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
      <View style={{ width: 46, alignItems: 'center' }}>
        <MonoLabel color={EDA.green} size={9.5}>{month}</MonoLabel>
        <Text style={{ fontSize: 20, fontWeight: '800', color: EDA.ink, lineHeight: 24 }}>{day}</Text>
      </View>
      <View style={{ width: 1, height: 32, backgroundColor: EDA.line }} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: EDA.ink }}>{title}</Text>
        <Text style={{ fontSize: 12, color: EDA.inkSoft, marginTop: 1 }}>{sub}</Text>
      </View>
      <ChevronRight size={18} color={EDA.faint} strokeWidth={2} />
    </TouchableOpacity>
  );
}

function UtilityRow({ Icon, label, onPress, divider }: { Icon: LucideIcon; label: string; onPress: () => void; divider?: boolean }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={{ padding: 15, paddingRight: 16, flexDirection: 'row', alignItems: 'center', gap: 14, borderBottomWidth: divider ? 1 : 0, borderBottomColor: EDA.line }}>
      <View style={{ width: 22, alignItems: 'center' }}>
        <Icon size={17} color={EDA.inkSoft} strokeWidth={2} />
      </View>
      <Text style={{ flex: 1, fontSize: 14.5, fontWeight: '700', color: EDA.ink }}>{label}</Text>
      <ChevronRight size={18} color={EDA.faint} strokeWidth={2} />
    </TouchableOpacity>
  );
}

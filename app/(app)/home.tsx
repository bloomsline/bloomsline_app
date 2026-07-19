// My Care — Flow C hub (cloud design c1), wired to real data via GET
// /api/mobile/care: the patient's practitioner + upcoming sessions. When there's
// no linked practitioner, FORCE_CARE_HUB shows the design placeholder for review;
// otherwise a solo "connect" state. To-do / sharing-history / documents are still
// placeholder pending their own mobile endpoints.
import { useCallback, useState } from 'react';
import { Alert, Linking, Platform, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { ChevronRight, Plus, Ellipsis, Eye, RotateCcw, FileText, Settings, type LucideIcon } from 'lucide-react-native';
import { TabBar } from '@/src/ui/TabBar';
import { useOnboarding } from '@/src/onboarding/context';
import { FORCE_CARE_HUB } from '@/src/config';
import { fetchCare, fetchTodo, type CareSession, type PatientCare, type TodoItem } from '@/src/api/care';
import { resourceTypeMeta, statusLabel } from '@/src/care/resources';

const TEAL = '#009B8E';

// Design placeholder used only for the FORCE_CARE_HUB preview (no real practitioner).
const PREVIEW_NEXT: CareSession = { id: 'preview', scheduledAt: inDays(5, 9), durationMinutes: 50, sessionFormat: 'video', sessionType: 'session', status: 'scheduled', meetLink: null };
const PREVIEW_UPCOMING: CareSession[] = [
  { id: 'p1', scheduledAt: inDays(12, 9), durationMinutes: 50, sessionFormat: 'video', sessionType: 'session', status: 'scheduled', meetLink: null },
  { id: 'p2', scheduledAt: inDays(19, 9), durationMinutes: 50, sessionFormat: 'video', sessionType: 'session', status: 'scheduled', meetLink: null },
];
const PREVIEW_TODOS: TodoItem[] = [
  { id: 'dt1', resourceId: '', title: 'A short reflection', type: 'worksheet', status: 'in_progress', dueAt: null, assignedAt: '' },
  { id: 'dt2', resourceId: '', title: 'Evening wind-down', type: 'exercise', status: 'assigned', dueAt: null, assignedAt: '' },
];

export default function MyCare() {
  const router = useRouter();
  const { practitionerName, hasPractitioner } = useOnboarding();
  const [care, setCare] = useState<PatientCare | null>(null);
  const [todos, setTodos] = useState<TodoItem[] | null>(null);
  const [loaded, setLoaded] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      fetchCare().then((c) => { if (alive) { setCare(c); setLoaded(true); } });
      fetchTodo().then((t) => { if (alive) setTodos(t); });
      return () => { alive = false; };
    }, []),
  );

  const soon = () => {
    if (Platform.OS === 'web') globalThis.alert?.('Coming soon');
    else Alert.alert('Coming soon');
  };

  const real = care?.hasPractitioner ? care : null;
  const preview = !real && FORCE_CARE_HUB;
  const showHub = !!real || preview || hasPractitioner;

  // Solo (no practitioner, not previewing): light connect state, no Moments content.
  if (loaded && !showHub) {
    return (
      <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: '#FAFAF8' }}>
        <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 180 }} showsVerticalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <Text style={{ fontSize: 28, fontWeight: '700', letterSpacing: -0.6, color: '#1A1A1A' }}>My Care</Text>
            <SettingsButton onPress={() => router.navigate('/settings' as never)} />
          </View>
          <View style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: '#EBEBEB', borderRadius: 20, padding: 22, alignItems: 'center' }}>
            <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: '#EAF4F1', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
              <Plus size={22} color={TEAL} strokeWidth={2} />
            </View>
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#1A1A1A' }}>Connect with a practitioner</Text>
            <Text style={{ fontSize: 13, color: '#999', textAlign: 'center', marginTop: 6, lineHeight: 19 }}>
              When your practitioner invites you, your sessions and shared resources appear here.
            </Text>
          </View>
        </ScrollView>
        <TabBar active="care" />
      </SafeAreaView>
    );
  }

  const pracName = real?.practitionerName ?? practitionerName ?? 'Dr. Maya Laurent';
  const headline = real?.practitionerHeadline ?? 'Clinical psychologist';
  const initial = pracName.replace(/^dr\.?\s*/i, '').charAt(0).toUpperCase() || 'M';
  const nextSession = real ? real.nextSession : preview ? PREVIEW_NEXT : null;
  const upcoming = real ? real.upcomingSessions.filter((s) => s.id !== real.nextSession?.id) : preview ? PREVIEW_UPCOMING : [];
  const todoItems = real ? (todos ?? []) : preview ? PREVIEW_TODOS : [];

  const openSession = (s: CareSession) =>
    router.navigate({
      pathname: '/session-menu',
      params: { id: s.id, scheduledAt: s.scheduledAt, durationMinutes: String(s.durationMinutes), sessionFormat: s.sessionFormat, sessionType: s.sessionType, meetLink: s.meetLink ?? '', demo: real ? '' : '1' },
    } as never);

  const joinSession = () => {
    if (nextSession?.meetLink) {
      if (Platform.OS === 'web') globalThis.open?.(nextSession.meetLink, '_blank');
      else Linking.openURL(nextSession.meetLink).catch(() => {});
    } else soon();
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: '#FAFAF8' }}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 20, paddingBottom: 180 }} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <Text style={{ fontSize: 28, fontWeight: '700', letterSpacing: -0.6, color: '#1A1A1A' }}>My Care</Text>
          <SettingsButton onPress={() => router.navigate('/settings' as never)} />
        </View>

        {/* Practitioner card */}
        <TouchableOpacity
          onPress={() => router.navigate('/practitioner' as never)}
          activeOpacity={0.8}
          style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: '#EBEBEB', borderRadius: 20, padding: 16, paddingRight: 18, flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 14 }}
        >
          <Avatar initial={initial} size={48} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#1A1A1A' }}>{pracName}</Text>
            <Text style={{ fontSize: 12.5, color: '#999', marginTop: 1 }}>{headline}</Text>
          </View>
          <ChevronRight size={18} color="#CCC" strokeWidth={2} />
        </TouchableOpacity>

        {/* Next session */}
        {nextSession ? (
          <View style={{ backgroundColor: TEAL, borderRadius: 20, padding: 18, marginBottom: 14 }}>
            <TouchableOpacity
              onPress={() => nextSession && openSession(nextSession)}
              activeOpacity={0.7}
              style={{ position: 'absolute', top: 14, right: 14, width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' }}
            >
              <Ellipsis size={18} color="#fff" strokeWidth={2.5} />
            </TouchableOpacity>
            <Text style={{ fontSize: 11, fontWeight: '600', letterSpacing: 1, color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase', marginBottom: 6 }}>Next session</Text>
            <Text style={{ fontSize: 19, fontWeight: '700', color: '#fff' }}>{longDate(nextSession.scheduledAt)} · {clock(nextSession.scheduledAt)}</Text>
            <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 2 }}>{fmtFormat(nextSession.sessionFormat)} · {relDays(nextSession.scheduledAt)}</Text>
            <TouchableOpacity onPress={joinSession} activeOpacity={0.85} style={{ height: 44, borderRadius: 22, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', marginTop: 16 }}>
              <Text style={{ fontSize: 15, fontWeight: '600', color: '#1A4A3F' }}>Join session</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: '#EBEBEB', borderRadius: 20, padding: 20, marginBottom: 14 }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: '#1A1A1A' }}>No session booked yet</Text>
            <Text style={{ fontSize: 13, color: '#999', marginTop: 3 }}>Book a time below whenever you’re ready.</Text>
          </View>
        )}

        {/* Book a session (outline) */}
        <TouchableOpacity
          onPress={() => router.navigate('/book' as never)}
          activeOpacity={0.8}
          style={{ height: 52, borderRadius: 26, borderWidth: 1.5, borderColor: TEAL, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 26 }}
        >
          <Plus size={18} color={TEAL} strokeWidth={2.5} />
          <Text style={{ fontSize: 15, fontWeight: '600', color: TEAL }}>Book a session</Text>
        </TouchableOpacity>

        {/* To do · from practitioner (real assignments) */}
        {todoItems.length > 0 && (
          <>
            <SectionHeader label={`To do · from ${firstNameOf(pracName)}`} action={`See all (${todoItems.length})`} onAction={() => router.navigate('/from-practitioner' as never)} />
            <View style={{ gap: 10, marginBottom: 26 }}>
              {todoItems.slice(0, 3).map((t) => {
                const meta = resourceTypeMeta(t.type);
                const open = t.resourceId ? () => router.navigate(`/resource/${t.id}` as never) : () => router.navigate('/from-practitioner' as never);
                return <ResourceRow key={t.id} Icon={meta.Icon} title={t.title} sub={`${meta.label} · ${statusLabel(t.status)}`} onPress={open} />;
              })}
            </View>
          </>
        )}

        {/* Upcoming sessions (real) */}
        {upcoming.length > 0 && (
          <>
            <SectionHeader label="Upcoming sessions" action="See all" onAction={soon} />
            <View style={{ gap: 10, marginBottom: 26 }}>
              {upcoming.map((s) => (
                <SessionRow key={s.id} month={monthShort(s.scheduledAt)} day={dayNum(s.scheduledAt)} title={`${weekday(s.scheduledAt)} · ${clock(s.scheduledAt)}`} sub={`${fmtFormat(s.sessionFormat)} · ${s.durationMinutes} min`} onPress={() => openSession(s)} />
              ))}
            </View>
          </>
        )}

        {/* Quiet utility rows (placeholder until their endpoints) */}
        <View style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: '#EBEBEB', borderRadius: 18, overflow: 'hidden' }}>
          <UtilityRow Icon={Eye} label="Sharing history" meta="Manage" onPress={() => router.navigate('/sharing' as never)} divider />
          <UtilityRow Icon={RotateCcw} label="Session history" meta="" onPress={() => router.navigate('/session-history' as never)} divider />
          <UtilityRow Icon={FileText} label="Documents & forms" meta="" onPress={() => router.navigate('/documents' as never)} />
        </View>
      </ScrollView>

      <TabBar active="care" />
    </SafeAreaView>
  );
}

// ---- date helpers (local time) ----
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
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
function relDays(iso: string): string {
  const now = new Date();
  const then = new Date(iso);
  const days = Math.round((startOfDay(then) - startOfDay(now)) / 86400000);
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
const monthShort = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: 'short' });
const dayNum = (iso: string) => String(new Date(iso).getDate());
const weekday = (iso: string) => new Date(iso).toLocaleDateString(undefined, { weekday: 'long' });

function firstNameOf(name: string): string {
  const cleaned = name.replace(/^dr\.?\s*/i, '').trim();
  return cleaned.split(/\s+/)[0] || 'your practitioner';
}

function SettingsButton({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#F1F1EF', alignItems: 'center', justifyContent: 'center' }}>
      <Settings size={18} color="#666" strokeWidth={1.8} />
    </TouchableOpacity>
  );
}

function Avatar({ initial, size }: { initial: string; size: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: TEAL, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#fff', fontWeight: '700', fontSize: size * 0.4 }}>{initial}</Text>
    </View>
  );
}

function SectionHeader({ label, action, onAction }: { label: string; action: string; onAction: () => void }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
      <Text style={{ fontSize: 12, fontWeight: '700', letterSpacing: 0.5, color: '#9A9A9A', textTransform: 'uppercase' }}>{label}</Text>
      <TouchableOpacity onPress={onAction} hitSlop={8}>
        <Text style={{ fontSize: 12.5, fontWeight: '600', color: TEAL }}>{action}</Text>
      </TouchableOpacity>
    </View>
  );
}

function ResourceRow({ Icon, title, sub, onPress }: { Icon: LucideIcon; title: string; sub: string; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: '#EBEBEB', borderRadius: 18, padding: 15, paddingRight: 16, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
      <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: '#EAF4F1', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={19} color={TEAL} strokeWidth={2} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14.5, fontWeight: '700', color: '#1A1A1A' }}>{title}</Text>
        <Text style={{ fontSize: 12, color: '#999', marginTop: 1 }}>{sub}</Text>
      </View>
      <ChevronRight size={18} color="#CCC" strokeWidth={2} />
    </TouchableOpacity>
  );
}

function SessionRow({ month, day, title, sub, onPress }: { month: string; day: string; title: string; sub: string; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: '#EBEBEB', borderRadius: 18, padding: 14, paddingRight: 16, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
      <View style={{ width: 46, alignItems: 'center' }}>
        <Text style={{ fontSize: 11, fontWeight: '600', color: TEAL, textTransform: 'uppercase', letterSpacing: 0.5 }}>{month}</Text>
        <Text style={{ fontSize: 20, fontWeight: '700', color: '#1A1A1A', lineHeight: 22 }}>{day}</Text>
      </View>
      <View style={{ width: 1, height: 32, backgroundColor: '#EEE' }} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: '#1A1A1A' }}>{title}</Text>
        <Text style={{ fontSize: 12, color: '#999', marginTop: 1 }}>{sub}</Text>
      </View>
      <ChevronRight size={18} color="#CCC" strokeWidth={2} />
    </TouchableOpacity>
  );
}

function UtilityRow({ Icon, label, meta, onPress, divider }: { Icon: LucideIcon; label: string; meta: string; onPress: () => void; divider?: boolean }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={{ padding: 15, paddingRight: 16, flexDirection: 'row', alignItems: 'center', gap: 14, borderBottomWidth: divider ? 1 : 0, borderBottomColor: '#F2F2F2' }}
    >
      <View style={{ width: 22, alignItems: 'center' }}>
        <Icon size={17} color="#9A9A9A" strokeWidth={2} />
      </View>
      <Text style={{ flex: 1, fontSize: 14.5, fontWeight: '600', color: '#1A1A1A' }}>{label}</Text>
      {meta ? <Text style={{ fontSize: 12.5, color: '#B4B4B4' }}>{meta}</Text> : null}
      <ChevronRight size={18} color="#CCC" strokeWidth={2} />
    </TouchableOpacity>
  );
}

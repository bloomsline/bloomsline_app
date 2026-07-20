// c1b — Session menu bottom sheet. Shows the REAL session (passed in as params)
// and wires reschedule (→ the slot picker in reschedule mode) and cancel (→ POST
// /api/mobile/care/sessions/[id]/cancel). Demo sessions (FORCE_CARE_HUB preview)
// don't hit the backend.
import { useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Info } from 'lucide-react-native';
import { CARE } from '@/src/care/theme';
import { useOnboarding } from '@/src/onboarding/context';
import { cancelSession } from '@/src/api/booking';

export default function SessionMenu() {
  const router = useRouter();
  const p = useLocalSearchParams<{ id?: string; scheduledAt?: string; durationMinutes?: string; sessionFormat?: string; sessionType?: string; meetLink?: string; demo?: string; canCancel?: string; canReschedule?: string; noticeHours?: string }>();
  const { practitionerName } = useOnboarding();
  const name = practitionerName ?? 'Dr. Maya';
  const initial = name.replace(/^dr\.?\s*/i, '').charAt(0).toUpperCase() || 'M';

  const id = typeof p.id === 'string' ? p.id : '';
  const start = p.scheduledAt ? new Date(p.scheduledAt) : null;
  const duration = Number(p.durationMinutes) || 50;
  const format = typeof p.sessionFormat === 'string' ? p.sessionFormat : 'video';
  const isDemo = p.demo === '1';
  // Demo/preview shows both actions; a real session uses the flags home passed
  // through from the practitioner's policy.
  const canCancel = isDemo || p.canCancel === '1';
  const canReschedule = isDemo || p.canReschedule === '1';
  const noticeHours = Number(p.noticeHours) || 24;

  const [busy, setBusy] = useState(false);
  const close = () => (router.canGoBack() ? router.back() : router.navigate('/home' as never));

  const reschedule = () =>
    router.navigate({ pathname: '/book', params: { rescheduleId: id, sessionTypeId: p.sessionType ?? '', format, demo: isDemo ? '1' : '' } } as never);

  const doCancel = async () => {
    setBusy(true);
    const res = await cancelSession(id);
    setBusy(false);
    if (res.ok) { close(); return; }
    if (Platform.OS === 'web') globalThis.alert?.(res.error ?? 'Could not cancel.');
  };

  const confirmCancel = () => {
    if (isDemo) { if (Platform.OS === 'web') globalThis.alert?.('Session cancelled (demo)'); close(); return; }
    if (Platform.OS === 'web') {
      if (globalThis.confirm?.('Cancel this session?')) doCancel();
    } else {
      Alert.alert('Cancel session', 'This will free the slot.', [
        { text: 'Keep it', style: 'cancel' },
        { text: 'Cancel session', style: 'destructive', onPress: doCancel },
      ]);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: 'rgba(20,20,20,0.4)', justifyContent: 'flex-end' }}>
      <Pressable style={{ flex: 1 }} onPress={close} />
      <SafeAreaView edges={['bottom']} style={{ backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28 }}>
        <View style={{ paddingHorizontal: 24, paddingTop: 14, paddingBottom: 8 }}>
          <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: '#E5E5E5', alignSelf: 'center', marginBottom: 18 }} />

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' }}>
            <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: CARE.teal, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 18 }}>{initial}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: CARE.ink }}>{start ? `${longDate(start)} · ${clock(start)}` : 'Session'}</Text>
              <Text style={{ fontSize: 12.5, color: '#999', marginTop: 1 }}>with {name} · {duration} min · {fmtFormat(format)}</Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: 10, paddingVertical: 16 }}>
            <MiniFact label="Starts in" value={start ? startsIn(start) : '—'} />
            <MiniFact label="Format" value={fmtFormat(format)} />
          </View>

          {(canCancel || canReschedule) && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: CARE.canvas, borderRadius: 14, padding: 13, marginBottom: 16 }}>
              <Info size={15} color={CARE.teal} strokeWidth={2} />
              <Text style={{ flex: 1, fontSize: 12.5, color: '#7A7A7A', lineHeight: 18 }}>
                {`Changes allowed up to ${noticeHours} hours before the session.`}
              </Text>
            </View>
          )}

          {canReschedule && (
            <Pressable onPress={reschedule} disabled={busy} style={{ height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: CARE.teal }}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#fff' }}>Reschedule session</Text>
            </Pressable>
          )}
          {canReschedule && canCancel && <View style={{ height: 10 }} />}
          {canCancel && (
            <Pressable onPress={confirmCancel} disabled={busy} style={{ height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: CARE.dangerBorder }}>
              {busy ? <ActivityIndicator color={CARE.danger} /> : <Text style={{ fontSize: 16, fontWeight: '600', color: CARE.danger }}>Cancel session</Text>}
            </Pressable>
          )}

          {/* Neither allowed: say so, so the sheet is not an empty panel. */}
          {!canCancel && !canReschedule && (
            <Text style={{ fontSize: 12.5, color: '#999', textAlign: 'center', lineHeight: 18 }}>
              To change or cancel this session, contact your practitioner.
            </Text>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

function MiniFact({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: CARE.canvas, borderWidth: 1, borderColor: '#EEE', borderRadius: 14, padding: 12, alignItems: 'center' }}>
      <Text style={{ fontSize: 11, fontWeight: '600', color: CARE.muted, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</Text>
      <Text style={{ fontSize: 14, color: CARE.ink, fontWeight: '700', marginTop: 3 }}>{value}</Text>
    </View>
  );
}

const longDate = (d: Date) => `${d.toLocaleDateString(undefined, { weekday: 'long' })}, ${d.getDate()} ${d.toLocaleDateString(undefined, { month: 'long' })}`;
const clock = (d: Date) => `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
const fmtFormat = (f: string) => (f === 'video' ? 'Video call' : f === 'phone' ? 'Phone' : f === 'in_person' ? 'In person' : f);
function startsIn(d: Date): string {
  const days = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()).getTime()) / 86400000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return `${days} days`;
}

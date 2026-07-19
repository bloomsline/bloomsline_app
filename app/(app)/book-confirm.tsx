// c4 — Confirm booking. Wired to POST /api/mobile/care/book (server re-validates
// the slot + atomic double-booking guard). `demo=1` (FORCE_CARE_HUB preview) just
// acknowledges without a real write. On success the hub refetches and shows it.
import { useRef, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Info, Video } from 'lucide-react-native';
import { CareHeader } from '@/src/care/CareHeader';
import { CARE } from '@/src/care/theme';
import { useOnboarding } from '@/src/onboarding/context';
import { createBooking, rescheduleSession } from '@/src/api/booking';

export default function BookConfirm() {
  const router = useRouter();
  const params = useLocalSearchParams<{ slotIso?: string; sessionTypeId?: string; format?: string; durationMinutes?: string; demo?: string; rescheduleId?: string }>();
  const rescheduleId = typeof params.rescheduleId === 'string' ? params.rescheduleId : '';
  const { practitionerName } = useOnboarding();
  const name = practitionerName ?? 'your practitioner';
  const initial = name.replace(/^dr\.?\s*/i, '').charAt(0).toUpperCase() || 'M';

  const slotIso = typeof params.slotIso === 'string' ? params.slotIso : '';
  const durationMinutes = Number(params.durationMinutes) || 50;
  const format = typeof params.format === 'string' ? params.format : 'video';
  const isDemo = params.demo === '1';
  const idempotencyKey = useRef(`mb-${Date.now()}-${Math.floor(Math.random() * 1e6)}`).current;

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = slotIso ? new Date(slotIso) : null;
  const end = start ? new Date(start.getTime() + durationMinutes * 60000) : null;

  const alert = (m: string) => Platform.OS === 'web' && globalThis.alert?.(m);

  const confirm = async () => {
    if (busy || !start) return;
    if (isDemo) {
      alert(rescheduleId ? 'Session rescheduled (demo)' : 'Booking confirmed (demo)');
      router.navigate('/home' as never);
      return;
    }
    setBusy(true);
    setError(null);

    const res = rescheduleId
      ? await rescheduleSession(rescheduleId, slotIso)
      : await createBooking({ slotIso, sessionTypeId: params.sessionTypeId, format, idempotencyKey });

    if (res.ok) {
      router.navigate('/home' as never); // hub refetches on focus → change shows
      return;
    }
    setBusy(false);
    if (res.reason === 'conflict' || res.reason === 'unavailable') {
      setError('That time is no longer available. Please pick another.');
    } else {
      setError(res.error ?? 'Something went wrong. Please try again.');
    }
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: CARE.canvas }}>
      <CareHeader title="Confirm" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: 110 }} showsVerticalScrollIndicator={false}>
        <View style={{ backgroundColor: CARE.card, borderWidth: 1, borderColor: CARE.border, borderRadius: 20, padding: 24, alignItems: 'center' }}>
          <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: CARE.teal, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 22 }}>{initial}</Text>
          </View>
          <Text style={{ fontSize: 22, fontWeight: '700', color: CARE.ink }}>{start ? longDate(start) : '—'}</Text>
          <Text style={{ fontSize: 16, color: '#6A6459', marginTop: 4 }}>{start && end ? `${clock(start)} – ${clock(end)}` : ''} · with {name}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14, backgroundColor: CARE.mint, borderRadius: 14, paddingVertical: 7, paddingHorizontal: 14 }}>
            <Video size={14} color={CARE.teal} strokeWidth={2} />
            <Text style={{ fontSize: 13, fontWeight: '600', color: CARE.teal }}>{format === 'video' ? 'Video session' : format === 'phone' ? 'Phone session' : 'In-person session'}</Text>
          </View>
        </View>

        <View style={{ backgroundColor: CARE.card, borderWidth: 1, borderColor: CARE.border, borderRadius: 16, padding: 16, marginTop: 14, flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
          <Info size={16} color={CARE.teal} strokeWidth={2} />
          <Text style={{ flex: 1, fontSize: 13.5, color: '#6A6459', lineHeight: 21 }}>
            Free to reschedule or cancel up to <Text style={{ color: CARE.ink, fontWeight: '700' }}>24 hours</Text> before. We&apos;ll remind you the day before — reminders are yours to switch off.
          </Text>
        </View>

        {error && <Text style={{ marginTop: 14, fontSize: 13.5, fontWeight: '600', color: CARE.danger, textAlign: 'center' }}>{error}</Text>}
      </ScrollView>

      <View style={{ position: 'absolute', left: 24, right: 24, bottom: 24 }}>
        <TouchableOpacity onPress={confirm} disabled={busy || !start} activeOpacity={0.85} style={{ height: 56, borderRadius: 28, backgroundColor: busy || !start ? '#E5E5E5' : CARE.teal, alignItems: 'center', justifyContent: 'center' }}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={{ fontSize: 16, fontWeight: '600', color: !start ? '#999' : '#fff' }}>{rescheduleId ? 'Confirm new time' : 'Confirm booking'}</Text>}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function longDate(d: Date): string {
  return `${d.toLocaleDateString(undefined, { weekday: 'long' })}, ${d.getDate()} ${d.toLocaleDateString(undefined, { month: 'long' })}`;
}
function clock(d: Date): string {
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

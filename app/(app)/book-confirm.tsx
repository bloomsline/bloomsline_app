// c4 — Confirm booking. Wired to POST /api/mobile/care/book (server re-validates
// the slot + atomic double-booking guard). `demo=1` (FORCE_CARE_HUB preview) just
// acknowledges without a real write. On success the hub refetches and shows it.
import { useRef, useState } from 'react';
import { Platform, ScrollView, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Info, Video } from 'lucide-react-native';
import { EdHeader, EdCard, EdPill, FadeIn } from '@/src/ui/editorial';
import { ONBOARDING_IMAGES } from '@/src/onboarding/editorial/images';
import { useOnboarding } from '@/src/onboarding/context';
import { createBooking, rescheduleSession } from '@/src/api/booking';
import { useI18n, type Locale } from '@/src/i18n';
import { useTheme } from '@/src/ui/theme-mode';

const T = {
  en: {
    confirmTitle: 'Confirm',
    yourPractitioner: 'your practitioner',
    rescheduledDemo: 'Session rescheduled (demo)',
    confirmedDemo: 'Booking confirmed (demo)',
    noLongerAvailable: 'That time is no longer available. Please pick another.',
    genericError: 'Something went wrong. Please try again.',
    withName: (n: string) => `· with ${n}`,
    videoSession: 'Video session',
    phoneSession: 'Phone session',
    inPersonSession: 'In-person session',
    policyPre: 'Free to reschedule or cancel up to ',
    policyBold: '24 hours',
    policyPost: " before. We'll remind you the day before, and reminders are yours to switch off.",
    confirmNewTime: 'Confirm new time',
    confirmBooking: 'Confirm booking',
  },
  fr: {
    confirmTitle: 'Confirmer',
    yourPractitioner: 'votre praticien',
    rescheduledDemo: 'Séance reprogrammée (démo)',
    confirmedDemo: 'Réservation confirmée (démo)',
    noLongerAvailable: "Ce créneau n'est plus disponible. Veuillez en choisir un autre.",
    genericError: "Une erreur s'est produite. Veuillez réessayer.",
    withName: (n: string) => `· avec ${n}`,
    videoSession: 'Séance vidéo',
    phoneSession: 'Séance téléphonique',
    inPersonSession: 'Séance en personne',
    policyPre: "Reprogrammation ou annulation gratuite jusqu'à ",
    policyBold: '24 heures',
    policyPost: " avant. Nous vous le rappellerons la veille, et vous pouvez désactiver les rappels quand vous le souhaitez.",
    confirmNewTime: 'Confirmer le nouvel horaire',
    confirmBooking: 'Confirmer la réservation',
  },
} as const;

export default function BookConfirm() {
  const { t: TT } = useTheme();
  const router = useRouter();
  const { locale } = useI18n();
  const tr = T[locale];
  const params = useLocalSearchParams<{ slotIso?: string; sessionTypeId?: string; format?: string; durationMinutes?: string; demo?: string; rescheduleId?: string }>();
  const rescheduleId = typeof params.rescheduleId === 'string' ? params.rescheduleId : '';
  const { practitionerName } = useOnboarding();
  const name = practitionerName ?? tr.yourPractitioner;
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
      alert(rescheduleId ? tr.rescheduledDemo : tr.confirmedDemo);
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
      setError(tr.noLongerAvailable);
    } else {
      setError(res.error ?? tr.genericError);
    }
  };

  const kicker = (start ? longDate(start, locale) : tr.confirmTitle).toUpperCase();

  return (
    <View style={{ flex: 1, backgroundColor: TT.bg }}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        <EdHeader kicker={kicker} title={tr.confirmTitle} source={ONBOARDING_IMAGES.final} onBack={() => router.back()} />
        <FadeIn style={{ paddingHorizontal: 22, paddingTop: 20 }}>
          {/* Summary */}
          <EdCard style={{ padding: 24, alignItems: 'center' }}>
            <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: TT.accent, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 22 }}>{initial}</Text>
            </View>
            <Text style={{ fontSize: 22, fontWeight: '800', color: TT.ink, letterSpacing: -0.3, textAlign: 'center' }}>{start ? longDate(start, locale) : '—'}</Text>
            <Text style={{ fontSize: 15, color: TT.inkSoft, marginTop: 4, textAlign: 'center' }}>{start && end ? `${clock(start)} – ${clock(end)}` : ''} {tr.withName(name)}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14, backgroundColor: TT.accentTint, borderRadius: 14, paddingVertical: 7, paddingHorizontal: 14 }}>
              <Video size={14} color={TT.accent} strokeWidth={2} />
              <Text style={{ fontSize: 13, fontWeight: '700', color: TT.accent }}>{format === 'video' ? tr.videoSession : format === 'phone' ? tr.phoneSession : tr.inPersonSession}</Text>
            </View>
          </EdCard>

          {/* Cancellation policy */}
          <EdCard style={{ marginTop: 14, padding: 16, flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
            <Info size={16} color={TT.accent} strokeWidth={2} />
            <Text style={{ flex: 1, fontSize: 13.5, color: TT.inkSoft, lineHeight: 21 }}>
              {tr.policyPre}<Text style={{ color: TT.ink, fontWeight: '700' }}>{tr.policyBold}</Text>{tr.policyPost}
            </Text>
          </EdCard>

          {error && <Text style={{ marginTop: 14, fontSize: 13.5, fontWeight: '700', color: '#B4442E', textAlign: 'center' }}>{error}</Text>}
        </FadeIn>
      </ScrollView>

      <View style={{ position: 'absolute', left: 22, right: 22, bottom: 24 }}>
        <EdPill label={busy ? '…' : rescheduleId ? tr.confirmNewTime : tr.confirmBooking} variant="dark" disabled={busy || !start} onPress={confirm} />
      </View>
    </View>
  );
}

function longDate(d: Date, locale: Locale): string {
  const bcp = locale === 'fr' ? 'fr-FR' : 'en-GB';
  return `${d.toLocaleDateString(bcp, { weekday: 'long' })}, ${d.getDate()} ${d.toLocaleDateString(bcp, { month: 'long' })}`;
}
function clock(d: Date): string {
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

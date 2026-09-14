// c4 — Confirm booking. Wired to POST /api/mobile/care/book (server re-validates
// the slot + atomic double-booking guard). `demo=1` (FORCE_CARE_HUB preview) just
// acknowledges without a real write. On success the hub refetches and shows it.
import { useEffect, useRef, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Info, MapPin, Phone, Video } from 'lucide-react-native';
import { notify } from '@/src/ui/alert';
import { EdHeader, EdCard, EdPill, FadeIn } from '@/src/ui/editorial';
import { ONBOARDING_IMAGES } from '@/src/onboarding/editorial/images';
import { useOnboarding } from '@/src/onboarding/context';
import { createBooking, rescheduleSession } from '@/src/api/booking';
import { useI18n, type Locale } from '@/src/i18n';
import { PractitionerAvatar } from '@/src/care/PractitionerAvatar';
import { useSelectedPractitioner } from '@/src/care/selected-practitioner';
import { useTheme } from '@/src/ui/theme-mode';

const T = {
  en: {
    confirmTitle: 'Confirm',
    yourPractitioner: 'your practitioner',
    rescheduledDemo: 'Session rescheduled (demo)',
    confirmedDemo: 'Booking confirmed (demo)',
    noLongerAvailable: 'That time is no longer available. Please pick another.',
    genericError: 'Something went wrong. Please try again.',
    notAllowed: (n: string) => `${n} books sessions for you. Contact them to arrange one.`,
    noPractitioner: 'There is no practitioner to book with any more.',
    tooLate: 'This session is too close to its start to move. Contact your practitioner.',
    withName: (n: string) => `· with ${n}`,
    videoSession: 'Video session',
    phoneSession: 'Phone session',
    inPersonSession: 'In-person session',
    policyChange: (h: number) => `You can move this session up to ${h} hours before it starts. You can always cancel; inside those ${h} hours it counts as a late cancellation.`,
    policyContact: (n: string) => `To change or cancel this session, contact ${n}.`,
    policyApproval: (n: string) => `${n} confirms each booking. You'll get an email once it's confirmed.`,
    requestSentTitle: 'Request sent',
    requestSentBody: (n: string) => `${n} will confirm your session. You'll get an email when they do.`,
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
    notAllowed: (n: string) => `${n} réserve les séances pour vous. Prenez contact pour en planifier une.`,
    noPractitioner: 'Il n’y a plus de praticien avec qui réserver.',
    tooLate: 'Cette séance est trop proche pour être déplacée. Contactez votre praticien.',
    withName: (n: string) => `· avec ${n}`,
    videoSession: 'Séance vidéo',
    phoneSession: 'Séance téléphonique',
    inPersonSession: 'Séance en personne',
    policyChange: (h: number) => `Vous pouvez déplacer cette séance jusqu'à ${h} heures avant son début. Vous pouvez toujours annuler ; dans ces ${h} heures, l'annulation est considérée comme tardive.`,
    policyContact: (n: string) => `Pour modifier ou annuler cette séance, contactez ${n}.`,
    policyApproval: (n: string) => `${n} confirme chaque réservation. Vous recevrez un e-mail une fois la séance confirmée.`,
    requestSentTitle: 'Demande envoyée',
    requestSentBody: (n: string) => `${n} confirmera votre séance. Vous recevrez un e-mail à ce moment-là.`,
    confirmNewTime: 'Confirmer le nouvel horaire',
    confirmBooking: 'Confirmer la réservation',
  },
} as const;

export default function BookConfirm() {
  const { t: TT } = useTheme();
  const router = useRouter();
  const { locale } = useI18n();
  const tr = T[locale];
  const params = useLocalSearchParams<{ slotIso?: string; sessionTypeId?: string; format?: string; durationMinutes?: string; demo?: string; rescheduleId?: string; canChange?: string; noticeHours?: string; approval?: string }>();
  const rescheduleId = typeof params.rescheduleId === 'string' ? params.rescheduleId : '';
  const { practitionerName } = useOnboarding();
  const name = practitionerName ?? tr.yourPractitioner;

  // Everything on this screen (the slot, the type, the practitioner's rules in
  // the params) was chosen for the practitioner selected when booking began.
  // If the selection changes while it is open, confirming would book the time
  // with someone else, so step back to a booking screen that starts over.
  const { selectionKey } = useSelectedPractitioner();
  const openedFor = useRef(selectionKey);
  const routerRef = useRef(router);
  routerRef.current = router;
  useEffect(() => {
    if (openedFor.current === selectionKey) return;
    openedFor.current = selectionKey;
    const r = routerRef.current;
    if (r.canGoBack()) r.back(); else r.navigate('/home' as never);
  }, [selectionKey]);

  const slotIso = typeof params.slotIso === 'string' ? params.slotIso : '';
  const durationMinutes = Number(params.durationMinutes) || 50;
  const format = typeof params.format === 'string' ? params.format : 'video';
  const isDemo = params.demo === '1';
  const insets = useSafeAreaInsets();
  // The practitioner's rules, when the booking screen passed them. Unknown (an
  // older server) says nothing rather than guess a number.
  const noticeHours = Number(params.noticeHours);
  const knowsPolicy = params.canChange === '1' || params.canChange === '0';
  const approval = params.approval === '1';
  const idempotencyKey = useRef(`mb-${Date.now()}-${Math.floor(Math.random() * 1e6)}`).current;

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = slotIso ? new Date(slotIso) : null;
  const end = start ? new Date(start.getTime() + durationMinutes * 60000) : null;

  const alert = (m: string) => notify(m);

  const confirm = async () => {
    if (busy || !start || openedFor.current !== selectionKey) return;
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
      // Waiting on the practitioner is not booked, and the patient should not
      // leave believing it is.
      if ('pending' in res && res.pending) notify(tr.requestSentTitle, tr.requestSentBody(name));
      router.navigate('/home' as never); // hub refetches on focus → change shows
      return;
    }
    setBusy(false);
    if (res.reason === 'conflict' || res.reason === 'unavailable' || res.reason === 'format_unavailable') {
      // A refused format is the same thing to the patient: this choice cannot
      // be booked as shown, so go back and pick again.
      setError(tr.noLongerAvailable);
    } else {
      // Translated by reason; the server's own sentence is English.
      setError(
        res.reason === 'not_allowed' ? tr.notAllowed(name)
        : res.reason === 'no_practitioner' ? tr.noPractitioner
        : res.reason === 'too_late' ? tr.tooLate
        : tr.genericError,
      );
    }
  };

  const kicker = start ? longDate(start, locale) : tr.confirmTitle;

  return (
    <View style={{ flex: 1, backgroundColor: TT.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        <EdHeader kicker={kicker} title={tr.confirmTitle} source={ONBOARDING_IMAGES.final} onBack={() => router.back()} />
        <FadeIn style={{ paddingHorizontal: 22, paddingTop: 20 }}>
          {/* Summary */}
          <EdCard style={{ padding: 24, alignItems: 'center' }}>
            <PractitionerAvatar size={56} name={name} tone="solid" style={{ marginBottom: 16 }} />
            <Text style={{ fontSize: 22, fontWeight: '800', color: TT.ink, letterSpacing: -0.3, textAlign: 'center' }}>{start ? longDate(start, locale) : '—'}</Text>
            <Text style={{ fontSize: 15, color: TT.inkSoft, marginTop: 4, textAlign: 'center' }}>{start && end ? `${clock(start)} – ${clock(end)}` : ''} {tr.withName(name)}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14, backgroundColor: TT.accentTint, borderRadius: 14, paddingVertical: 7, paddingHorizontal: 14 }}>
              {format === 'phone' ? <Phone size={14} color={TT.accent} strokeWidth={2} /> : format === 'in_person' ? <MapPin size={14} color={TT.accent} strokeWidth={2} /> : <Video size={14} color={TT.accent} strokeWidth={2} />}
              <Text style={{ fontSize: 13, fontWeight: '700', color: TT.accent }}>{format === 'video' ? tr.videoSession : format === 'phone' ? tr.phoneSession : tr.inPersonSession}</Text>
            </View>
          </EdCard>

          {/* What happens next, and what the patient can change. From the
              practitioner's own settings: this used to promise "free up to 24
              hours" to everyone, including patients who cannot change anything. */}
          {knowsPolicy && !rescheduleId && (
            <EdCard style={{ marginTop: 14, padding: 16, flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
              <Info size={16} color={TT.accent} strokeWidth={2} />
              <Text style={{ flex: 1, fontSize: 13.5, color: TT.inkSoft, lineHeight: 21 }}>
                {approval ? `${tr.policyApproval(name)} ` : ''}
                {params.canChange === '1' && Number.isFinite(noticeHours) ? tr.policyChange(noticeHours) : tr.policyContact(name)}
              </Text>
            </EdCard>
          )}

          {error && <Text style={{ marginTop: 14, fontSize: 13.5, fontWeight: '700', color: '#B4442E', textAlign: 'center' }}>{error}</Text>}
        </FadeIn>
      </ScrollView>

      {/* Clear of the home indicator and Android's navigation bar (edge-to-edge
          draws under both). A fixed 24 put the button partly beneath them. */}
      <View style={{ position: 'absolute', left: 22, right: 22, bottom: Math.max(24, insets.bottom + 10) }}>
        <EdPill label={busy ? '…' : rescheduleId ? tr.confirmNewTime : tr.confirmBooking} variant="dark" disabled={busy || !start} onPress={confirm} />
      </View>
    </View>
  );
}

function longDate(d: Date, locale: Locale): string {
  const bcp = locale === 'fr' ? 'fr-FR' : 'en-GB';
  // No comma after the weekday in French. See book.tsx.
  const sep = locale === 'fr' ? ' ' : ', ';
  return `${d.toLocaleDateString(bcp, { weekday: 'long' })}${sep}${d.getDate()} ${d.toLocaleDateString(bcp, { month: 'long' })}`;
}
function clock(d: Date): string {
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

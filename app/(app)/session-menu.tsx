// c1b — Session menu bottom sheet. Shows the REAL session (passed in as params)
// and wires reschedule (→ the slot picker in reschedule mode) and cancel (→ POST
// /api/mobile/care/sessions/[id]/cancel). Demo sessions (FORCE_CARE_HUB preview)
// don't hit the backend.
import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, Platform } from 'react-native';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Info } from 'lucide-react-native';
import { notify } from '@/src/ui/alert';
import { EdPill, HEADER_TOP, Kicker } from '@/src/ui/editorial';
import { useOnboarding } from '@/src/onboarding/context';
import { cancelSession } from '@/src/api/booking';
import { ConfirmLayer, useConfirm } from '@/src/ui/confirm';
import { fmt, useI18n, type Locale } from '@/src/i18n';
import { PractitionerAvatar } from '@/src/care/PractitionerAvatar';
import { useSelectedPractitioner } from '@/src/care/selected-practitioner';
import { useTheme } from '@/src/ui/theme-mode';
import { GrowFrame, takeGrowOrigin, type GrowHandle } from '@/src/ui/grow';
import { track } from '@/src/analytics/client';

// Destructive tone for the cancel action, in an editorial-warm register.
const DANGER = '#B04A32';
const DANGER_BORDER = '#E0C4BA';

const T = {
  en: {
    session: 'Session',
    with: 'with',
    startsIn: 'Starts in',
    format: 'Format',
    changesNotice: 'You can move this session up to {hours} hours before it starts. After that you can still cancel, and your practitioner is told.',
    tooLateToMove: 'It is too close to the session to move it. You can still cancel, and your practitioner will be told.',
    reschedule: 'Reschedule session',
    cancel: 'Cancel session',
    contactPractitioner: 'To change or cancel this session, contact your practitioner.',
    yourPractitioner: 'your practitioner',
    cancelledDemo: 'Session cancelled (demo)',
    cancelConfirm: 'Cancel this session?',
    cancelTitle: 'Cancel session',
    cancelBody: 'This will free the slot.',
    keepIt: 'Keep it',
    couldNotCancel: 'Could not cancel. Check your connection and try again.',
    cannotCancelNow: 'This session can no longer be cancelled from the app. Contact your practitioner.',
    today: 'Today',
    tomorrow: 'Tomorrow',
    days: '{n} days',
    videoCall: 'Video call',
    phone: 'Phone',
    inPerson: 'In person',
  },
  fr: {
    session: 'Séance',
    with: 'avec',
    startsIn: 'Commence dans',
    format: 'Format',
    changesNotice: 'Vous pouvez déplacer cette séance jusqu’à {hours} heures avant son début. Ensuite, vous pouvez encore l’annuler, et votre praticien en est informé.',
    tooLateToMove: 'Il est trop tard pour déplacer cette séance. Vous pouvez encore l’annuler, et votre praticien en sera informé.',
    reschedule: 'Reprogrammer la séance',
    cancel: 'Annuler la séance',
    contactPractitioner: 'Pour modifier ou annuler cette séance, contactez votre praticien.',
    yourPractitioner: 'votre praticien',
    cancelledDemo: 'Séance annulée (démo)',
    cancelConfirm: 'Annuler cette séance ?',
    cancelTitle: 'Annuler la séance',
    cancelBody: 'Cela libérera le créneau.',
    keepIt: 'La conserver',
    couldNotCancel: 'Annulation impossible. Vérifiez votre connexion et réessayez.',
    cannotCancelNow: 'Cette séance ne peut plus être annulée depuis l’application. Contactez votre praticien.',
    today: 'Aujourd’hui',
    tomorrow: 'Demain',
    days: '{n} jours',
    videoCall: 'Appel vidéo',
    phone: 'Téléphone',
    inPerson: 'En personne',
  },
} as const;

export default function SessionMenu() {
  const { t: TT } = useTheme();
  const { locale } = useI18n();
  const confirm = useConfirm();
  const tr = T[locale];
  const router = useRouter();
  const p = useLocalSearchParams<{ id?: string; scheduledAt?: string; durationMinutes?: string; sessionFormat?: string; sessionType?: string; meetLink?: string; demo?: string; canCancel?: string; canReschedule?: string; noticeHours?: string }>();
  const { practitionerName } = useOnboarding();
  // "Dr. Maya" was a preview placeholder, and a real patient whose practitioner's
  // name had not loaded read "with Dr. Maya" about their own session.
  const name = practitionerName ?? tr.yourPractitioner;

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
  // TWO BUTTONS, and one of them stops being offered near the session.
  //
  // The practitioner's permission is a single setting now, but the two actions
  // are not the same act and the rule differs: a session inside the notice
  // window can no longer be MOVED, and can still be CANCELLED — it goes through
  // and the practitioner is told it was late. That is enforced server-side
  // (`change-window.ts`); this is only the app agreeing with it, because a
  // button that exists to answer "no" is worse than a button that is not there.
  const hoursAway = start ? (start.getTime() - Date.now()) / 3_600_000 : Infinity;
  const tooLateToMove = hoursAway < noticeHours;
  // Once it has begun there is nothing left to change: the server refuses a
  // cancel from here, and the sheet should not offer one.
  const started = hoursAway <= 0 && !isDemo;
  const showReschedule = canReschedule && !tooLateToMove && !started;
  const showCancel = canCancel && !started;

  const [busy, setBusy] = useState(false);
  const leave = () => (router.canGoBack() ? router.back() : router.navigate('/home' as never));
  // The session card grows into this sheet and closing folds it back (ui/grow).
  // Every way out goes through the fold, including Android's back button.
  const [origin] = useState(takeGrowOrigin);
  const grow = useRef<GrowHandle>(null);
  const closing = useRef(false);
  const close = () => {
    if (closing.current) return;
    closing.current = true;
    if (grow.current) grow.current.close(leave);
    else leave();
  };
  const closeOnBack = useRef(close);
  closeOnBack.current = close;
  useFocusEffect(useCallback(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { closeOnBack.current(); return true; });
    return () => sub.remove();
  }, []));

  // The session and the permissions in the params belong to the practitioner
  // selected when My Care opened this sheet. A switch while it is open (a
  // return to the app can correct a selection) leaves it describing someone
  // else's session with someone else's rules: close it rather than act on that.
  const { selectionKey } = useSelectedPractitioner();
  const openedFor = useRef(selectionKey);
  const stale = openedFor.current !== selectionKey;
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    if (openedFor.current !== selectionKey) closeRef.current();
  }, [selectionKey]);

  const reschedule = () =>
    stale ? undefined : router.navigate({ pathname: '/book', params: { rescheduleId: id, sessionTypeId: p.sessionType ?? '', format, demo: isDemo ? '1' : '' } } as never);

  const doCancel = async () => {
    if (openedFor.current !== selectionKey) return;
    setBusy(true);
    const res = await cancelSession(id);
    setBusy(false);
    if (res.ok) { track('session_cancelled'); close(); return; }
    // In the patient's language, by reason. The server's sentences are English,
    // and one was always present, so the translated message was never shown.
    notify(
      res.reason === 'not_allowed' ? tr.contactPractitioner
      : res.reason === 'started' || res.reason === 'not_active' || res.reason === 'too_late' ? tr.cannotCancelNow
      : tr.couldNotCancel,
    );
  };

  const confirmCancel = async () => {
    if (isDemo) { notify(tr.cancelledDemo); close(); return; }
    if (await confirm({ title: tr.cancelTitle, message: tr.cancelBody, confirmLabel: tr.cancel, cancelLabel: tr.keepIt, destructive: true })) doCancel();
  };

  return (
    <View style={{ flex: 1 }}>
      <GrowFrame ref={grow} origin={origin} kind="sheet" color={TT.sheet} scrim="rgba(20,20,20,0.4)" onScrimPress={close}>
        {/* `sheet`, not `card`: card is rgba(255,255,255,0.055) on dark, so the
            whole My Care page read straight through this sheet. Every other sheet
            in the app already uses `sheet` for exactly this reason. */}
        <SafeAreaView edges={['bottom']} style={{ backgroundColor: TT.sheet, borderTopLeftRadius: 28, borderTopRightRadius: 28 }}>
          <View style={{ paddingHorizontal: 24, paddingTop: HEADER_TOP, paddingBottom: 8 }}>
            <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: TT.line, alignSelf: 'center', marginBottom: 18 }} />

            <Kicker color={TT.faint} style={{ marginBottom: 12 }}>{tr.session}</Kicker>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: TT.line }}>
              <PractitionerAvatar size={46} name={name} tone="solid" />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: TT.ink }}>{start ? `${longDate(start, locale)} · ${clock(start)}` : tr.session}</Text>
                <Text style={{ fontSize: 12.5, color: TT.inkSoft, marginTop: 1 }}>{tr.with} {name} · {duration} min · {fmtFormat(format, tr)}</Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 10, paddingVertical: 16 }}>
              <MiniFact label={tr.startsIn} value={start ? startsIn(start, tr) : '—'} />
              <MiniFact label={tr.format} value={fmtFormat(format, tr)} />
            </View>

            {(showCancel || showReschedule) && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: TT.accentTint, borderRadius: 14, padding: 13, marginBottom: 16 }}>
                <Info size={15} color={TT.accent} strokeWidth={2} />
                <Text style={{ flex: 1, fontSize: 12.5, color: TT.inkSoft, lineHeight: 18 }}>
                  {tooLateToMove ? tr.tooLateToMove : fmt(tr.changesNotice, { hours: noticeHours })}
                </Text>
              </View>
            )}

            {showReschedule && (
              <EdPill label={tr.reschedule} variant="dark" onPress={busy ? undefined : reschedule} disabled={busy} />
            )}
            {showReschedule && showCancel && <View style={{ height: 10 }} />}
            {showCancel && (
              <Pressable onPress={confirmCancel} disabled={busy} style={{ height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', backgroundColor: TT.card, borderWidth: 1.5, borderColor: DANGER_BORDER }}>
                {busy ? <ActivityIndicator color={DANGER} /> : <Text style={{ fontSize: 15.5, fontWeight: '700', color: DANGER }}>{tr.cancel}</Text>}
              </Pressable>
            )}

            {/* Neither allowed: say so, so the sheet is not an empty panel. */}
            {!showCancel && !showReschedule && (
              <Text style={{ fontSize: 12.5, color: TT.inkSoft, textAlign: 'center', lineHeight: 18 }}>
                {tr.contactPractitioner}
              </Text>
            )}
          </View>
        </SafeAreaView>
      </GrowFrame>

      {/* Cancelling did nothing on iOS while working on the web, and this line
          is the whole difference.

          This screen is a route presented as a `transparentModal`, so on iOS it
          is already a presented view controller. The confirm provider answers
          from the ROOT in its own <Modal> — and iOS will not present a second
          modal from a controller that is already presenting one. The dialog
          never appeared, the promise never resolved, and the button looked
          dead. On the web react-native-web falls back to a fixed overlay with a
          huge z-index, which is why nobody saw it there.

          `ConfirmLayer` makes this screen host the dialog inline instead, the
          way MomentDetail and SessionSheet already do. */}
      <ConfirmLayer />
    </View>
  );
}

function MiniFact({ label, value }: { label: string; value: string }) {
  const { t: TT } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: TT.bg, borderWidth: 1, borderColor: TT.line, borderRadius: 14, padding: 12, alignItems: 'center' }}>
      <Kicker color={TT.faint} size={9.5}>{label}</Kicker>
      <Text style={{ fontSize: 14, color: TT.ink, fontWeight: '700', marginTop: 5 }}>{value}</Text>
    </View>
  );
}

const localeTag = (locale: Locale) => (locale === 'fr' ? 'fr-FR' : 'en-US');
// No comma after the weekday in French. See book.tsx.
const longDate = (d: Date, locale: Locale) => `${d.toLocaleDateString(localeTag(locale), { weekday: 'long' })}${locale === 'fr' ? ' ' : ', '}${d.getDate()} ${d.toLocaleDateString(localeTag(locale), { month: 'long' })}`;
const clock = (d: Date) => `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
const fmtFormat = (f: string, tr: (typeof T)[Locale]) => (f === 'video' ? tr.videoCall : f === 'phone' ? tr.phone : f === 'in_person' ? tr.inPerson : f);
function startsIn(d: Date, tr: (typeof T)[Locale]): string {
  const days = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()).getTime()) / 86400000);
  if (days <= 0) return tr.today;
  if (days === 1) return tr.tomorrow;
  return fmt(tr.days, { n: days });
}

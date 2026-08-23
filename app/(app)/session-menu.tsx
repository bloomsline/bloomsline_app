// c1b — Session menu bottom sheet. Shows the REAL session (passed in as params)
// and wires reschedule (→ the slot picker in reschedule mode) and cancel (→ POST
// /api/mobile/care/sessions/[id]/cancel). Demo sessions (FORCE_CARE_HUB preview)
// don't hit the backend.
import { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Info } from 'lucide-react-native';
import { EdPill, Kicker } from '@/src/ui/editorial';
import { useOnboarding } from '@/src/onboarding/context';
import { cancelSession } from '@/src/api/booking';
import { useConfirm } from '@/src/ui/confirm';
import { fmt, useI18n, type Locale } from '@/src/i18n';
import { useTheme } from '@/src/ui/theme-mode';

// Destructive tone for the cancel action, in an editorial-warm register.
const DANGER = '#B04A32';
const DANGER_BORDER = '#E0C4BA';

const T = {
  en: {
    session: 'Session',
    with: 'with',
    startsIn: 'Starts in',
    format: 'Format',
    changesNotice: 'Changes allowed up to {hours} hours before the session.',
    reschedule: 'Reschedule session',
    cancel: 'Cancel session',
    contactPractitioner: 'To change or cancel this session, contact your practitioner.',
    cancelledDemo: 'Session cancelled (demo)',
    cancelConfirm: 'Cancel this session?',
    cancelTitle: 'Cancel session',
    cancelBody: 'This will free the slot.',
    keepIt: 'Keep it',
    couldNotCancel: 'Could not cancel.',
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
    changesNotice: 'Modifications possibles jusqu’à {hours} heures avant la séance.',
    reschedule: 'Reprogrammer la séance',
    cancel: 'Annuler la séance',
    contactPractitioner: 'Pour modifier ou annuler cette séance, contactez votre praticien.',
    cancelledDemo: 'Séance annulée (démo)',
    cancelConfirm: 'Annuler cette séance ?',
    cancelTitle: 'Annuler la séance',
    cancelBody: 'Cela libérera le créneau.',
    keepIt: 'La conserver',
    couldNotCancel: 'Annulation impossible.',
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
    if (Platform.OS === 'web') globalThis.alert?.(res.error ?? tr.couldNotCancel);
  };

  const confirmCancel = async () => {
    if (isDemo) { if (Platform.OS === 'web') globalThis.alert?.(tr.cancelledDemo); close(); return; }
    if (await confirm({ title: tr.cancelTitle, message: tr.cancelBody, confirmLabel: tr.cancel, cancelLabel: tr.keepIt, destructive: true })) doCancel();
  };

  return (
    <View style={{ flex: 1, backgroundColor: 'rgba(20,20,20,0.4)', justifyContent: 'flex-end' }}>
      <Pressable style={{ flex: 1 }} onPress={close} />
      <SafeAreaView edges={['bottom']} style={{ backgroundColor: TT.card, borderTopLeftRadius: 28, borderTopRightRadius: 28 }}>
        <View style={{ paddingHorizontal: 24, paddingTop: 14, paddingBottom: 8 }}>
          <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: TT.line, alignSelf: 'center', marginBottom: 18 }} />

          <Kicker color={TT.faint} style={{ marginBottom: 12 }}>{tr.session}</Kicker>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: TT.line }}>
            <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: TT.accent, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: TT.onAccent, fontWeight: '700', fontSize: 18 }}>{initial}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: TT.ink }}>{start ? `${longDate(start, locale)} · ${clock(start)}` : tr.session}</Text>
              <Text style={{ fontSize: 12.5, color: TT.inkSoft, marginTop: 1 }}>{tr.with} {name} · {duration} min · {fmtFormat(format, tr)}</Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: 10, paddingVertical: 16 }}>
            <MiniFact label={tr.startsIn} value={start ? startsIn(start, tr) : '—'} />
            <MiniFact label={tr.format} value={fmtFormat(format, tr)} />
          </View>

          {(canCancel || canReschedule) && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: TT.accentTint, borderRadius: 14, padding: 13, marginBottom: 16 }}>
              <Info size={15} color={TT.accent} strokeWidth={2} />
              <Text style={{ flex: 1, fontSize: 12.5, color: TT.inkSoft, lineHeight: 18 }}>
                {fmt(tr.changesNotice, { hours: noticeHours })}
              </Text>
            </View>
          )}

          {canReschedule && (
            <EdPill label={tr.reschedule} variant="dark" onPress={busy ? undefined : reschedule} disabled={busy} />
          )}
          {canReschedule && canCancel && <View style={{ height: 10 }} />}
          {canCancel && (
            <Pressable onPress={confirmCancel} disabled={busy} style={{ height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', backgroundColor: TT.card, borderWidth: 1.5, borderColor: DANGER_BORDER }}>
              {busy ? <ActivityIndicator color={DANGER} /> : <Text style={{ fontSize: 15.5, fontWeight: '700', color: DANGER }}>{tr.cancel}</Text>}
            </Pressable>
          )}

          {/* Neither allowed: say so, so the sheet is not an empty panel. */}
          {!canCancel && !canReschedule && (
            <Text style={{ fontSize: 12.5, color: TT.inkSoft, textAlign: 'center', lineHeight: 18 }}>
              {tr.contactPractitioner}
            </Text>
          )}
        </View>
      </SafeAreaView>
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
const longDate = (d: Date, locale: Locale) => `${d.toLocaleDateString(localeTag(locale), { weekday: 'long' })}, ${d.getDate()} ${d.toLocaleDateString(localeTag(locale), { month: 'long' })}`;
const clock = (d: Date) => `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
const fmtFormat = (f: string, tr: (typeof T)[Locale]) => (f === 'video' ? tr.videoCall : f === 'phone' ? tr.phone : f === 'in_person' ? tr.inPerson : f);
function startsIn(d: Date, tr: (typeof T)[Locale]): string {
  const days = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()).getTime()) / 86400000);
  if (days <= 0) return tr.today;
  if (days === 1) return tr.tomorrow;
  return fmt(tr.days, { n: days });
}

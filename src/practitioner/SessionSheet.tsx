import { useState } from 'react';
import { ActivityIndicator, Linking, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  CalendarClock, CheckCircle2, ChevronDown, Mail, MapPin, MoreHorizontal, NotebookPen, Phone,
  Repeat, Send, Trash2, UserX, Video, X, XCircle,
} from 'lucide-react-native';
import { EDA } from '@/src/ui/editorial';
import { useConfirm } from '@/src/ui/confirm';
import { notify } from '@/src/ui/alert';
import { useI18n } from '@/src/i18n';
import { useNoteDraft } from '@/src/notes/draft';
import {
  cancelSession, closeSession, decideRequest, deleteSession, resendSessionDetails, sendPaymentReminder,
  type CloseReasonGroup, type PractitionerSession,
} from '@/src/api/practitioner';
import { useTheme } from '@/src/ui/theme-mode';

// Everything you can do to a session, without leaving the day.
//
// This is the phone's answer to the care app's appointment popover, and it is
// deliberately the SAME set of actions rather than a reduced one. The reason is
// what a practitioner is doing when they reach for a phone instead of a laptop:
// they are between sessions. That is exactly when a session needs closing, a
// patient needs their details resent, or the next hour needs moving — and a
// phone that can only show the day sends them back to a desk to do any of it.
//
// The sheet decides what to OFFER; the server decides what is allowed. Nothing
// here re-implements a lifecycle rule, so a session closed on the phone and one
// closed on the web pass through the same state machine, the same Google mirror
// and the same emails.

const T = {
  en: {
    guest: 'Guest', join: 'Join Google Meet', notes: 'Take notes', resend: 'Resend details', sent: 'Details sent',
    profile: 'Open profile', approve: 'Approve', decline: 'Decline', complete: 'Complete', editOutcome: 'Edit outcome',
    more: 'More actions', noShow: 'No-show', reschedule: 'Reschedule', cancel: 'Cancel session', del: 'Delete',
    remind: 'Remind for payment', reminded: 'Reminder sent',
    guestNote: 'Guest booking. Link it to a patient to manage the session.',
    // close flow
    howWent: 'HOW DID IT GO?', attended: 'Attended', didntHappen: 'Didn’t happen',
    whyNot: 'WHAT HAPPENED?', payment: 'PAYMENT', paid: 'Paid', unpaid: 'Unpaid', free: 'Free',
    noteLabel: 'A NOTE (OPTIONAL)', notePlaceholder: 'What you want to remember.',
    save: 'Save', back: 'Back', pickReason: 'Pick what happened.',
    // cancel flow
    cancelTitle: 'CANCEL THIS SESSION', reasonPlaceholder: 'Reason (optional)',
    thisOne: 'This session', following: 'This & later', whole: 'Whole series',
    deleteTitle: 'Delete this session?', deleteBody: 'This removes it entirely. It can’t be undone.',
    keep: 'Keep', declineTitle: 'Decline this request?', declineBody: 'The patient is told the time is not available.',
    statuses: { pending: 'Pending', scheduled: 'Scheduled', completed: 'Completed', cancelled: 'Cancelled', no_show: 'No-show', waiting: 'Waiting outcome' },
    payments: { paid: 'Paid', unpaid: 'Awaiting payment', free: 'Free' },
    origins: { google: 'Google', booking: 'Online' },
  },
  fr: {
    guest: 'Invité', join: 'Rejoindre Google Meet', notes: 'Prendre des notes', resend: 'Renvoyer les détails', sent: 'Détails envoyés',
    profile: 'Ouvrir le profil', approve: 'Accepter', decline: 'Refuser', complete: 'Terminer', editOutcome: 'Modifier le résultat',
    more: 'Plus d’actions', noShow: 'Absence', reschedule: 'Reprogrammer', cancel: 'Annuler la séance', del: 'Supprimer',
    remind: 'Relancer le paiement', reminded: 'Rappel envoyé',
    guestNote: 'Réservation d’un invité. Associez-la à un patient pour gérer la séance.',
    howWent: 'COMMENT ÇA S’EST PASSÉ ?', attended: 'Présent', didntHappen: 'N’a pas eu lieu',
    whyNot: 'QUE S’EST-IL PASSÉ ?', payment: 'PAIEMENT', paid: 'Payé', unpaid: 'Impayé', free: 'Gratuit',
    noteLabel: 'UNE NOTE (FACULTATIF)', notePlaceholder: 'Ce que vous voulez retenir.',
    save: 'Enregistrer', back: 'Retour', pickReason: 'Choisissez ce qui s’est passé.',
    cancelTitle: 'ANNULER CETTE SÉANCE', reasonPlaceholder: 'Motif (facultatif)',
    thisOne: 'Cette séance', following: 'Celle-ci et les suivantes', whole: 'Toute la série',
    deleteTitle: 'Supprimer cette séance ?', deleteBody: 'Elle sera entièrement retirée. Action irréversible.',
    keep: 'Conserver', declineTitle: 'Refuser cette demande ?', declineBody: 'Le patient est informé que le créneau n’est pas disponible.',
    statuses: { pending: 'En attente', scheduled: 'Planifiée', completed: 'Terminée', cancelled: 'Annulée', no_show: 'Absence', waiting: 'À clôturer' },
    payments: { paid: 'Payé', unpaid: 'En attente de paiement', free: 'Gratuit' },
    origins: { google: 'Google', booking: 'En ligne' },
  },
} as const;

const FORMAT_ICON = { video: Video, in_person: MapPin, phone: Phone } as const;

// Pill colours mirror the care app's popover so the two surfaces read as one
// product — a practitioner moving between laptop and phone should not have to
// relearn what amber means.
const TONE = {
  amber: { bg: '#FEF3C7', fg: '#B45309' },
  blue: { bg: '#DBEAFE', fg: '#1D4ED8' },
  green: { bg: EDA.greenTint, fg: EDA.greenDeep },
  rose: { bg: '#FFE4E6', fg: '#BE123C' },
  grey: { bg: '#F1F0EC', fg: '#6B6B63' },
} as const;

const STATUS_TONE: Record<string, keyof typeof TONE> = {
  pending: 'amber', scheduled: 'blue', completed: 'green', cancelled: 'rose', no_show: 'grey',
};
const PAYMENT_TONE: Record<string, keyof typeof TONE> = { paid: 'green', unpaid: 'amber', free: 'grey' };

function Pill({ label, tone }: { label: string; tone: keyof typeof TONE }) {
  const c = TONE[tone];
  return (
    <View style={{ borderRadius: 11, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: c.bg }}>
      <Text style={{ fontSize: 11, fontWeight: '800', color: c.fg }}>{label}</Text>
    </View>
  );
}

function Label({ children }: { children: string }) {
  const { t: TT } = useTheme();
  return <Text style={{ fontSize: 10.5, fontWeight: '800', letterSpacing: 1, color: TT.faint, marginBottom: 8 }}>{children}</Text>;
}

/** Outlined action, the sheet's secondary button. */
function Outline({ Icon, label, onPress, disabled, tone }: { Icon: typeof Video; label: string; onPress: () => void; disabled?: boolean; tone?: 'rose' }) {
  const { t: TT } = useTheme();
  const fg = tone === 'rose' ? '#BE123C' : TT.inkSoft;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 20, borderWidth: 1, borderColor: TT.line, backgroundColor: TT.card, paddingHorizontal: 14, paddingVertical: 9, opacity: disabled ? 0.5 : 1 }}
    >
      <Icon size={15} color={fg} />
      <Text style={{ fontSize: 13.5, fontWeight: '700', color: fg }}>{label}</Text>
    </Pressable>
  );
}

/** One row of the "More actions" list. */
function MenuRow({ Icon, label, onPress, danger }: { Icon: typeof Video; label: string; onPress: () => void; danger?: boolean }) {
  const { t: TT } = useTheme();
  const fg = danger ? '#BE123C' : TT.inkSoft;
  return (
    <Pressable onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 12 }}>
      <Icon size={16} color={fg} />
      <Text style={{ fontSize: 14.5, fontWeight: '600', color: fg }}>{label}</Text>
    </Pressable>
  );
}

/** A choice chip — used for outcome, payment and no-show reason. */
function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  const { t: TT } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={{ borderRadius: 18, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: on ? TT.accentTint : TT.card, borderWidth: 1.5, borderColor: on ? TT.accent : TT.line }}
    >
      <Text style={{ fontSize: 13.5, fontWeight: '700', color: on ? TT.accentDeep : TT.inkSoft }}>{label}</Text>
    </Pressable>
  );
}

export function SessionSheet({
  session, timezone, currency = 'EUR', closeReasons = [], hasPaymentLink = false, onClose, onChanged,
}: {
  session: PractitionerSession | null;
  timezone?: string;
  currency?: string;
  closeReasons?: CloseReasonGroup[];
  /** Whether this session's TYPE carries a pay link — no link, no reminder to send. */
  hasPaymentLink?: boolean;
  onClose: () => void;
  /** Something changed on the server: the day needs refetching. */
  onChanged: () => void;
}) {
  const { t: TT } = useTheme();
  const router = useRouter();
  const { locale } = useI18n();
  const tr = T[locale] ?? T.en;
  const confirm = useConfirm();
  const { open: openNote } = useNoteDraft();

  const [mode, setMode] = useState<'view' | 'close' | 'cancel'>('view');
  const [showMenu, setShowMenu] = useState(false);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState('');

  // close-flow state
  const [outcome, setOutcome] = useState<'completed' | 'no_show'>('completed');
  const [reason, setReason] = useState('');
  const [payment, setPayment] = useState('unpaid');
  const [summary, setSummary] = useState('');
  // cancel-flow state
  const [cancelReason, setCancelReason] = useState('');

  if (!session) return null;
  const s = session;

  const zone = timezone ? { timeZone: timezone } : {};
  const loc = locale === 'fr' ? 'fr-FR' : 'en-GB';
  const start = new Date(s.scheduledAt);
  const end = new Date(start.getTime() + s.durationMinutes * 60_000);
  const hhmm = (d: Date) => new Intl.DateTimeFormat(loc, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', ...zone }).format(d);
  const dayLabel = new Intl.DateTimeFormat(loc, { weekday: 'short', day: 'numeric', month: 'short', ...zone }).format(start);

  const price = s.priceCents == null
    ? null
    : (() => {
      try { return new Intl.NumberFormat(loc, { style: 'currency', currency, maximumFractionDigits: 2 }).format(s.priceCents / 100); }
      catch { return `${(s.priceCents / 100).toFixed(2)} ${currency}`; }
    })();

  const status = s.status ?? 'scheduled';
  const isPending = status === 'pending';
  const isActive = status === 'pending' || status === 'scheduled';
  // A scheduled session whose end has passed still needs closing, and saying
  // "Scheduled" about something that already finished is just wrong.
  const isWaiting = status === 'scheduled' && end.getTime() <= Date.now();
  const statusLabel = isWaiting ? tr.statuses.waiting : (tr.statuses[status as keyof typeof tr.statuses] ?? status);
  const statusTone = isWaiting ? 'amber' : (STATUS_TONE[status] ?? 'blue');
  const canManage = !s.isGuest && Boolean(s.memberId);
  const canRemind = s.paymentStatus === 'unpaid' && hasPaymentLink;

  const reset = () => { setMode('view'); setShowMenu(false); setReason(''); setSummary(''); setCancelReason(''); setOutcome('completed'); setPayment('unpaid'); };
  const done = () => { reset(); onChanged(); onClose(); };

  /** Run an action, surface its error, refresh on success. */
  const run = async (fn: () => Promise<{ ok: boolean; error?: string }>, opts?: { keepOpen?: boolean; flash?: string }) => {
    if (busy) return;
    setBusy(true);
    const res = await fn();
    setBusy(false);
    if (!res.ok) { notify(tr.statuses.pending, res.error ?? 'Something went wrong.'); return; }
    if (opts?.keepOpen) {
      // A resend or a reminder does not change the day — confirm it in place
      // rather than closing the sheet out from under the practitioner.
      setFlash(opts.flash ?? '');
      setTimeout(() => setFlash(''), 2500);
      onChanged();
      return;
    }
    done();
  };

  const saveClose = () => {
    if (outcome === 'no_show' && !reason) { notify(tr.whyNot, tr.pickReason); return; }
    void run(() => closeSession(s.id, { outcome, paymentStatus: payment, summary: summary.trim() || undefined, reason: reason || undefined }));
  };

  const doCancel = (scope: 'this' | 'following' | 'all') =>
    void run(() => cancelSession(s.id, { scope, reason: cancelReason.trim() || undefined }));

  const doDelete = async () => {
    if (!(await confirm({ title: tr.deleteTitle, message: tr.deleteBody, confirmLabel: tr.del, cancelLabel: tr.keep, destructive: true }))) return;
    void run(() => deleteSession(s.id));
  };

  const doDecline = async () => {
    if (!(await confirm({ title: tr.declineTitle, message: tr.declineBody, confirmLabel: tr.decline, cancelLabel: tr.keep, destructive: true }))) return;
    void run(() => decideRequest(s.id, 'decline'));
  };

  const goReschedule = () => {
    reset();
    onClose();
    router.navigate({
      pathname: '/(practitioner)/book',
      params: {
        rescheduleId: s.id, name: s.who, duration: String(s.durationMinutes),
        format: s.sessionFormat, sessionType: s.sessionType,
        initialDate: new Intl.DateTimeFormat('en-CA', { ...zone }).format(start),
      },
    } as never);
  };

  const goNote = () => {
    if (!s.memberId) return;
    reset();
    onClose();
    openNote({ appointmentId: s.id, memberId: s.memberId, who: s.who, when: `${dayLabel} · ${hhmm(start)}`, title: '', text: '', ranges: [], noteType: 'session' });
    router.navigate('/(practitioner)/note' as never);
  };

  const Icon = FORMAT_ICON[s.sessionFormat as keyof typeof FORMAT_ICON] ?? MapPin;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={() => { reset(); onClose(); }}>
      <Pressable style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(20,20,18,0.45)' }} onPress={() => { reset(); onClose(); }}>
        <Pressable onPress={() => {}} style={{ maxHeight: '88%', borderTopLeftRadius: 26, borderTopRightRadius: 26, backgroundColor: TT.card }}>
          <View style={{ alignItems: 'center', paddingTop: 10 }}>
            <View style={{ height: 4, width: 40, borderRadius: 2, backgroundColor: TT.line }} />
          </View>

          <ScrollView contentContainerStyle={{ paddingHorizontal: 22, paddingTop: 16, paddingBottom: 30 }} showsVerticalScrollIndicator={false}>
            {/* header */}
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
              <View style={{ height: 36, width: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: TT.bg }}>
                <Icon size={17} color={TT.inkSoft} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 7 }}>
                  <Text numberOfLines={1} style={{ fontSize: 17.5, fontWeight: '800', color: TT.ink, letterSpacing: -0.2 }}>{s.who}</Text>
                  {s.isGuest && <Pill label={tr.guest} tone="grey" />}
                  <Pill label={statusLabel} tone={statusTone} />
                </View>
                <Text style={{ fontSize: 13.5, color: TT.inkSoft, marginTop: 3 }}>{dayLabel} · {hhmm(start)}–{hhmm(end)}</Text>
              </View>
              <Pressable onPress={() => { reset(); onClose(); }} hitSlop={8} style={{ height: 30, width: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: TT.bg }}>
                <X size={16} color={TT.inkSoft} />
              </Pressable>
            </View>

            {mode === 'view' && (
              <>
                {/* facts */}
                <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 7, marginTop: 16 }}>
                  <Text style={{ fontSize: 13.5, color: TT.inkSoft }}>
                    {s.sessionType} · {s.sessionFormat.replace('_', ' ')} · {s.durationMinutes}m{price ? ` · ${price}` : ''}
                  </Text>
                  {s.paymentStatus && <Pill label={tr.payments[s.paymentStatus as keyof typeof tr.payments] ?? s.paymentStatus} tone={PAYMENT_TONE[s.paymentStatus] ?? 'grey'} />}
                  {s.source && tr.origins[s.source as keyof typeof tr.origins] && <Pill label={tr.origins[s.source as keyof typeof tr.origins]} tone="grey" />}
                  {s.seriesTotal ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 11, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: TONE.grey.bg }}>
                      <Repeat size={11} color={TONE.grey.fg} />
                      <Text style={{ fontSize: 11, fontWeight: '800', color: TONE.grey.fg }}>{s.seriesPosition}/{s.seriesTotal}</Text>
                    </View>
                  ) : null}
                </View>

                {s.location ? <Text style={{ fontSize: 13.5, color: TT.inkSoft, marginTop: 7 }}>{s.location}</Text> : null}
                {s.email ? (
                  <Pressable onPress={() => { void Linking.openURL(`mailto:${s.email}`); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 9 }}>
                    <Mail size={14} color={TT.faint} />
                    <Text numberOfLines={1} style={{ flex: 1, fontSize: 13.5, color: TT.inkSoft }}>{s.email}</Text>
                  </Pressable>
                ) : null}

                {flash ? <Text style={{ fontSize: 13, fontWeight: '700', color: TT.accent, marginTop: 12 }}>{flash}</Text> : null}

                {/* primary actions */}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginTop: 18 }}>
                  {s.meetLink ? (
                    <Pressable
                      onPress={() => { void Linking.openURL(s.meetLink as string); }}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 20, backgroundColor: TT.accent, paddingHorizontal: 16, paddingVertical: 10 }}
                    >
                      <Video size={15} color="#fff" />
                      <Text style={{ fontSize: 13.5, fontWeight: '800', color: '#fff' }}>{tr.join}</Text>
                    </Pressable>
                  ) : null}
                  {canManage && isActive && <Outline Icon={NotebookPen} label={tr.notes} onPress={goNote} />}
                  {!isPending && isActive && (
                    <Outline Icon={Send} label={tr.resend} disabled={busy} onPress={() => void run(resendSessionDetails.bind(null, s.id), { keepOpen: true, flash: tr.sent })} />
                  )}
                </View>

                {/* a request waiting on a yes or no */}
                {isPending && (
                  <View style={{ flexDirection: 'row', gap: 9, marginTop: 16, borderTopWidth: 1, borderTopColor: TT.line, paddingTop: 16 }}>
                    <Pressable
                      onPress={() => void run(() => decideRequest(s.id, 'approve'))}
                      disabled={busy}
                      style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 22, backgroundColor: TT.accent, paddingVertical: 12, opacity: busy ? 0.6 : 1 }}
                    >
                      <CheckCircle2 size={16} color="#fff" />
                      <Text style={{ fontSize: 14, fontWeight: '800', color: '#fff' }}>{tr.approve}</Text>
                    </Pressable>
                    <Pressable
                      onPress={doDecline}
                      disabled={busy}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 22, borderWidth: 1, borderColor: TT.line, paddingHorizontal: 18, paddingVertical: 12 }}
                    >
                      <XCircle size={16} color="#BE123C" />
                      <Text style={{ fontSize: 14, fontWeight: '800', color: '#BE123C' }}>{tr.decline}</Text>
                    </Pressable>
                  </View>
                )}

                {/* close it out / edit what was recorded */}
                {!isPending && canManage && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 16, borderTopWidth: 1, borderTopColor: TT.line, paddingTop: 16 }}>
                    <Pressable
                      onPress={() => {
                        // Editing a recorded outcome opens on what was recorded,
                        // not on a blank form — otherwise "edit" quietly means
                        // "re-enter everything and hope you remember".
                        setOutcome(status === 'completed' || isActive ? 'completed' : 'no_show');
                        setPayment(s.paymentStatus ?? 'unpaid');
                        setReason(s.cancellationReason ?? '');
                        setMode('close');
                      }}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 20, backgroundColor: TT.accentTint, paddingHorizontal: 16, paddingVertical: 10 }}
                    >
                      <CheckCircle2 size={15} color={TT.accentDeep} />
                      <Text style={{ fontSize: 13.5, fontWeight: '800', color: TT.accentDeep }}>{isActive ? tr.complete : tr.editOutcome}</Text>
                    </Pressable>
                    <View style={{ flex: 1 }} />
                    <Pressable onPress={() => setShowMenu((v) => !v)} hitSlop={8} style={{ height: 34, width: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: TT.bg }} accessibilityLabel={tr.more}>
                      <MoreHorizontal size={17} color={TT.inkSoft} />
                    </Pressable>
                  </View>
                )}

                {showMenu && (
                  <View style={{ marginTop: 6, borderTopWidth: 1, borderTopColor: TT.line, paddingTop: 4 }}>
                    {canRemind && <MenuRow Icon={Mail} label={tr.remind} onPress={() => { setShowMenu(false); void run(sendPaymentReminder.bind(null, s.id), { keepOpen: true, flash: tr.reminded }); }} />}
                    {canManage && isActive && (
                      <>
                        <MenuRow Icon={UserX} label={tr.noShow} onPress={() => { setShowMenu(false); setOutcome('no_show'); setPayment(s.paymentStatus ?? 'unpaid'); setMode('close'); }} />
                        <MenuRow Icon={CalendarClock} label={tr.reschedule} onPress={goReschedule} />
                        <MenuRow Icon={XCircle} label={tr.cancel} onPress={() => { setShowMenu(false); setMode('cancel'); }} danger />
                      </>
                    )}
                    <MenuRow Icon={Trash2} label={tr.del} onPress={() => { setShowMenu(false); void doDelete(); }} danger />
                  </View>
                )}

                {s.isGuest && (
                  <Text style={{ fontSize: 12, color: TT.faint, marginTop: 16, lineHeight: 18 }}>{tr.guestNote}</Text>
                )}
              </>
            )}

            {/* ---- close flow ---- */}
            {mode === 'close' && (
              <View style={{ marginTop: 20 }}>
                <Label>{tr.howWent}</Label>
                <View style={{ flexDirection: 'row', gap: 9, marginBottom: 20 }}>
                  <Chip label={tr.attended} on={outcome === 'completed'} onPress={() => { setOutcome('completed'); setReason(''); }} />
                  <Chip label={tr.didntHappen} on={outcome === 'no_show'} onPress={() => setOutcome('no_show')} />
                </View>

                {outcome === 'no_show' && (
                  <>
                    <Label>{tr.whyNot}</Label>
                    {closeReasons.map((g) => (
                      <View key={g.label} style={{ marginBottom: 14 }}>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: TT.faint, marginBottom: 7 }}>{g.label}</Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                          {g.options.map(([slug, label]) => (
                            <Chip key={slug} label={label} on={reason === slug} onPress={() => setReason(slug)} />
                          ))}
                        </View>
                      </View>
                    ))}
                    <View style={{ height: 6 }} />
                  </>
                )}

                <Label>{tr.payment}</Label>
                <View style={{ flexDirection: 'row', gap: 9, marginBottom: 20 }}>
                  <Chip label={tr.paid} on={payment === 'paid'} onPress={() => setPayment('paid')} />
                  <Chip label={tr.unpaid} on={payment === 'unpaid'} onPress={() => setPayment('unpaid')} />
                  <Chip label={tr.free} on={payment === 'free'} onPress={() => setPayment('free')} />
                </View>

                <Label>{tr.noteLabel}</Label>
                <TextInput
                  value={summary}
                  onChangeText={setSummary}
                  placeholder={tr.notePlaceholder}
                  placeholderTextColor={TT.faint}
                  multiline
                  style={{ minHeight: 90, borderRadius: 16, borderWidth: 1.5, borderColor: TT.line, backgroundColor: TT.bg, padding: 13, fontSize: 14.5, color: TT.ink, textAlignVertical: 'top' }}
                />

                <View style={{ flexDirection: 'row', gap: 9, marginTop: 20 }}>
                  <Outline Icon={ChevronDown} label={tr.back} onPress={() => setMode('view')} />
                  <Pressable
                    onPress={saveClose}
                    disabled={busy}
                    style={{ flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: TT.accent, paddingVertical: 13, opacity: busy ? 0.6 : 1 }}
                  >
                    {busy ? <ActivityIndicator color="#fff" /> : <Text style={{ fontSize: 14.5, fontWeight: '800', color: '#fff' }}>{tr.save}</Text>}
                  </Pressable>
                </View>
              </View>
            )}

            {/* ---- cancel flow ---- */}
            {mode === 'cancel' && (
              <View style={{ marginTop: 20 }}>
                <Label>{tr.cancelTitle}</Label>
                <TextInput
                  value={cancelReason}
                  onChangeText={setCancelReason}
                  placeholder={tr.reasonPlaceholder}
                  placeholderTextColor={TT.faint}
                  style={{ height: 48, borderRadius: 16, borderWidth: 1.5, borderColor: TT.line, backgroundColor: TT.bg, paddingHorizontal: 13, fontSize: 14.5, color: TT.ink }}
                />

                {/* A recurring session has three genuinely different answers, so
                    all three are offered rather than one being guessed at. */}
                <View style={{ gap: 9, marginTop: 18 }}>
                  <Pressable onPress={() => doCancel('this')} disabled={busy} style={{ alignItems: 'center', borderRadius: 22, backgroundColor: '#DC2626', paddingVertical: 13, opacity: busy ? 0.6 : 1 }}>
                    <Text style={{ fontSize: 14.5, fontWeight: '800', color: '#fff' }}>{tr.thisOne}</Text>
                  </Pressable>
                  {s.seriesId ? (
                    <>
                      <Pressable onPress={() => doCancel('following')} disabled={busy} style={{ alignItems: 'center', borderRadius: 22, borderWidth: 1.5, borderColor: '#DC2626', paddingVertical: 12, opacity: busy ? 0.6 : 1 }}>
                        <Text style={{ fontSize: 14.5, fontWeight: '800', color: '#DC2626' }}>{tr.following}</Text>
                      </Pressable>
                      <Pressable onPress={() => doCancel('all')} disabled={busy} style={{ alignItems: 'center', borderRadius: 22, borderWidth: 1.5, borderColor: '#DC2626', paddingVertical: 12, opacity: busy ? 0.6 : 1 }}>
                        <Text style={{ fontSize: 14.5, fontWeight: '800', color: '#DC2626' }}>{tr.whole}</Text>
                      </Pressable>
                    </>
                  ) : null}
                  <Outline Icon={ChevronDown} label={tr.back} onPress={() => setMode('view')} />
                </View>
              </View>
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

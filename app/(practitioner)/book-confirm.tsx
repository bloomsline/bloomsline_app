import { useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Check, Info, MapPin, Phone, Video } from 'lucide-react-native';
import { EDA, EdHeader, EdCard, EdPill, FadeIn } from '@/src/ui/editorial';
import { useI18n } from '@/src/i18n';
import { bookSession } from '@/src/api/practitioner';

// Confirm the booking — the practitioner's counterpart to the patient's
// book-confirm screen, and deliberately the same shape.
//
// Before this, picking a time booked it silently and dropped you back on the
// home screen: no confirmation, no evidence anything had happened. Booking
// writes into somebody else's calendar and sends them an email, so it earns a
// step that says what is about to happen and then says it did.
const T = {
  en: {
    kicker: 'CONFIRM', title: 'Confirm booking', confirm: 'Confirm booking',
    taken: 'That time is no longer free. Please pick another.',
    generic: 'Something went wrong. Please try again.',
    note: 'They will get a confirmation email, and it will appear in your calendar.',
    done: 'Booked', doneBody: 'is in your calendar and they have been told.', back: 'Done',
    video: 'Video session', phone: 'Phone session', in_person: 'In-person session',
  },
  fr: {
    kicker: 'CONFIRMER', title: 'Confirmer la réservation', confirm: 'Confirmer',
    taken: 'Ce créneau n’est plus libre. Veuillez en choisir un autre.',
    generic: 'Une erreur s’est produite. Veuillez réessayer.',
    note: 'La personne recevra un e-mail de confirmation, et la séance apparaîtra dans votre agenda.',
    done: 'Réservé', doneBody: 'est dans votre agenda et la personne a été prévenue.', back: 'Terminé',
    video: 'Séance vidéo', phone: 'Séance téléphonique', in_person: 'Séance en personne',
  },
} as const;

const FORMAT_ICON = { video: Video, in_person: MapPin, phone: Phone } as const;

export default function BookConfirm() {
  const router = useRouter();
  const { locale } = useI18n();
  const tr = T[locale] ?? T.en;
  const p = useLocalSearchParams<{
    memberId?: string; name?: string; sessionTypeId?: string; label?: string;
    scheduledAt?: string; format?: string; duration?: string;
  }>();

  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const iso = typeof p.scheduledAt === 'string' ? p.scheduledAt : '';
  const format = typeof p.format === 'string' ? p.format : 'video';
  const duration = Number(p.duration ?? '60') || 60;
  const Icon = FORMAT_ICON[format as keyof typeof FORMAT_ICON] ?? MapPin;

  const when = iso
    ? new Date(iso).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
    : '';
  const time = iso ? new Date(iso).toLocaleTimeString(locale === 'fr' ? 'fr-FR' : 'en-GB', { hour: '2-digit', minute: '2-digit' }) : '';

  const confirm = async () => {
    if (!p.memberId || !iso) return;
    setError(''); setSaving(true);
    const res = await bookSession({
      memberId: p.memberId, sessionTypeId: typeof p.sessionTypeId === 'string' ? p.sessionTypeId : '',
      scheduledAt: iso, sessionFormat: format, durationMinutes: duration,
    });
    setSaving(false);
    // A 409 is the one a practitioner will actually hit, and it means the day
    // moved under them — say exactly that rather than "something went wrong".
    if (!res.ok) { setError(res.error ?? tr.generic); return; }
    setDone(true);
  };

  const finish = () => router.navigate('/(practitioner)/home' as never);

  return (
    <View style={{ flex: 1, backgroundColor: EDA.canvas }}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        <EdHeader kicker={tr.kicker} title={done ? tr.done : tr.title} onBack={done ? undefined : () => router.back()} />

        <FadeIn style={{ paddingHorizontal: 22, paddingTop: 20 }}>
          <EdCard style={{ marginBottom: 18 }}>
            <Text style={{ fontSize: 20, fontWeight: '800', color: EDA.ink, letterSpacing: -0.4 }}>{p.name ?? ''}</Text>
            <Text style={{ fontSize: 15, color: EDA.ink, marginTop: 8, textTransform: 'capitalize' }}>{when}</Text>
            <Text style={{ fontSize: 15, fontWeight: '700', color: EDA.green, marginTop: 2 }}>{time} · {duration} min</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 }}>
              <Icon size={14} color={EDA.faint} />
              <Text style={{ fontSize: 13.5, color: EDA.inkSoft }}>
                {tr[format as 'video' | 'phone' | 'in_person'] ?? format}{p.label ? ` · ${p.label}` : ''}
              </Text>
            </View>
          </EdCard>

          {done ? (
            <>
              <EdCard style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: EDA.greenTint, borderColor: EDA.green }}>
                <Check size={18} color={EDA.green} strokeWidth={3} />
                <Text style={{ flex: 1, fontSize: 14.5, color: EDA.greenDeep, lineHeight: 21 }}>
                  {p.name} — {tr.doneBody}
                </Text>
              </EdCard>
              <EdPill label={tr.back} onPress={finish} style={{ marginTop: 22 }} />
            </>
          ) : (
            <>
              <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginBottom: 22 }}>
                <Info size={15} color={EDA.faint} style={{ marginTop: 2 }} />
                <Text style={{ flex: 1, fontSize: 13, color: EDA.inkSoft, lineHeight: 19 }}>{tr.note}</Text>
              </View>
              <EdPill label={saving ? '…' : tr.confirm} onPress={confirm} disabled={saving} />
              {saving && <ActivityIndicator style={{ marginTop: 12 }} />}
              {error ? <Text style={{ fontSize: 13.5, color: '#C0392B', marginTop: 12 }}>{error}</Text> : null}
            </>
          )}
        </FadeIn>
      </ScrollView>
    </View>
  );
}

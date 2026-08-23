// Session history — the patient's past sessions. Wired to GET /api/mobile/care/history.
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { EdHeader, Kicker, FadeIn } from '@/src/ui/editorial';
import { ONBOARDING_IMAGES } from '@/src/onboarding/editorial/images';
import { fetchHistory, type CareSession } from '@/src/api/care';
import { useI18n, type Locale } from '@/src/i18n';
import { useTheme } from '@/src/ui/theme-mode';
import { LIGHT, DARK, type Mode } from '@/src/ui/tokens';

const T = {
  en: {
    title: 'Session history',
    emptyTitle: 'No past sessions yet',
    emptyBody: 'Your completed sessions will appear here.',
    attended: 'Attended',
    past: 'Past',
    cancelled: 'Cancelled',
    missed: 'Missed',
    video: 'Video',
    phone: 'Phone',
    inPerson: 'In person',
  },
  fr: {
    title: 'Historique des séances',
    emptyTitle: 'Pas encore de séances passées',
    emptyBody: 'Vos séances terminées apparaîtront ici.',
    attended: 'Présent',
    past: 'Passée',
    cancelled: 'Annulée',
    missed: 'Manquée',
    video: 'Vidéo',
    phone: 'Téléphone',
    inPerson: 'En personne',
  },
} as const;

// Badge colors per status, in editorial tones; the label comes from the active
// dictionary. Green = attended, warm neutral = past, muted clay = cancelled/missed.
type StatusStyle = { labelKey: 'attended' | 'past' | 'cancelled' | 'missed'; color: string; bg: string };
const STATUS_STYLE: Record<Mode, Record<string, StatusStyle>> = {
  light: {
    completed: { labelKey: 'attended', color: LIGHT.accentDeep, bg: LIGHT.accentTint },
    scheduled: { labelKey: 'past', color: LIGHT.inkSoft, bg: '#EDEBE3' },
    pending: { labelKey: 'past', color: LIGHT.inkSoft, bg: '#EDEBE3' },
    cancelled: { labelKey: 'cancelled', color: '#9A6A54', bg: '#F1E8E1' },
    no_show: { labelKey: 'missed', color: '#B07A4E', bg: '#F1E8E1' },
  },
  dark: {
    completed: { labelKey: 'attended', color: DARK.accent, bg: DARK.accentTint },
    scheduled: { labelKey: 'past', color: DARK.inkSoft, bg: 'rgba(255,255,255,0.07)' },
    pending: { labelKey: 'past', color: DARK.inkSoft, bg: 'rgba(255,255,255,0.07)' },
    cancelled: { labelKey: 'cancelled', color: '#D8A88F', bg: 'rgba(216,168,143,0.16)' },
    no_show: { labelKey: 'missed', color: '#DCA878', bg: 'rgba(220,168,120,0.16)' },
  },
};

export default function SessionHistory() {
  const { t: TT, mode } = useTheme();
  const { locale } = useI18n();
  const tr = T[locale];
  const router = useRouter();
  const [items, setItems] = useState<CareSession[] | null>(null);
  useEffect(() => {
    let alive = true;
    fetchHistory().then((s) => { if (alive) setItems(s ?? []); });
    return () => { alive = false; };
  }, []);

  const back = () => (router.canGoBack() ? router.back() : router.navigate('/home' as never));

  return (
    <View style={{ flex: 1, backgroundColor: TT.bg }}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        <EdHeader source={ONBOARDING_IMAGES.final} kicker="Session history" title={tr.title} onBack={back} />
        <FadeIn style={{ paddingHorizontal: 22, paddingTop: 20 }}>
          {items === null ? (
            <View style={{ paddingTop: 40, alignItems: 'center' }}><ActivityIndicator color={TT.accent} /></View>
          ) : items.length === 0 ? (
            <View style={{ backgroundColor: TT.card, borderWidth: 1, borderColor: TT.line, borderRadius: 20, padding: 24, alignItems: 'center', marginTop: 4 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: TT.ink }}>{tr.emptyTitle}</Text>
              <Text style={{ fontSize: 13, color: TT.inkSoft, marginTop: 6, textAlign: 'center', lineHeight: 19 }}>{tr.emptyBody}</Text>
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              {items.map((s) => {
                const st = STATUS_STYLE[mode][s.status] ?? STATUS_STYLE[mode].scheduled;
                return (
                  <View key={s.id} style={{ backgroundColor: TT.card, borderWidth: 1, borderColor: TT.line, borderRadius: 18, padding: 15, paddingRight: 14, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                    <View style={{ width: 46, alignItems: 'center' }}>
                      <Kicker color={TT.accent} size={9.5}>{monthShort(s.scheduledAt, locale)}</Kicker>
                      <Text style={{ fontSize: 20, fontWeight: '800', color: TT.ink, lineHeight: 24 }}>{dayNum(s.scheduledAt)}</Text>
                    </View>
                    <View style={{ width: 1, height: 32, backgroundColor: TT.line }} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: TT.ink }}>{clock(s.scheduledAt)} · {fmtFormat(s.sessionFormat, tr)}</Text>
                      <Text style={{ fontSize: 12, color: TT.inkSoft, marginTop: 1 }}>{s.durationMinutes} min</Text>
                    </View>
                    <View style={{ backgroundColor: st.bg, borderRadius: 11, paddingVertical: 4, paddingHorizontal: 10 }}>
                      <Text style={{ fontSize: 11.5, fontWeight: '700', color: st.color }}>{tr[st.labelKey]}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </FadeIn>
      </ScrollView>
    </View>
  );
}

const monthShort = (iso: string, locale: Locale) => new Date(iso).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US', { month: 'short' });
const dayNum = (iso: string) => String(new Date(iso).getDate());
const clock = (iso: string) => { const d = new Date(iso); return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`; };
const fmtFormat = (f: string, tr: (typeof T)[Locale]) => (f === 'video' ? tr.video : f === 'phone' ? tr.phone : f === 'in_person' ? tr.inPerson : f);

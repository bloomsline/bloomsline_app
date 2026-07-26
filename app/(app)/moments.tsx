// Moments home — ported from the v1 app (app/(main)/home.tsx), stripped of the
// v1-only machinery (walkthrough, welcome guide, Bloom, Supabase, i18n) and
// wired to the v2 REST API. Greeting → DayNav → Emotional Flow (or the animated
// empty card) → quick-action cards. The v2 API is keyset-only, so we fetch the
// recent window and filter to the selected day on the client.
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect, useRouter } from 'expo-router';
import { CloudRain, Heart, Lightbulb, PenLine, Settings, Sun } from 'lucide-react-native';
import { TabBar } from '@/src/ui/TabBar';
import { TabIntro } from '@/src/ui/TabIntro';
import { EmotionalTimeline } from '@/src/moments/EmotionalTimeline';
import { MomentDetail } from '@/src/moments/MomentDetail';
import { DayNav, getToday, isSameDay } from '@/src/moments/DayNav';
import { EDA, EdHeader, EdCard, FadeIn, MonoLabel } from '@/src/ui/editorial';
import { ONBOARDING_IMAGES } from '@/src/onboarding/editorial/images';
import { useLanding } from '@/src/prefs/landing';
import { useI18n } from '@/src/i18n';
import { listMoments, type MomentDTO } from '@/src/api/moments';
import { useOnboarding } from '@/src/onboarding/context';

// Warm, simple check-in questions for the empty state. One is picked at random
// each session so the invitation feels alive and personal, never canned.
const QUESTIONS: Record<'en' | 'fr', string[]> = {
  en: [
    'How are you, really?',
    'How’s your heart today?',
    'What’s here for you right now?',
    'How are you feeling today?',
    'How’s today treating you?',
    'What’s on your mind?',
    'How’s your day feeling?',
  ],
  fr: [
    'Comment allez-vous, vraiment ?',
    'Comment va votre cœur aujourd’hui ?',
    'Qu’est-ce qui vous habite, là ?',
    'Comment vous sentez-vous aujourd’hui ?',
    'Comment se passe votre journée ?',
    'À quoi pensez-vous ?',
    'Où en êtes-vous, là ?',
  ],
};

export default function Moments() {
  const router = useRouter();
  const { firstName } = useOnboarding();
  const { landing } = useLanding();
  const { t, locale } = useI18n();
  const [introActive, setIntroActive] = useState(false);
  const dim = { opacity: introActive ? 0.3 : 1 } as const;
  const [moments, setMoments] = useState<MomentDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(getToday);
  const [viewing, setViewing] = useState<MomentDTO | null>(null);

  const load = useCallback(async () => {
    try {
      const page = await listMoments({ limit: 100 });
      setMoments(page.moments);
    } catch {
      /* keep what we have */
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const isToday = isSameDay(selectedDate, getToday());
  const dayMoments = useMemo(() => moments.filter((m) => isSameDay(new Date(m.capturedAt), selectedDate)), [moments, selectedDate]);

  const openCapture = (bucket?: 'lighter' | 'heavier') =>
    router.navigate((bucket ? `/capture?bucket=${bucket}` : '/capture') as never);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: EDA.canvas, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={EDA.green} />
      </View>
    );
  }

  // Header title — a time-of-day greeting when Moments is the landing tab, else
  // the plain "Moments" title (mirrors ScreenHeading's isHome behaviour).
  const greetHere = landing === 'moments';
  const name = (firstName ?? '').trim();
  const pretty = name ? name.charAt(0).toUpperCase() + name.slice(1) : '';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? t.greeting.morning : hour < 18 ? t.greeting.afternoon : t.greeting.evening;
  const headerTitle = greetHere ? (pretty ? `${greeting},\n${pretty}.` : `${greeting}.`) : t.moments.title;

  return (
    <View style={{ flex: 1, backgroundColor: EDA.canvas }}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={{ paddingBottom: 180 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={EDA.green} />}
      >
        <EdHeader
          kicker="MOMENTS"
          title={headerTitle}
          source={ONBOARDING_IMAGES.card1}
          rightIcon={Settings}
          onRight={() => router.navigate('/settings' as never)}
        />

        <FadeIn style={{ paddingHorizontal: 22, paddingTop: 20 }}>
          <TabIntro tabKey="moments" onActiveChange={setIntroActive} />

          <View style={dim} pointerEvents={introActive ? 'none' : 'auto'}>
            {/* Date strip + Emotional Flow */}
            <View style={{ marginBottom: 28 }}>
              <DayNav selected={selectedDate} onSelect={setSelectedDate} />
              {dayMoments.length === 0 ? (
                <EmptyMomentCard isToday={isToday} firstEver={moments.length === 0} locale={locale} onArrive={openCapture} onWrite={() => openCapture()} />
              ) : (
                <EmotionalTimeline moments={dayMoments} showNow={isToday} onMomentPress={setViewing} />
              )}
            </View>

            {/* Quick actions */}
            <View style={{ gap: 14 }}>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                {/* My Journey — light editorial card */}
                <TouchableOpacity
                  onPress={() => {}}
                  activeOpacity={0.85}
                  style={{ flex: 1, backgroundColor: EDA.card, borderWidth: 1, borderColor: EDA.line, borderRadius: 20, padding: 20, minHeight: 160, justifyContent: 'space-between' }}
                >
                  <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: EDA.greenTint, justifyContent: 'center', alignItems: 'center' }}>
                    <Heart size={18} color={EDA.green} strokeWidth={2} />
                  </View>
                  <View>
                    <Text style={{ fontSize: 18, fontWeight: '800', color: EDA.ink, letterSpacing: -0.5, lineHeight: 24 }}>{t.moments.myJourney}</Text>
                    <Text style={{ fontSize: 11, color: EDA.inkSoft, marginTop: 4 }}>{t.moments.myJourneySub}</Text>
                  </View>
                </TouchableOpacity>

                {/* New moment — the one dark ink block */}
                <TouchableOpacity
                  onPress={() => openCapture()}
                  activeOpacity={0.85}
                  style={{ flex: 1, backgroundColor: EDA.ink, borderRadius: 20, padding: 20, minHeight: 160, justifyContent: 'space-between' }}
                >
                  <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.12)', justifyContent: 'center', alignItems: 'center' }}>
                    <PenLine size={18} color="#fff" strokeWidth={2} />
                  </View>
                  <View>
                    <Text style={{ fontSize: 18, fontWeight: '800', color: '#fff', letterSpacing: -0.5, lineHeight: 24 }}>{t.moments.newMoment}</Text>
                    <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 4 }}>{t.moments.newMomentSub}</Text>
                  </View>
                </TouchableOpacity>
              </View>

              {/* Tips — light editorial card */}
              <EdCard onPress={() => {}} style={{ flexDirection: 'row', alignItems: 'center', gap: 16, padding: 18 }}>
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: EDA.greenTint, justifyContent: 'center', alignItems: 'center' }}>
                  <Lightbulb size={22} color={EDA.green} strokeWidth={1.8} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: EDA.ink, marginBottom: 2 }}>{t.moments.tipsTitle}</Text>
                  <Text style={{ fontSize: 13, color: EDA.inkSoft }}>{t.moments.tipsSub}</Text>
                </View>
              </EdCard>
            </View>
          </View>
        </FadeIn>
      </ScrollView>

      <TabBar active="moments" />

      {viewing && <MomentDetail moment={viewing} onClose={() => setViewing(null)} onChanged={load} />}
    </View>
  );
}

// Empty state. On TODAY: a warm green "arrival" card that invites the moment and
// launches capture with the tapped feeling pre-selected. On past days: a quiet
// note — we don't nudge capturing in the past.
function EmptyMomentCard({
  isToday,
  firstEver,
  locale,
  onArrive,
  onWrite,
}: {
  isToday: boolean;
  firstEver: boolean;
  locale: 'en' | 'fr';
  onArrive: (bucket: 'lighter' | 'heavier') => void;
  onWrite: () => void;
}) {
  const { t } = useI18n();
  const todayKey = new Date().toDateString();
  const pastMsg = useMemo(() => t.moments.past[Math.floor(Math.abs(hashStr(todayKey + 'p')) % t.moments.past.length)], [todayKey, t]);
  // Random per mount (session) so the check-in question feels fresh each time.
  const [qIdx] = useState(() => Math.floor(Math.random() * QUESTIONS.en.length));

  if (!isToday) {
    return (
      <View style={{ backgroundColor: EDA.card, borderRadius: 24, padding: 32, alignItems: 'center', borderWidth: 1, borderColor: EDA.line }}>
        <Text style={{ fontSize: 15, color: EDA.faint, textAlign: 'center', fontStyle: 'italic' }}>{pastMsg}</Text>
      </View>
    );
  }

  const question = QUESTIONS[locale][qIdx];
  const c = {
    en: { eyebrow: firstEver ? 'YOUR FIRST MOMENT' : 'TODAY', write: 'Or just write a moment' },
    fr: { eyebrow: firstEver ? 'VOTRE PREMIER MOMENT' : "AUJOURD'HUI", write: 'Ou écrire un moment' },
  }[locale];

  return (
    <View style={{ backgroundColor: EDA.green, borderRadius: 24, padding: 26, overflow: 'hidden' }}>
      {/* soft decorative halo */}
      <View style={{ position: 'absolute', top: -44, right: -34, width: 170, height: 170, borderRadius: 85, backgroundColor: 'rgba(255,255,255,0.06)' }} pointerEvents="none" />

      <MonoLabel color="rgba(255,255,255,0.7)" style={{ marginBottom: 10 }}>{c.eyebrow}</MonoLabel>
      <Text style={{ fontSize: 25, fontWeight: '800', color: '#fff', letterSpacing: -0.6, lineHeight: 31, marginBottom: 22, maxWidth: 260 }}>{question}</Text>

      <View style={{ flexDirection: 'row', gap: 12 }}>
        <TouchableOpacity onPress={() => onArrive('lighter')} activeOpacity={0.85}
          style={{ flex: 1, height: 86, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center', gap: 9 }}>
          <Sun size={25} color="#fff" strokeWidth={2} />
          <Text style={{ fontSize: 15.5, fontWeight: '700', color: '#fff' }}>{locale === 'fr' ? 'Plus léger' : 'Lighter'}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => onArrive('heavier')} activeOpacity={0.85}
          style={{ flex: 1, height: 86, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center', gap: 9 }}>
          <CloudRain size={25} color="#fff" strokeWidth={2} />
          <Text style={{ fontSize: 15.5, fontWeight: '700', color: '#fff' }}>{locale === 'fr' ? 'Plus lourd' : 'Heavier'}</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity onPress={onWrite} activeOpacity={0.7} style={{ alignSelf: 'center', marginTop: 20 }}>
        <Text style={{ fontSize: 13.5, fontWeight: '700', color: 'rgba(255,255,255,0.85)', textDecorationLine: 'underline' }}>{c.write}</Text>
      </TouchableOpacity>
    </View>
  );
}

// Deterministic message pick per day (no Math.random → stable across renders).
function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
  return h;
}

// Moments home — ported from the v1 app (app/(main)/home.tsx), stripped of the
// v1-only machinery (walkthrough, welcome guide, Bloom, Supabase, i18n) and
// wired to the v2 REST API. Greeting → DayNav → Emotional Flow (or the animated
// empty card) → quick-action cards. The v2 API is keyset-only, so we fetch the
// recent window and filter to the selected day on the client.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect, useRouter } from 'expo-router';
import { Camera, Heart, Lightbulb, Mic, PenLine, Settings, Video } from 'lucide-react-native';
import { TabBar } from '@/src/ui/TabBar';
import { TabIntro } from '@/src/ui/TabIntro';
import { EmotionalTimeline } from '@/src/moments/EmotionalTimeline';
import { MomentDetail } from '@/src/moments/MomentDetail';
import { DayNav, getToday, isSameDay } from '@/src/moments/DayNav';
import { EDA, EdHeader, EdCard, FadeIn } from '@/src/ui/editorial';
import { ONBOARDING_IMAGES } from '@/src/onboarding/editorial/images';
import { useLanding } from '@/src/prefs/landing';
import { useI18n } from '@/src/i18n';
import { listMoments, type MomentDTO } from '@/src/api/moments';
import { useOnboarding } from '@/src/onboarding/context';

const CAPTURE_TYPES = [
  { key: 'video', Icon: Video },
  { key: 'voice', Icon: Mic },
  { key: 'write', Icon: PenLine },
  { key: 'photo', Icon: Camera },
];

export default function Moments() {
  const router = useRouter();
  const { firstName } = useOnboarding();
  const { landing } = useLanding();
  const { t } = useI18n();
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

  const openCapture = () => router.navigate('/capture' as never);

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
                <EmptyMomentCard isToday={isToday} onSelectType={openCapture} />
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
                  onPress={openCapture}
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

// The animated glowing empty card (today) / quiet card (past days) — ported from v1.
function EmptyMomentCard({ isToday, onSelectType }: { isToday: boolean; onSelectType: () => void }) {
  const { t } = useI18n();
  const glowAnim = useRef(new Animated.Value(0)).current;
  const todayKey = new Date().toDateString();
  const msg = useMemo(() => t.moments.empty[Math.floor(Math.abs(hashStr(todayKey)) % t.moments.empty.length)], [todayKey, t]);
  const pastMsg = useMemo(() => t.moments.past[Math.floor(Math.abs(hashStr(todayKey + 'p')) % t.moments.past.length)], [todayKey, t]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 2000, useNativeDriver: false }),
        Animated.timing(glowAnim, { toValue: 0, duration: 2000, useNativeDriver: false }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [glowAnim]);

  if (!isToday) {
    return (
      <View style={{ backgroundColor: EDA.card, borderRadius: 24, padding: 32, alignItems: 'center', borderWidth: 1, borderColor: EDA.line }}>
        <Text style={{ fontSize: 15, color: EDA.faint, textAlign: 'center', fontStyle: 'italic' }}>{pastMsg}</Text>
      </View>
    );
  }

  const borderColor = glowAnim.interpolate({ inputRange: [0, 1], outputRange: ['#12806922', '#12806966'] });
  const shadowOpacity = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.05, 0.2] });

  return (
    <Animated.View
      style={{
        backgroundColor: EDA.card, borderRadius: 24, padding: 28, alignItems: 'center', borderWidth: 1.5, borderColor,
        shadowColor: EDA.green, shadowOffset: { width: 0, height: 0 }, shadowOpacity, shadowRadius: 16, elevation: 4,
      }}
    >
      <Text style={{ fontSize: 20, fontWeight: '600', color: EDA.ink, textAlign: 'center', marginBottom: 8, lineHeight: 28 }}>{msg.text}</Text>
      <Text style={{ fontSize: 14, color: EDA.inkSoft, textAlign: 'center', lineHeight: 20, marginBottom: 20 }}>{msg.sub}</Text>
      <View style={{ flexDirection: 'row', gap: 14, justifyContent: 'center' }}>
        {CAPTURE_TYPES.map(({ key, Icon }) => (
          <TouchableOpacity
            key={key}
            onPress={onSelectType}
            activeOpacity={0.7}
            style={{
              width: 52, height: 52, borderRadius: 16, backgroundColor: EDA.greenTint, borderWidth: 1, borderColor: EDA.line,
              justifyContent: 'center', alignItems: 'center',
            }}
          >
            <Icon size={22} color={EDA.green} strokeWidth={2} />
          </TouchableOpacity>
        ))}
      </View>
    </Animated.View>
  );
}

// Deterministic message pick per day (no Math.random → stable across renders).
function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
  return h;
}

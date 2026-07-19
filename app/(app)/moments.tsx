// Moments home — ported from the v1 app (app/(main)/home.tsx), stripped of the
// v1-only machinery (walkthrough, welcome guide, Bloom, Supabase, i18n) and
// wired to the v2 REST API. Greeting → DayNav → Emotional Flow (or the animated
// empty card) → quick-action cards. The v2 API is keyset-only, so we fetch the
// recent window and filter to the selected day on the client.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Camera, Heart, Lightbulb, Mic, PenLine, Settings, Video } from 'lucide-react-native';
import { TabBar } from '@/src/ui/TabBar';
import { EmotionalTimeline } from '@/src/moments/EmotionalTimeline';
import { MomentDetail } from '@/src/moments/MomentDetail';
import { DayNav, getGreeting, getToday, isSameDay } from '@/src/moments/DayNav';
import { listMoments, type MomentDTO } from '@/src/api/moments';
import { useOnboarding } from '@/src/onboarding/context';

const CAPTURE_TYPES = [
  { key: 'video', Icon: Video, color: '#8B5CF6' },
  { key: 'voice', Icon: Mic, color: '#F59E0B' },
  { key: 'write', Icon: PenLine, color: '#10B981' },
  { key: 'photo', Icon: Camera, color: '#3B82F6' },
];

const EMPTY_MESSAGES = [
  { text: 'How are you feeling right now?', sub: 'Take a second to check in with yourself.' },
  { text: "What's on your mind?", sub: 'Even one word captures something real.' },
  { text: 'Pause. Breathe. Notice.', sub: 'What do you feel in this moment?' },
  { text: "You're here. That's enough.", sub: 'Capture whatever comes to mind.' },
  { text: 'What would you like to remember?', sub: 'A thought, a photo, a feeling.' },
  { text: 'This moment is yours.', sub: 'Write it, snap it, or say it.' },
];
const PAST_MESSAGES = ['A quiet day.', 'No moments captured.', "Nothing here — and that's okay.", 'An empty page, a full life.'];

export default function Moments() {
  const router = useRouter();
  const { firstName } = useOnboarding();
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
      <View style={{ flex: 1, backgroundColor: '#FAFAF8', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#4A9A86" />
      </View>
    );
  }

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: '#FAFAF8' }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: 20, paddingBottom: 180, paddingHorizontal: 24 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4A9A86" />}
      >
        {/* Header */}
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginBottom: 12 }}>
          <TouchableOpacity
            onPress={() => router.navigate('/settings' as never)}
            activeOpacity={0.7}
            style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#f5f5f5', justifyContent: 'center', alignItems: 'center' }}
          >
            <Settings size={18} color="#666" strokeWidth={1.8} />
          </TouchableOpacity>
        </View>
        <View style={{ marginBottom: 20 }}>
          <Text style={{ fontSize: 30, fontWeight: '700', color: '#000', letterSpacing: -0.8, lineHeight: 38 }}>
            {getGreeting()}
            {firstName ? ',\n' : '.'}
            {firstName ? <Text style={{ color: '#8A8A8A' }}>{firstName}.</Text> : null}
          </Text>
        </View>

        {/* Date strip + Emotional Flow */}
        <View style={{ marginBottom: 32 }}>
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
            <TouchableOpacity
              onPress={() => {}}
              activeOpacity={0.85}
              style={{ flex: 1, backgroundColor: '#4A9A86', borderRadius: 24, padding: 20, minHeight: 160, justifyContent: 'space-between' }}
            >
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' }}>
                <Heart size={18} color="#fff" strokeWidth={2} />
              </View>
              <View>
                <Text style={{ fontSize: 18, fontWeight: '800', color: '#fff', letterSpacing: -0.5, lineHeight: 24 }}>My Journey</Text>
                <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 4 }}>Patterns and progress</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={openCapture}
              activeOpacity={0.85}
              style={{ flex: 1, backgroundColor: '#1A1A1A', borderRadius: 24, padding: 20, minHeight: 160, justifyContent: 'space-between' }}
            >
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' }}>
                <PenLine size={18} color="#fff" strokeWidth={2} />
              </View>
              <View>
                <Text style={{ fontSize: 18, fontWeight: '800', color: '#fff', letterSpacing: -0.5, lineHeight: 24 }}>New moment</Text>
                <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>Notice how you feel</Text>
              </View>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            onPress={() => {}}
            activeOpacity={0.85}
            style={{ backgroundColor: '#F8F7F4', borderRadius: 24, padding: 20, flexDirection: 'row', alignItems: 'center', gap: 16, borderWidth: 1, borderColor: '#EBEBEB' }}
          >
            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#FEF3C7', justifyContent: 'center', alignItems: 'center' }}>
              <Lightbulb size={22} color="#F59E0B" strokeWidth={1.8} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#000', marginBottom: 2 }}>Tips for you</Text>
              <Text style={{ fontSize: 13, color: '#999' }}>Simple ideas to get more from your moments</Text>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <TabBar active="moments" />

      {viewing && <MomentDetail moment={viewing} onClose={() => setViewing(null)} onChanged={load} />}
    </SafeAreaView>
  );
}

// The animated glowing empty card (today) / quiet card (past days) — ported from v1.
function EmptyMomentCard({ isToday, onSelectType }: { isToday: boolean; onSelectType: () => void }) {
  const glowAnim = useRef(new Animated.Value(0)).current;
  const todayKey = new Date().toDateString();
  const msg = useMemo(() => EMPTY_MESSAGES[Math.floor(Math.abs(hashStr(todayKey)) % EMPTY_MESSAGES.length)], [todayKey]);
  const pastMsg = useMemo(() => PAST_MESSAGES[Math.floor(Math.abs(hashStr(todayKey + 'p')) % PAST_MESSAGES.length)], [todayKey]);

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
      <View style={{ backgroundColor: '#fff', borderRadius: 24, padding: 32, alignItems: 'center', borderWidth: 1, borderColor: '#EBEBEB' }}>
        <Text style={{ fontSize: 15, color: '#BBB', textAlign: 'center', fontStyle: 'italic' }}>{pastMsg}</Text>
      </View>
    );
  }

  const borderColor = glowAnim.interpolate({ inputRange: [0, 1], outputRange: ['#4A9A8620', '#4A9A8660'] });
  const shadowOpacity = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.05, 0.2] });

  return (
    <Animated.View
      style={{
        backgroundColor: '#fff', borderRadius: 24, padding: 28, alignItems: 'center', borderWidth: 1.5, borderColor,
        shadowColor: '#4A9A86', shadowOffset: { width: 0, height: 0 }, shadowOpacity, shadowRadius: 16, elevation: 4,
      }}
    >
      <Text style={{ fontSize: 20, fontWeight: '600', color: '#000', textAlign: 'center', marginBottom: 8, lineHeight: 28 }}>{msg.text}</Text>
      <Text style={{ fontSize: 14, color: '#999', textAlign: 'center', lineHeight: 20, marginBottom: 20 }}>{msg.sub}</Text>
      <View style={{ flexDirection: 'row', gap: 14, justifyContent: 'center' }}>
        {CAPTURE_TYPES.map(({ key, Icon, color }) => (
          <TouchableOpacity
            key={key}
            onPress={onSelectType}
            activeOpacity={0.7}
            style={{
              width: 52, height: 52, borderRadius: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: '#EFEFEF',
              justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3, elevation: 1,
            }}
          >
            <Icon size={22} color={color} strokeWidth={2} />
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

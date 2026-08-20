// Moments — v2. "Your line": one vertical timeline instead of a day-picker over
// a list.
//
// The v1 screen made you choose a date and then showed that day's moments, so a
// week was something you had to reconstruct by tapping through it. The line
// shows the week at once: time runs down, valence runs across (heavier left,
// lighter right), and a stretch of hard days leans visibly to one side.
//
// Scrolling UP goes back in time — the foot of the line is today, which is where
// a person starts.
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect, useRouter } from 'expo-router';
import { Settings } from 'lucide-react-native';
import { TabBar } from '@/src/ui/TabBar';
import { TabIntro } from '@/src/ui/TabIntro';
import { EDD, FadeIn, MonoLabel } from '@/src/ui/editorial';
import { Line } from '@/src/moments/Line';
import { MomentDetail } from '@/src/moments/MomentDetail';
import { useLanding } from '@/src/prefs/landing';
import { useOnboarding } from '@/src/onboarding/context';
import { Ground } from '@/src/ui/Ground';
import { useI18n } from '@/src/i18n';
import { listMoments, type MomentDTO } from '@/src/api/moments';

export default function Moments() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { t, locale } = useI18n();
  const { landing } = useLanding();
  const { firstName } = useOnboarding();
  const tr = t.line;

  const [moments, setMoments] = useState<MomentDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewing, setViewing] = useState<MomentDTO | null>(null);
  // "Nothing yet" and "we could not reach your line" are different things to be
  // told, and showing the welcoming empty state for a network failure is a lie.
  const [failed, setFailed] = useState(false);
  const [introActive, setIntroActive] = useState(false);
  const scroller = useRef<ScrollView>(null);

  const load = useCallback(async () => {
    try {
      const page = await listMoments({ limit: 100 });
      setMoments(page.moments);
      setFailed(false);
    } catch {
      // Keep whatever is already on screen — a dropped connection should not
      // erase someone's week — but say that this is stale.
      setFailed(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const greetHere = landing === 'moments';
  const name = (firstName ?? '').trim();
  const pretty = name ? name.charAt(0).toUpperCase() + name.slice(1) : '';
  const greeting = new Date().getHours() < 12 ? t.greeting.morning : new Date().getHours() < 18 ? t.greeting.afternoon : t.greeting.evening;
  const title = greetHere ? (pretty ? `${greeting},\n${pretty}.` : `${greeting}.`) : t.tabs.moments;

  return (
    <Ground>
      <StatusBar style="light" />
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <View style={{ paddingHorizontal: 22, paddingTop: 8, paddingBottom: 10, flexDirection: 'row', alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <MonoLabel color={EDD.faint} size={10.5} style={{ marginBottom: 10 }}>{tr.kicker}</MonoLabel>
            <Text style={{ fontSize: 27, fontWeight: '800', color: EDD.text, letterSpacing: -0.9, lineHeight: 31 }}>{title}</Text>
          </View>
          <TouchableOpacity
            onPress={() => router.navigate('/settings' as never)}
            activeOpacity={0.8}
            style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: EDD.card, borderWidth: 1, borderColor: EDD.cardLine, alignItems: 'center', justifyContent: 'center' }}
          >
            <Settings size={17} color={EDD.textSoft} strokeWidth={2} />
          </TouchableOpacity>
        </View>

        <ScrollView
          ref={scroller}
          contentContainerStyle={{ paddingBottom: 150, paddingTop: 22 }}
          showsVerticalScrollIndicator={false}
          // The newest end is the foot of the line, so that is where a person
          // should be standing when the screen opens.
          onContentSizeChange={() => scroller.current?.scrollToEnd({ animated: false })}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} tintColor={EDD.faint} />}
        >
          <View style={{ paddingHorizontal: 22 }}>
            <TabIntro tabKey="moments" tone="dark" onActiveChange={setIntroActive} />
          </View>

          {loading ? (
            <View style={{ paddingTop: 60, alignItems: 'center' }}>
              <ActivityIndicator color={EDD.faint} />
            </View>
          ) : (
            <FadeIn style={{ opacity: introActive ? 0.3 : 1 }}>
              {moments.length === 0 ? (
                <View style={{ paddingHorizontal: 34, paddingTop: 40, alignItems: 'center' }}>
                  <Text style={{ fontSize: 19, fontWeight: '700', color: EDD.text, textAlign: 'center', lineHeight: 26 }}>
                    {failed ? tr.failedTitle : tr.emptyTitle}
                  </Text>
                  <Text style={{ marginTop: 8, fontSize: 14, color: EDD.textSoft, textAlign: 'center', lineHeight: 21 }}>
                    {failed ? tr.failedBody : tr.emptyBody}
                  </Text>
                  {failed ? (
                    <TouchableOpacity
                      onPress={() => { setLoading(true); void load(); }}
                      style={{ marginTop: 18, height: 44, paddingHorizontal: 26, borderRadius: 22, borderWidth: 1, borderColor: EDD.cardLine, alignItems: 'center', justifyContent: 'center' }}
                    >
                      <Text style={{ fontSize: 14, fontWeight: '700', color: EDD.text }}>{t.common.retry}</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              ) : (
                <Line
                  moments={moments}
                  width={width > 460 ? 420 : width}
                  locale={locale}
                  labels={{ heavier: tr.heavier, lighter: tr.lighter, today: tr.today, tapToRead: tr.tapToRead }}
                  onOpen={setViewing}
                  onCaptureToday={() => router.navigate('/capture' as never)}
                />
              )}
            </FadeIn>
          )}

          {moments.length > 0 ? (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 22, marginTop: 12 }}>
              <Text style={{ fontSize: 11.5, color: EDD.faint }}>{tr.weekSoFar}</Text>
              <Text style={{ fontSize: 11.5, color: EDD.faint }}>{tr.scrollBack}</Text>
            </View>
          ) : null}
        </ScrollView>
      </SafeAreaView>

      <TabBar active="moments" tone="dark" />
      {viewing ? <MomentDetail moment={viewing} onClose={() => setViewing(null)} onChanged={load} /> : null}
    </Ground>
  );
}

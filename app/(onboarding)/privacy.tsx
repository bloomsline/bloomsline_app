import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { EditorialBg, Scrim, MonoKicker, Pill } from '@/src/onboarding/editorial/kit';
import { AnimatedPromiseIcon, type PromiseIcon } from '@/src/onboarding/editorial/AnimatedIcon';
import { ONBOARDING_IMAGES } from '@/src/onboarding/editorial/images';
import { useOnboarding } from '@/src/onboarding/context';
import { useI18n } from '@/src/i18n';
import { saveProfile } from '@/src/api/me';

// e4b — The privacy promise, editorial theme. Imagery held behind a deep scrim,
// promises as hairline-divided rows, an explicit consent checkbox above the pill.
export default function Privacy() {
  const { update } = useOnboarding();
  const { t } = useI18n();
  const [agreed, setAgreed] = useState(false);

  const T = t.onboarding.privacy;
  const rows: { icon: PromiseIcon; title: string; body: string }[] = [
    { icon: 'lock', title: T.p1Title, body: T.p1Body },
    { icon: 'ban', title: T.p2Title, body: T.p2Body },
    { icon: 'shield', title: T.p3Title, body: T.p3Body },
    { icon: 'wave', title: T.p4Title, body: T.p4Body },
  ];

  const next = () => {
    if (!agreed) return;
    update({ agreedToTerms: true });
    saveProfile({ agreedToTerms: true });
    router.push('/(onboarding)/ready');
  };

  return (
    <View style={{ flex: 1 }}>
      <StatusBar style="light" />
      <EditorialBg source={ONBOARDING_IMAGES.privacy}>
        <Scrim colors={['rgba(16,18,16,0.72)', 'rgba(16,18,16,0.88)', 'rgba(16,18,16,0.96)']} locations={[0, 0.42, 1]} />
        <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1 }}>
          <View style={{ flex: 1, paddingHorizontal: 24 }}>
            {/* Back only. v2 dropped the 02/02 progress bar along with the rest
                of the step counter, so nothing here implies a numbered flow. */}
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 8 }}>
              <Pressable onPress={() => router.back()} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' }}>
                <ChevronLeft size={18} color="#fff" strokeWidth={2} />
              </Pressable>
            </View>

            <MonoKicker size={10} color="rgba(255,255,255,0.55)" style={{ marginTop: 26, marginBottom: 12 }}>{T.badge}</MonoKicker>
            <Text style={{ fontSize: 30, fontWeight: '800', color: '#fff', letterSpacing: -1.1, lineHeight: 32 }}>{T.title}</Text>
            <Text style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.7)', lineHeight: 20, marginTop: 10 }}>{T.intro}</Text>

            <View style={{ marginTop: 20 }}>
              {rows.map((r, i) => (
                <View key={r.title} style={{ flexDirection: 'row', gap: 13, alignItems: 'flex-start', paddingVertical: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.12)' }}>
                  <View style={{ width: 22, alignItems: 'center', marginTop: 1 }}>
                    <AnimatedPromiseIcon type={r.icon} delay={i * 130} color="#fff" size={19} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff' }}>{r.title}</Text>
                    <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.62)', lineHeight: 17, marginTop: 2 }}>{r.body}</Text>
                  </View>
                </View>
              ))}
            </View>

            <View style={{ flex: 1 }} />

            <View style={{ paddingBottom: 10 }}>
              <Pressable onPress={() => setAgreed((v) => !v)} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 11, marginBottom: 16 }}>
                <View style={{ width: 22, height: 22, borderRadius: 7, backgroundColor: agreed ? '#fff' : 'transparent', borderWidth: agreed ? 0 : 1.5, borderColor: 'rgba(255,255,255,0.5)', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
                  {agreed ? <Text style={{ fontSize: 13, fontWeight: '800', color: '#141414' }}>✓</Text> : null}
                </View>
                <Text style={{ flex: 1, fontSize: 12.5, color: 'rgba(255,255,255,0.78)', lineHeight: 18 }}>
                  {T.consentPre}<Text style={{ color: '#fff', fontWeight: '700' }}>{T.consentA}</Text>{T.consentMid}<Text style={{ color: '#fff', fontWeight: '700' }}>{T.consentB}</Text>.
                </Text>
              </Pressable>
              <Pill label={T.cta} variant="white" disabled={!agreed} onPress={next} />
            </View>
          </View>
        </SafeAreaView>
      </EditorialBg>
    </View>
  );
}

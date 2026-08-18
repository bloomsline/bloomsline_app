import { useState } from 'react';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { EditorialBg, Scrim, RiseIn, MonoKicker, Pill } from '@/src/onboarding/editorial/kit';
import { ONBOARDING_IMAGES } from '@/src/onboarding/editorial/images';
import { useOnboarding } from '@/src/onboarding/context';
import { useAuth } from '@/src/auth/auth-context';
import { useI18n, fmt } from '@/src/i18n';

// e5 — You're in. Full-bleed close: the image breathes, the copy rises once, the
// pill fades in last. Arrival delivered calmly.
export default function Ready() {
  const { firstName } = useOnboarding();
  const { completeOnboarding } = useAuth();
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const name = (firstName ?? '').trim();
  const pretty = name ? name.charAt(0).toUpperCase() + name.slice(1) : '';

  const T = t.onboarding.ready;
  // The first name captured in "about you" comes back here.
  const title = pretty ? fmt(T.title, { name: pretty }) : T.titleNoName;

  const go = async () => {
    setBusy(true);
    await completeOnboarding();
  };

  return (
    <View style={{ flex: 1 }}>
      <StatusBar style="light" />
      <EditorialBg source={ONBOARDING_IMAGES.final} zoom>
        <Scrim colors={['rgba(16,18,16,0.4)', 'rgba(16,18,16,0.15)', 'rgba(16,18,16,0.92)']} locations={[0, 0.4, 1]} />
        <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1 }}>
          <View style={{ flex: 1, justifyContent: 'flex-end', paddingHorizontal: 28, paddingBottom: 30 }}>
            <RiseIn>
              <MonoKicker color="rgba(255,255,255,0.6)" style={{ marginBottom: 14 }}>{T.eyebrow}</MonoKicker>
              <Text style={{ fontSize: 40, fontWeight: '800', color: '#fff', letterSpacing: -1.6, lineHeight: 42 }}>{title}</Text>
              <Text style={{ fontSize: 15, color: 'rgba(255,255,255,0.82)', lineHeight: 23, marginTop: 14, maxWidth: 300 }}>{T.body}</Text>
            </RiseIn>
            <RiseIn delay={450} style={{ marginTop: 24 }}>
              <Pill label={T.cta} variant="white" onPress={go} disabled={busy} />
            </RiseIn>
          </View>
        </SafeAreaView>
      </EditorialBg>
    </View>
  );
}

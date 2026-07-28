import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Lock } from 'lucide-react-native';
import { EditorialBg, Scrim, RiseIn, MonoKicker, Pill, LangToggle } from '@/src/onboarding/editorial/kit';
import { ONBOARDING_IMAGES } from '@/src/onboarding/editorial/images';
import { useI18n } from '@/src/i18n';

const T = {
  en: {
    kicker: 'bloomsline',
    headlinePre: 'However you’re\narriving, you’re ',
    headlineAccent: 'welcome.',
    tagline: 'A private space for your wellbeing, one small moment at a time.',
    private: 'Private by default. Yours alone.',
    createProfile: 'Create my profile',
    haveAccount: 'I already have an account',
  },
  fr: {
    kicker: 'bloomsline',
    headlinePre: 'Peu importe comment\nvous arrivez, vous êtes ',
    headlineAccent: 'le bienvenu.',
    tagline: 'Un espace privé pour votre bien-être, un petit moment à la fois.',
    private: 'Privé par défaut. Rien qu’à vous.',
    createProfile: 'Créer mon profil',
    haveAccount: 'J’ai déjà un compte',
  },
} as const;

// Welcome. Warm, inclusive entry; role (patient vs practitioner) is decided
// after sign-in. Full-bleed editorial hero matching the onboarding world.
export default function Welcome() {
  const { locale, setLocale } = useI18n();
  const tr = T[locale];
  return (
    <View style={{ flex: 1 }}>
      <StatusBar style="light" />
      <EditorialBg source={ONBOARDING_IMAGES.splash} zoom>
        <Scrim colors={['rgba(16,18,16,0.55)', 'rgba(16,18,16,0.18)', 'rgba(16,18,16,0.92)']} locations={[0, 0.34, 1]} />
        <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1 }}>
          <View style={{ flex: 1, paddingHorizontal: 28 }}>
            <RiseIn style={{ marginTop: 26 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'flex-start', marginBottom: 18 }}>
                <LangToggle value={locale} onChange={(v) => setLocale(v as typeof locale)} />
              </View>
              <MonoKicker>{tr.kicker}</MonoKicker>
              <Text style={{ marginTop: 12, fontSize: 36, fontWeight: '800', color: '#fff', letterSpacing: -1.2, lineHeight: 42 }}>
                {tr.headlinePre}
                <Text style={{ color: '#7FD9C0' }}>{tr.headlineAccent}</Text>
              </Text>
              <Text style={{ marginTop: 14, fontSize: 15, color: 'rgba(255,255,255,0.82)', lineHeight: 23, maxWidth: 300 }}>{tr.tagline}</Text>
            </RiseIn>

            <View style={{ flex: 1 }} />

            <RiseIn delay={350} style={{ paddingBottom: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 16 }}>
                <Lock size={13} color="rgba(255,255,255,0.7)" strokeWidth={2} />
                <Text style={{ fontSize: 12.5, fontWeight: '500', color: 'rgba(255,255,255,0.7)' }}>{tr.private}</Text>
              </View>

              <Pill label={tr.createProfile} onPress={() => router.push('/(auth)/sign-up')} />

              <Pressable onPress={() => router.push('/(auth)/sign-up')} style={{ alignItems: 'center', paddingVertical: 16 }}>
                <Text style={{ fontSize: 15, fontWeight: '600', color: 'rgba(255,255,255,0.9)' }}>{tr.haveAccount}</Text>
              </Pressable>
            </RiseIn>
          </View>
        </SafeAreaView>
      </EditorialBg>
    </View>
  );
}

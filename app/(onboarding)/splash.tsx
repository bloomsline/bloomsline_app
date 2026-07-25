import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { EditorialBg, Scrim, RiseIn, Pill } from '@/src/onboarding/editorial/kit';
import { ONBOARDING_IMAGES } from '@/src/onboarding/editorial/images';
import { useOnboarding } from '@/src/onboarding/context';
import { useI18n } from '@/src/i18n';

function initialOf(name: string | null) {
  return (name ?? '').replace(/^dr\.?\s*/i, '').trim()[0]?.toUpperCase() ?? 'B';
}

// e1 — Editorial splash. Full-bleed imagery (soft breathe), one oversized
// headline that rises in, invited chip + pinned pill at the bottom.
export default function Welcome() {
  const { hasPractitioner, practitionerName } = useOnboarding();
  const { locale } = useI18n();
  const prac = practitionerName ?? (locale === 'fr' ? 'Votre praticien' : 'Your practitioner');
  const T = {
    en: {
      headline: 'A gentler\nplace to be.',
      invited: `${prac} invited you`,
      subtitle: 'Your private space, between sessions.',
      subtitleSolo: 'Your private space, at your own pace.',
      cta: 'Get started',
    },
    fr: {
      headline: 'Un endroit\nplus doux.',
      invited: `${prac} vous a invité·e`,
      subtitle: 'Votre espace privé, entre les séances.',
      subtitleSolo: 'Votre espace privé, à votre rythme.',
      cta: 'Commencer',
    },
  }[locale];

  return (
    <View style={{ flex: 1 }}>
      <StatusBar style="light" />
      <EditorialBg source={ONBOARDING_IMAGES.splash} zoom>
        <Scrim colors={['rgba(16,18,16,0.55)', 'rgba(16,18,16,0.18)', 'rgba(16,18,16,0.9)']} locations={[0, 0.34, 1]} />
        <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1 }}>
          <View style={{ flex: 1, paddingHorizontal: 28 }}>
            <RiseIn style={{ marginTop: 26 }}>
              <View style={{ width: 30, height: 30, borderRadius: 15, borderWidth: 3, borderColor: '#fff', marginBottom: 16 }} />
              <Text style={{ fontSize: 42, fontWeight: '800', color: '#fff', letterSpacing: -1.6, lineHeight: 44 }}>{T.headline}</Text>
            </RiseIn>

            <View style={{ flex: 1 }} />

            <RiseIn delay={350} style={{ paddingBottom: 12 }}>
              {hasPractitioner && (
                <View style={{ flexDirection: 'row', alignSelf: 'flex-start', alignItems: 'center', gap: 11, backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', borderRadius: 30, paddingVertical: 7, paddingLeft: 7, paddingRight: 16, marginBottom: 16 }}>
                  <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 14, fontWeight: '800', color: '#141414' }}>{initialOf(prac)}</Text>
                  </View>
                  <Text style={{ fontSize: 13.5, fontWeight: '700', color: '#fff' }} numberOfLines={1}>{T.invited}</Text>
                </View>
              )}
              <Text style={{ fontSize: 15, color: 'rgba(255,255,255,0.82)', lineHeight: 23, marginBottom: 20, maxWidth: 300 }}>
                {hasPractitioner ? T.subtitle : T.subtitleSolo}
              </Text>
              <Pill label={T.cta} onPress={() => router.push('/(onboarding)/stories')} />
            </RiseIn>
          </View>
        </SafeAreaView>
      </EditorialBg>
    </View>
  );
}

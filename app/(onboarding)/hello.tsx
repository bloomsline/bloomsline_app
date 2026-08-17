import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { EditorialBg, Scrim, RiseIn, Pill, ED } from '@/src/onboarding/editorial/kit';
import { ONBOARDING_IMAGES } from '@/src/onboarding/editorial/images';
import { useOnboarding } from '@/src/onboarding/context';
import { useI18n, fmt } from '@/src/i18n';

/** "Dr. Marie Lambert" → "Marie". The message is signed the way a person signs. */
const firstNameOf = (name: string | null) =>
  (name ?? '').replace(/^dr\.?\s*/i, '').trim().split(/\s+/)[0] ?? '';

// c1 — the practitioner's hello, shown ONLY on the invited route. A solo patient
// has no one to hear from, so `about-you` sends them straight to the carousel.
//
// This is the beat the parked splash used to carry: proof that the invitation
// link worked and a real person is on the other end. It reads as a message
// rather than a marketing screen, so it is a card on a held photograph, signed.
export default function Hello() {
  const { firstName, practitionerName } = useOnboarding();
  const { t } = useI18n();
  const T = t.onboarding.hello;

  const prac = firstNameOf(practitionerName);
  const name = (firstName ?? '').trim();
  const pretty = name ? name.charAt(0).toUpperCase() + name.slice(1) : '';

  return (
    <View style={{ flex: 1 }}>
      <StatusBar style="light" />
      <EditorialBg source={ONBOARDING_IMAGES.about} zoom>
        <Scrim colors={['rgba(16,18,16,0.62)', 'rgba(16,18,16,0.42)', 'rgba(16,18,16,0.94)']} locations={[0, 0.38, 1]} />
        <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1 }}>
          <View style={{ flex: 1, justifyContent: 'flex-end', paddingHorizontal: 26, paddingBottom: 26 }}>
            <RiseIn>
              <View
                style={{
                  alignSelf: 'flex-start',
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 9,
                  backgroundColor: 'rgba(255,255,255,0.14)',
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.2)',
                  borderRadius: 999,
                  paddingLeft: 6,
                  paddingRight: 14,
                  paddingVertical: 6,
                  marginBottom: 18,
                }}
              >
                <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: ED.green, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 12, fontWeight: '800', color: '#fff' }}>{prac.charAt(0).toUpperCase() || 'M'}</Text>
                </View>
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#fff' }} numberOfLines={1}>
                  {fmt(T.chip, { prac })}
                </Text>
              </View>

              <Text style={{ fontSize: 24, fontWeight: '800', color: '#fff', letterSpacing: -0.8, lineHeight: 28 }}>
                {pretty ? fmt(T.hi, { name: pretty }) : T.hiNoName}
              </Text>
              <Text style={{ marginTop: 12, fontSize: 15, color: 'rgba(255,255,255,0.84)', lineHeight: 23 }}>{T.body}</Text>
              {prac ? (
                <Text style={{ marginTop: 16, fontSize: 14.5, fontWeight: '700', color: '#fff' }}>{prac}</Text>
              ) : null}
            </RiseIn>

            <RiseIn delay={380} style={{ marginTop: 26 }}>
              <Pill label={T.cta} variant="white" onPress={() => router.push('/(onboarding)/stories')} />
            </RiseIn>
          </View>
        </SafeAreaView>
      </EditorialBg>
    </View>
  );
}

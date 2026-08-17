import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { EditorialBg, RiseIn, Pill, ED } from '@/src/onboarding/editorial/kit';
import { DateOfBirthField } from '@/src/ui/DateOfBirthField';
import { ONBOARDING_IMAGES } from '@/src/onboarding/editorial/images';
import { useOnboarding } from '@/src/onboarding/context';
import { useI18n, type Locale } from '@/src/i18n';
import { saveProfile } from '@/src/api/me';

// e4 — About you, now the FIRST step after sign-up. A light sheet glides up over
// the held imagery (the photography stays present, so it never feels like
// paperwork). Collects + persists first/last name, date of birth, and language.
//
// v2 dropped both the step counter and the practitioner chip: with the splash
// gone this is step one of an unnumbered flow, and the chip repeated what the
// invite screen already said.
export default function AboutYou() {
  const insets = useSafeAreaInsets();
  const { firstName, lastName, dateOfBirth, hasPractitioner, update } = useOnboarding();
  const { t, locale, setLocale } = useI18n();
  const [first, setFirst] = useState(firstName);
  const [last, setLast] = useState(lastName);
  const [dob, setDob] = useState<string | null>(dateOfBirth);
  const [focus, setFocus] = useState<'first' | 'last' | null>(null);
  const ready = first.trim().length > 0 && last.trim().length > 0;

  const T = t.onboarding.aboutYou;

  // An invited patient meets their practitioner's hello next; a solo one goes
  // straight to the carousel, which has nothing to say about a practitioner.
  const next = () => {
    if (!ready) return;
    update({ firstName: first.trim(), lastName: last.trim(), dateOfBirth: dob });
    saveProfile({ firstName: first.trim(), lastName: last.trim(), dateOfBirth: dob, locale });
    router.push(hasPractitioner ? '/(onboarding)/hello' : '/(onboarding)/stories');
  };

  const nameFieldStyle = (which: 'first' | 'last') => ({
    height: 50, borderRadius: 14, backgroundColor: '#fff', borderWidth: focus === which ? 2 : 1.5,
    borderColor: focus === which ? ED.green : '#E7E6DF', paddingHorizontal: 15, fontSize: 15.5, fontWeight: '600' as const, color: '#141414',
  });

  const langPill = (loc: Locale, label: string) => {
    const on = locale === loc;
    return (
      <Pressable onPress={() => setLocale(loc)} style={{ flex: 1, height: 50, borderRadius: 14, backgroundColor: on ? ED.green : '#fff', borderWidth: on ? 0 : 1.5, borderColor: '#E7E6DF', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 14.5, fontWeight: '700', color: on ? '#fff' : '#33352F' }}>{label}</Text>
      </Pressable>
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <StatusBar style="light" />
      <EditorialBg source={ONBOARDING_IMAGES.about}>
        <View style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(16,18,16,0.35)' }} pointerEvents="none" />
        <SafeAreaView edges={['top']} style={{ flex: 1 }}>
          <View style={{ flex: 1 }}>
            <View style={{ paddingHorizontal: 24, paddingTop: 12 }}>
              <Pressable onPress={() => router.back()} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}>
                <ChevronLeft size={18} color="#fff" strokeWidth={2} />
              </Pressable>
            </View>

            <View style={{ flex: 1 }} />

            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
              <RiseIn y={40} duration={700} style={{ backgroundColor: ED.sheet, borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingHorizontal: 26, paddingTop: 24, paddingBottom: insets.bottom + 24 }}>
                <Text style={{ fontSize: 26, fontWeight: '800', color: '#141414', letterSpacing: -0.9, lineHeight: 29 }}>{T.title}</Text>

                <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 11.5, fontWeight: '700', color: '#8A8A83', marginBottom: 6 }}>{T.firstName}</Text>
                    <TextInput value={first} onChangeText={setFirst} onFocus={() => setFocus('first')} onBlur={() => setFocus(null)} autoCapitalize="words" style={[nameFieldStyle('first'), Platform.OS === 'web' ? ({ outlineStyle: 'none' } as never) : null]} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 11.5, fontWeight: '700', color: '#8A8A83', marginBottom: 6 }}>{T.lastName}</Text>
                    <TextInput value={last} onChangeText={setLast} onFocus={() => setFocus('last')} onBlur={() => setFocus(null)} autoCapitalize="words" style={[nameFieldStyle('last'), Platform.OS === 'web' ? ({ outlineStyle: 'none' } as never) : null]} />
                  </View>
                </View>

                <Text style={{ fontSize: 11.5, fontWeight: '700', color: '#8A8A83', marginTop: 12, marginBottom: 6 }}>{T.dob}</Text>
                <DateOfBirthField value={dob} onChange={setDob} months={[...t.onboarding.months]} placeholder={T.dobPlaceholder} doneLabel={T.dobDone} titleLabel={T.dobTitle} />

                <Text style={{ fontSize: 11.5, fontWeight: '700', color: '#8A8A83', marginTop: 12, marginBottom: 6 }}>{T.language}</Text>
                <View style={{ flexDirection: 'row', gap: 9 }}>
                  {langPill('en', T.english)}
                  {langPill('fr', T.french)}
                </View>

                <Pill label={T.continue} variant="dark" disabled={!ready} onPress={next} style={{ marginTop: 20 }} />
              </RiseIn>
            </KeyboardAvoidingView>
          </View>
        </SafeAreaView>
      </EditorialBg>
    </View>
  );
}

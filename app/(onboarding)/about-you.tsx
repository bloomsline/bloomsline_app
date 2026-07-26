import { useCallback, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router, useFocusEffect } from 'expo-router';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { EditorialBg, RiseIn, MonoKicker, Pill, ED } from '@/src/onboarding/editorial/kit';
import { DateOfBirthField } from '@/src/ui/DateOfBirthField';
import { PractitionerSheet } from '@/src/care/PractitionerSheet';
import { ONBOARDING_IMAGES } from '@/src/onboarding/editorial/images';
import { useOnboarding } from '@/src/onboarding/context';
import { useI18n, type Locale } from '@/src/i18n';
import { saveProfile } from '@/src/api/me';
import { fetchCare, type CarePractitioner } from '@/src/api/care';

const initialOf = (name: string | null) => (name ?? '').replace(/^dr\.?\s*/i, '').trim()[0]?.toUpperCase() ?? 'M';

// e4 — About you. A light sheet glides up over the held imagery (the photography
// stays present, so it never feels like paperwork). Collects + persists first/last
// name, date of birth, and language.
export default function AboutYou() {
  const insets = useSafeAreaInsets();
  const { firstName, lastName, dateOfBirth, hasPractitioner, practitionerName, update } = useOnboarding();
  const { t, locale, setLocale } = useI18n();
  const [first, setFirst] = useState(firstName);
  const [last, setLast] = useState(lastName);
  const [dob, setDob] = useState<string | null>(dateOfBirth);
  const [focus, setFocus] = useState<'first' | 'last' | null>(null);
  const [prac, setPrac] = useState<CarePractitioner | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const ready = first.trim().length > 0 && last.trim().length > 0;

  useFocusEffect(
    useCallback(() => {
      if (!hasPractitioner) return;
      let alive = true;
      fetchCare().then((c) => { if (alive) setPrac(c?.practitioner ?? null); });
      return () => { alive = false; };
    }, [hasPractitioner]),
  );

  const T = {
    en: { step: 'Step 01 / 02', title: 'First, a bit\nabout you.', firstName: 'First name', lastName: 'Last name', dob: 'Date of birth', pick: 'Pick a date', done: 'Done', language: 'Language', english: 'English', french: 'Français', cta: 'Continue' },
    fr: { step: 'Étape 01 / 02', title: 'D’abord, un peu\nde vous.', firstName: 'Prénom', lastName: 'Nom', dob: 'Date de naissance', pick: 'Choisir une date', done: 'Terminé', language: 'Langue', english: 'English', french: 'Français', cta: 'Continuer' },
  }[locale];

  const next = () => {
    if (!ready) return;
    update({ firstName: first.trim(), lastName: last.trim(), dateOfBirth: dob });
    saveProfile({ firstName: first.trim(), lastName: last.trim(), dateOfBirth: dob, locale });
    router.push('/(onboarding)/privacy');
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
                {hasPractitioner && (
                  <Pressable onPress={() => setSheetOpen(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16, backgroundColor: '#F1F0EA', borderRadius: 14, padding: 10 }}>
                    <View style={{ width: 34, height: 34, borderRadius: 12, backgroundColor: ED.green, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontSize: 15, fontWeight: '800', color: '#fff' }}>{initialOf(practitionerName)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13.5, fontWeight: '700', color: '#141414' }} numberOfLines={1}>{practitionerName ?? t.onboarding.aboutYou.practitioner}</Text>
                      {prac?.headline ? <Text style={{ fontSize: 11.5, color: '#8A8A83' }} numberOfLines={1}>{prac.headline}</Text> : null}
                    </View>
                    <ChevronRight size={18} color="#B5B5AD" strokeWidth={2} />
                  </Pressable>
                )}

                <MonoKicker size={10.5} color={ED.green} style={{ marginBottom: 10 }}>{T.step}</MonoKicker>
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
                <DateOfBirthField value={dob} onChange={setDob} months={[...t.onboarding.months]} placeholder={T.pick} doneLabel={T.done} titleLabel={T.dob} />

                <Text style={{ fontSize: 11.5, fontWeight: '700', color: '#8A8A83', marginTop: 12, marginBottom: 6 }}>{T.language}</Text>
                <View style={{ flexDirection: 'row', gap: 9 }}>
                  {langPill('en', T.english)}
                  {langPill('fr', T.french)}
                </View>

                <Pill label={T.cta} variant="dark" disabled={!ready} onPress={next} style={{ marginTop: 20 }} />
              </RiseIn>
            </KeyboardAvoidingView>
          </View>
        </SafeAreaView>
      </EditorialBg>

      <PractitionerSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} practitioner={prac} nameFallback={practitionerName} />
    </View>
  );
}

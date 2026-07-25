import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ChevronLeft } from 'lucide-react-native';
import { EditorialBg, RiseIn, MonoKicker, Pill, ED } from '@/src/onboarding/editorial/kit';
import { ONBOARDING_IMAGES } from '@/src/onboarding/editorial/images';
import { useAuth } from '@/src/auth/auth-context';
import { notify } from '@/src/ui/alert';
import { useI18n, fmt } from '@/src/i18n';

const T = {
  en: {
    kicker: 'Verify',
    title: 'Enter your\ncode.',
    sent: 'We emailed a 6-digit code to {email}. It expires in 10 minutes.',
    dev: 'Dev mode: code prefilled ({code}).',
    verify: 'Verify',
    resend: 'Resend code',
    invalid: 'That code is invalid or expired. Request a new one.',
    wrong: 'Something went wrong. Please try again.',
    resent: 'We sent a new code.',
    resendFail: 'Could not resend the code.',
  },
  fr: {
    kicker: 'Vérification',
    title: 'Entrez votre\ncode.',
    sent: 'Nous avons envoyé un code à 6 chiffres à {email}. Il expire dans 10 minutes.',
    dev: 'Mode dev : code prérempli ({code}).',
    verify: 'Vérifier',
    resend: 'Renvoyer le code',
    invalid: 'Ce code est invalide ou expiré. Demandez-en un nouveau.',
    wrong: 'Une erreur est survenue. Veuillez réessayer.',
    resent: 'Nous avons envoyé un nouveau code.',
    resendFail: 'Impossible de renvoyer le code.',
  },
} as const;

// Email one-time-code step. On success the session becomes `onboarding`, and the
// (auth) layout redirects into the onboarding flow.
export default function Verify() {
  const insets = useSafeAreaInsets();
  const { locale } = useI18n();
  const tr = T[locale];
  const { email, devCode } = useLocalSearchParams<{ email: string; devCode?: string }>();
  const { verifyEmailCode, startEmailSignIn } = useAuth();
  const [code, setCode] = useState(typeof devCode === 'string' ? devCode : '');
  const [focus, setFocus] = useState(false);
  const [busy, setBusy] = useState(false);
  const ready = code.trim().length === 6;

  const verify = async () => {
    if (!ready || busy || !email) return;
    setBusy(true);
    try {
      const ok = await verifyEmailCode(email, code.trim());
      if (!ok) notify(tr.kicker, tr.invalid);
    } catch {
      notify(tr.kicker, tr.wrong);
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    if (!email) return;
    try {
      const dc = await startEmailSignIn(email);
      if (dc) setCode(dc);
      notify(tr.kicker, tr.resent);
    } catch {
      notify(tr.kicker, tr.resendFail);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <StatusBar style="light" />
      <EditorialBg source={ONBOARDING_IMAGES.about}>
        <View style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(16,18,16,0.4)' }} pointerEvents="none" />
        <SafeAreaView edges={['top']} style={{ flex: 1 }}>
          <View style={{ flex: 1 }}>
            <View style={{ paddingHorizontal: 24, paddingTop: 12 }}>
              <Pressable onPress={() => router.back()} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}>
                <ChevronLeft size={18} color="#fff" strokeWidth={2} />
              </Pressable>
            </View>

            <View style={{ flex: 1 }} />

            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
              <RiseIn y={40} duration={700} style={{ backgroundColor: ED.sheet, borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingHorizontal: 26, paddingTop: 26, paddingBottom: insets.bottom + 22 }}>
                <MonoKicker size={10.5} color={ED.green} style={{ marginBottom: 10 }}>{tr.kicker}</MonoKicker>
                <Text style={{ fontSize: 28, fontWeight: '800', color: '#141414', letterSpacing: -0.9, lineHeight: 31 }}>{tr.title}</Text>
                <Text style={{ marginTop: 8, fontSize: 14.5, color: '#8A8A83', lineHeight: 21 }}>{fmt(tr.sent, { email: String(email ?? '') })}</Text>
                {devCode ? <Text style={{ marginTop: 8, fontSize: 12.5, fontWeight: '700', color: ED.green }}>{fmt(tr.dev, { code: String(devCode) })}</Text> : null}

                <TextInput
                  value={code}
                  onChangeText={(t) => setCode(t.replace(/[^0-9]/g, '').slice(0, 6))}
                  onFocus={() => setFocus(true)}
                  onBlur={() => setFocus(false)}
                  placeholder="000000"
                  placeholderTextColor="#CFCFC7"
                  selectionColor={ED.green}
                  keyboardType="number-pad"
                  inputMode="numeric"
                  maxLength={6}
                  autoFocus
                  onSubmitEditing={verify}
                  style={{ marginTop: 22, height: 62, borderRadius: 16, backgroundColor: '#fff', borderWidth: focus ? 2 : 1.5, borderColor: focus ? ED.green : '#E7E6DF', textAlign: 'center', fontSize: 26, letterSpacing: 10, fontWeight: '700', color: '#141414' }}
                />

                <Pill label={tr.verify} variant="dark" disabled={!ready} onPress={verify} style={{ marginTop: 18 }} />

                <Pressable onPress={resend} style={{ alignItems: 'center', paddingVertical: 14 }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: ED.green }}>{tr.resend}</Text>
                </Pressable>
              </RiseIn>
            </KeyboardAvoidingView>
          </View>
        </SafeAreaView>
      </EditorialBg>
    </View>
  );
}

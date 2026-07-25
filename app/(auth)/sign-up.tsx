import { useState, type ReactNode } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { X, ArrowRight } from 'lucide-react-native';
import { EditorialBg, RiseIn, MonoKicker, ED } from '@/src/onboarding/editorial/kit';
import { ONBOARDING_IMAGES } from '@/src/onboarding/editorial/images';
import { useAuth } from '@/src/auth/auth-context';
import { useGoogleSignIn } from '@/src/auth/google';
import { useMicrosoftSignIn } from '@/src/auth/microsoft';
import { googleConfigured, microsoftConfigured, MOCK_AUTH } from '@/src/config';
import { notify } from '@/src/ui/alert';
import { useI18n } from '@/src/i18n';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const T = {
  en: {
    kicker: 'Sign in',
    signInTitle: 'Sign in',
    continueGoogle: 'Continue with Google',
    continueOutlook: 'Continue with Outlook',
    couldNotSend: 'Could not send the code. Check your connection and try again.',
    googleNotConfigured: 'Google sign-in isn’t configured yet.',
    outlookNotConfigured: 'Outlook sign-in isn’t configured yet.',
    heading: 'Welcome.\nLet’s begin.',
    subheading: 'No password to invent. We’ll send a code.',
    orUseEmail: 'or use your email',
    invitedPre: 'You were invited as ',
    invitedPost: '. Use this address so your practitioner can find you.',
    emailPlaceholder: 'you@email.com',
    legal: 'By continuing you agree to our terms. We’ll never share your email.',
  },
  fr: {
    kicker: 'Connexion',
    signInTitle: 'Connexion',
    continueGoogle: 'Continuer avec Google',
    continueOutlook: 'Continuer avec Outlook',
    couldNotSend: 'Impossible d’envoyer le code. Vérifiez votre connexion et réessayez.',
    googleNotConfigured: 'La connexion avec Google n’est pas encore configurée.',
    outlookNotConfigured: 'La connexion avec Outlook n’est pas encore configurée.',
    heading: 'Bienvenue.\nCommençons.',
    subheading: 'Aucun mot de passe à inventer. Nous envoyons un code.',
    orUseEmail: 'ou utilisez votre email',
    invitedPre: 'Vous avez été invité en tant que ',
    invitedPost: '. Utilisez cette adresse pour que votre praticien puisse vous retrouver.',
    emailPlaceholder: 'vous@email.com',
    legal: 'En continuant, vous acceptez nos conditions. Nous ne partagerons jamais votre email.',
  },
} as const;

// A tiny Google "G" mark.
function GoogleMark() {
  return (
    <View style={{ width: 22, height: 22, borderRadius: 6, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: 14, fontWeight: '800', color: '#4285F4' }}>G</Text>
    </View>
  );
}
// Outlook 2×2 colored squares.
function OutlookMark() {
  const sq = { width: 9, height: 9 } as const;
  return (
    <View style={{ width: 20, height: 20, flexDirection: 'row', flexWrap: 'wrap', gap: 2 }}>
      <View style={[sq, { backgroundColor: '#f35325' }]} />
      <View style={[sq, { backgroundColor: '#81bc06' }]} />
      <View style={[sq, { backgroundColor: '#05a6f0' }]} />
      <View style={[sq, { backgroundColor: '#ffba08' }]} />
    </View>
  );
}

// Editorial pill for the OAuth providers. dark = ink filled, light = white outline.
function EdAuthButton({ label, leading, onPress, tone }: { label: string; leading: ReactNode; onPress?: () => void; tone: 'dark' | 'light' }) {
  const dark = tone === 'dark';
  return (
    <Pressable
      onPress={onPress}
      style={{ height: 54, borderRadius: 27, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: dark ? ED.ink : '#fff', borderWidth: dark ? 0 : 1.5, borderColor: '#E7E6DF' }}
    >
      {leading}
      <Text style={{ fontSize: 15, fontWeight: '700', color: dark ? '#fff' : '#33352F' }}>{label}</Text>
    </Pressable>
  );
}

// The Google auth hook (expo-auth-session) throws on web when no client id is
// set, so it's isolated in a component that's only mounted when configured.
function GoogleAuthButton() {
  const { locale } = useI18n();
  const tr = T[locale];
  const google = useGoogleSignIn((m) => notify(tr.signInTitle, m));
  return <EdAuthButton tone="dark" label={tr.continueGoogle} leading={<GoogleMark />} onPress={() => google.signIn()} />;
}
function MicrosoftAuthButton() {
  const { locale } = useI18n();
  const tr = T[locale];
  const ms = useMicrosoftSignIn((m) => notify(tr.signInTitle, m));
  return <EdAuthButton tone="light" label={tr.continueOutlook} leading={<OutlookMark />} onPress={() => ms.signIn()} />;
}

export default function SignUp() {
  const insets = useSafeAreaInsets();
  const { locale } = useI18n();
  const tr = T[locale];
  const { startEmailSignIn, devSignIn } = useAuth();
  // An invited patient arrives with the address their practitioner used. Seed
  // the field with it: signing up under a different address creates an account
  // that never links to their practitioner, and they would have no way to know.
  const { email: invitedEmail } = useLocalSearchParams<{ email?: string }>();
  const invited = typeof invitedEmail === 'string' && invitedEmail ? invitedEmail : null;
  const [email, setEmail] = useState(invited ?? '');
  const [focus, setFocus] = useState(false);
  const [busy, setBusy] = useState(false);
  const valid = EMAIL_RE.test(email.trim());

  const sendCode = async () => {
    if (!valid || busy) return;
    const addr = email.trim().toLowerCase();
    setBusy(true);
    try {
      const devCode = await startEmailSignIn(addr);
      router.push({ pathname: '/(auth)/verify', params: { email: addr, ...(devCode ? { devCode } : {}) } });
    } catch {
      notify(tr.signInTitle, tr.couldNotSend);
    } finally {
      setBusy(false);
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
                <X size={18} color="#fff" strokeWidth={2} />
              </Pressable>
            </View>

            <View style={{ flex: 1 }} />

            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
              <RiseIn y={40} duration={700} style={{ backgroundColor: ED.sheet, borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingHorizontal: 26, paddingTop: 26, paddingBottom: insets.bottom + 22 }}>
                <MonoKicker size={10.5} color={ED.green} style={{ marginBottom: 10 }}>{tr.kicker}</MonoKicker>
                <Text style={{ fontSize: 28, fontWeight: '800', color: '#141414', letterSpacing: -0.9, lineHeight: 31 }}>{tr.heading}</Text>
                <Text style={{ marginTop: 8, fontSize: 14.5, color: '#8A8A83', lineHeight: 21 }}>{tr.subheading}</Text>

                <View style={{ marginTop: 22, gap: 10 }}>
                  {googleConfigured ? (
                    <GoogleAuthButton />
                  ) : (
                    <EdAuthButton tone="dark" label={tr.continueGoogle} leading={<GoogleMark />} onPress={() => (MOCK_AUTH ? devSignIn() : notify('Google', tr.googleNotConfigured))} />
                  )}
                  {microsoftConfigured ? (
                    <MicrosoftAuthButton />
                  ) : (
                    <EdAuthButton tone="light" label={tr.continueOutlook} leading={<OutlookMark />} onPress={() => (MOCK_AUTH ? devSignIn() : notify('Outlook', tr.outlookNotConfigured))} />
                  )}

                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 4 }}>
                    <View style={{ height: 1, flex: 1, backgroundColor: '#E7E6DF' }} />
                    <Text style={{ fontSize: 12.5, color: '#B5B5AD' }}>{tr.orUseEmail}</Text>
                    <View style={{ height: 1, flex: 1, backgroundColor: '#E7E6DF' }} />
                  </View>

                  {invited && (
                    <Text style={{ fontSize: 12.5, lineHeight: 18, color: '#6E6E66', paddingHorizontal: 2 }}>
                      {tr.invitedPre}<Text style={{ fontWeight: '700', color: '#141414' }}>{invited}</Text>{tr.invitedPost}
                    </Text>
                  )}

                  <View style={{ height: 54, flexDirection: 'row', alignItems: 'center', borderRadius: 27, backgroundColor: '#fff', borderWidth: focus ? 2 : 1.5, borderColor: focus ? ED.green : '#E7E6DF', paddingLeft: 18, paddingRight: 7 }}>
                    <TextInput
                      value={email}
                      onChangeText={setEmail}
                      onFocus={() => setFocus(true)}
                      onBlur={() => setFocus(false)}
                      placeholder={tr.emailPlaceholder}
                      placeholderTextColor="#B5B5AD"
                      selectionColor={ED.green}
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="email-address"
                      inputMode="email"
                      returnKeyType="go"
                      onSubmitEditing={sendCode}
                      style={{ flex: 1, height: '100%', fontSize: 16, fontWeight: '600', color: '#141414' }}
                    />
                    <Pressable
                      onPress={sendCode}
                      disabled={!valid || busy}
                      style={{ width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 21, backgroundColor: ED.green, opacity: !valid || busy ? 0.4 : 1 }}
                    >
                      <ArrowRight size={18} color="#fff" strokeWidth={2.2} />
                    </Pressable>
                  </View>
                </View>

                <Text style={{ marginTop: 18, textAlign: 'center', fontSize: 12, lineHeight: 18, color: '#AEAEA6' }}>{tr.legal}</Text>
              </RiseIn>
            </KeyboardAvoidingView>
          </View>
        </SafeAreaView>
      </EditorialBg>
    </View>
  );
}

import { useState, type ReactNode } from 'react';
import Svg, { Path } from 'react-native-svg';
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
import { useAppleSignIn } from '@/src/auth/apple';
import { googleConfigured, microsoftConfigured, MOCK_AUTH } from '@/src/config';
import { notify } from '@/src/ui/alert';
import { useI18n, fmt } from '@/src/i18n';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;


/**
 * Google's own four-colour G, drawn as its four paths.
 *
 * It was a capital G in the app's font, in Google blue, on a white square: a
 * letter, not a mark. Next to Microsoft's real four-square logo it read as a
 * placeholder somebody forgot to replace — which is roughly what it was.
 *
 * Using the official artwork is not a liberty here, it is the requirement:
 * Google's Sign-In branding guidelines say the button carries their mark, drawn
 * to their proportions and never recoloured or re-lettered. The four paths are
 * the standard 48×48 asset, which is why the numbers look arbitrary — they are
 * theirs, not ours, and should not be "tidied".
 */
function GoogleMark({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path
        fill="#4285F4"
        d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"
      />
      <Path
        fill="#34A853"
        d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"
      />
      <Path
        fill="#FBBC05"
        d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z"
      />
      <Path
        fill="#EA4335"
        d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"
      />
    </Svg>
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


// The Google auth hook (expo-auth-session) throws on web when no client id is
// set, so it's isolated in a component that's only mounted when configured.
function GoogleAuthButton() {
  const tr = useI18n().t.signUp;
  const google = useGoogleSignIn((m) => notify(tr.kickerSignIn, m));
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={tr.continueGoogle}
      style={[ROUND, { backgroundColor: '#fff', borderColor: '#E7E6DF' }]} onPress={() => google.signIn()}>
      <GoogleMark />
    </Pressable>
  );
}
function MicrosoftAuthButton() {
  const tr = useI18n().t.signUp;
  const ms = useMicrosoftSignIn((m) => notify(tr.kickerSignIn, m));
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={tr.continueOutlook}
      style={[ROUND, { backgroundColor: '#fff', borderColor: '#E7E6DF' }]} onPress={() => ms.signIn()}>
      <OutlookMark />
    </Pressable>
  );
}

// Sign in with Apple, on iOS only. Apple's own button, not a restyled pill:
// App Review holds apps to its button guidelines, and the label is localised by
// the system. First in the list, since 4.8 wants it no less prominent than the
// others.
function AppleAuthButton() {
  const tr = useI18n().t.signUp;
  const apple = useAppleSignIn();
  if (!apple.available) return null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={tr.continueApple}
      style={[ROUND, { backgroundColor: '#000', borderColor: '#000' }]}
      onPress={async () => {
        const r = await apple.signIn();
        // null: they closed the sheet. On success the auth gate takes over.
        if (r && !r.ok) notify(tr.kickerSignIn, r.message ?? tr.appleFailed);
        else if (r?.ok) router.replace('/');
      }}
    >
      <AppleMark />
    </Pressable>
  );
}

// The three ways in, as one row of icons rather than three stacked bars. Each
// keeps an accessibility label, since the words are gone. A provider that is
// not configured for THIS platform is not drawn at all: a button that cannot
// work is worse than a missing one, and App Review treats it as a defect.
const ROUND = { width: 64, height: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 } as const;

function AppleMark({ color = '#fff', size = 22 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        fill={color}
        d="M16.365 1.43c0 1.14-.42 2.2-1.12 3.02-.85.99-2.24 1.76-3.38 1.67-.13-1.1.43-2.26 1.1-3.02.77-.88 2.17-1.6 3.4-1.67zM20.5 17.1c-.55 1.27-.82 1.84-1.53 2.96-.99 1.56-2.39 3.5-4.12 3.51-1.54.02-1.94-1-4.03-.99-2.09.01-2.53 1.01-4.07.99-1.73-.02-3.05-1.77-4.04-3.33C-.02 16.9-.31 11.8 1.4 9.1c1.2-1.92 3.1-3.04 4.89-3.04 1.82 0 2.96 1 4.46 1 1.46 0 2.35-1 4.45-1 1.59 0 3.27.87 4.47 2.36-3.93 2.16-3.29 7.78 1.83 8.68z"
      />
    </Svg>
  );
}

function ProviderRow({ children }: { children: ReactNode }) {
  return <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'center' }}>{children}</View>;
}

export default function SignUp() {
  const insets = useSafeAreaInsets();
  const { t, locale } = useI18n();
  const tr = t.signUp;
  const sent = t.signUpSent;
  const { startEmailSignIn, signInWithReviewCode, devSignIn } = useAuth();
  const tc = t.signUpCode;
  // An invited patient arrives with the address their practitioner used. Seed
  // the field with it: signing up under a different address creates an account
  // that never links to their practitioner, and they would have no way to know.
  //
  // `mode=signin` arrives from "I already have an account". Same screen, but it
  // says "Welcome back." and calls itself sign-in: telling someone who already
  // has an account to create one is a small lie that makes people hesitate.
  const { email: invitedEmail, mode } = useLocalSearchParams<{ email?: string; mode?: string }>();
  const invited = typeof invitedEmail === 'string' && invitedEmail ? invitedEmail : null;
  const returning = mode === 'signin';
  const [email, setEmail] = useState(invited ?? '');
  const [focus, setFocus] = useState(false);
  const [busy, setBusy] = useState(false);
  const valid = EMAIL_RE.test(email.trim());

  // v2 emails a LINK, so there is no code screen to push to. Sending swaps this
  // screen into a "check your email" state and the journey continues in the
  // inbox — app/auth.tsx is where the link lands.
  const [sentTo, setSentTo] = useState<string | null>(null);
  // The store-review address signs in with a code; the server says so.
  const [codeFor, setCodeFor] = useState<string | null>(null);
  const [code, setCode] = useState('');

  const submitCode = async () => {
    if (!codeFor || !code.trim() || busy) return;
    setBusy(true);
    try {
      const r = await signInWithReviewCode(codeFor, code.trim());
      if (r.ok) router.replace('/');
      else notify(tc.kicker, r.message ?? tc.wrong);
    } finally {
      setBusy(false);
    }
  };

  const sendLink = async () => {
    if (!valid || busy) return;
    const addr = email.trim().toLowerCase();
    setBusy(true);
    try {
      const { devUrl, code: wantsCode } = await startEmailSignIn(addr, locale);
      if (wantsCode) {
        setCode('');
        setCodeFor(addr);
        return;
      }
      setSentTo(addr);
      // DEV_AUTH only: the backend hands the link straight back so a local
      // sign-in needs no mail server. Never populated in a real deployment.
      if (devUrl) {
        const q = devUrl.slice(devUrl.indexOf('?'));
        router.replace(`/auth${q}` as never);
      }
    } catch {
      notify(tr.kickerSignIn, tr.couldNotSend);
    } finally {
      setBusy(false);
    }
  };

  // Resending is the same call again — the backend retires the previous link, so
  // only the newest one ever works.
  const resend = async () => {
    if (!sentTo || busy) return;
    setBusy(true);
    try {
      await startEmailSignIn(sentTo, locale);
      notify(sent.kicker, sent.resent);
    } catch {
      notify(tr.kickerSignIn, tr.couldNotSend);
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

            {codeFor ? (
              <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <RiseIn y={40} duration={700} style={{ backgroundColor: ED.sheet, borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingHorizontal: 26, paddingTop: 26, paddingBottom: insets.bottom + 22 }}>
                  <MonoKicker size={10.5} color={ED.green} style={{ marginBottom: 10 }}>{tc.kicker}</MonoKicker>
                  <Text style={{ fontSize: 28, fontWeight: '800', color: '#141414', letterSpacing: -0.9, lineHeight: 31 }}>{tc.title}</Text>
                  <Text style={{ marginTop: 10, fontSize: 14.5, color: '#6E6E66', lineHeight: 21 }}>{fmt(tc.body, { email: codeFor })}</Text>
                  <TextInput
                    value={code}
                    onChangeText={setCode}
                    placeholder={tc.placeholder}
                    placeholderTextColor="#B5B5AD"
                    selectionColor={ED.green}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoFocus
                    textContentType="oneTimeCode"
                    returnKeyType="go"
                    onSubmitEditing={submitCode}
                    accessibilityLabel={tc.placeholder}
                    style={[{ marginTop: 20, height: 54, borderRadius: 27, backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#E7E6DF', paddingHorizontal: 18, fontSize: 18, fontWeight: '700', letterSpacing: 2, color: '#141414' }, Platform.OS === 'web' ? ({ outlineStyle: 'none' } as never) : null]}
                  />
                  <Pressable onPress={submitCode} disabled={!code.trim() || busy} style={{ marginTop: 12, height: 54, borderRadius: 27, backgroundColor: ED.ink, alignItems: 'center', justifyContent: 'center', opacity: !code.trim() || busy ? 0.5 : 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>{tc.submit}</Text>
                  </Pressable>
                  <Pressable onPress={() => setCodeFor(null)} style={{ alignItems: 'center', paddingVertical: 16 }}>
                    <Text style={{ fontSize: 14.5, fontWeight: '600', color: '#6E6E66' }}>{tc.back}</Text>
                  </Pressable>
                </RiseIn>
              </KeyboardAvoidingView>
            ) : sentTo ? (
              <RiseIn y={40} duration={700} style={{ backgroundColor: ED.sheet, borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingHorizontal: 26, paddingTop: 26, paddingBottom: insets.bottom + 22 }}>
                <MonoKicker size={10.5} color={ED.green} style={{ marginBottom: 10 }}>{sent.kicker}</MonoKicker>
                <Text style={{ fontSize: 28, fontWeight: '800', color: '#141414', letterSpacing: -0.9, lineHeight: 31 }}>{sent.title}</Text>
                <Text style={{ marginTop: 10, fontSize: 14.5, color: '#6E6E66', lineHeight: 21 }}>{fmt(sent.body, { email: sentTo })}</Text>
                <Text style={{ marginTop: 12, fontSize: 12.5, color: '#AEAEA6', lineHeight: 18 }}>{sent.spam}</Text>

                <Pressable onPress={resend} disabled={busy} style={{ marginTop: 20, height: 54, borderRadius: 27, backgroundColor: ED.ink, alignItems: 'center', justifyContent: 'center', opacity: busy ? 0.5 : 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>{sent.resend}</Text>
                </Pressable>
                <Pressable onPress={() => setSentTo(null)} style={{ alignItems: 'center', paddingVertical: 16 }}>
                  <Text style={{ fontSize: 14.5, fontWeight: '600', color: '#6E6E66' }}>{sent.changeEmail}</Text>
                </Pressable>
              </RiseIn>
            ) : (
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
              <RiseIn y={40} duration={700} style={{ backgroundColor: ED.sheet, borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingHorizontal: 26, paddingTop: 26, paddingBottom: insets.bottom + 22 }}>
                <MonoKicker size={10.5} color={ED.green} style={{ marginBottom: 10 }}>
                  {returning ? tr.kickerSignIn : tr.kickerCreate}
                </MonoKicker>
                <Text style={{ fontSize: 28, fontWeight: '800', color: '#141414', letterSpacing: -0.9, lineHeight: 31 }}>
                  {returning ? tr.headingSignIn : tr.headingCreate}
                </Text>
                {/* The invited address belongs directly under the headline: it is
                    the single most important thing on this screen for a patient
                    who has three addresses and must pick the one their
                    practitioner used. */}
                {invited && (
                  <>
                    <Text style={{ marginTop: 10, fontSize: 14.5, color: '#6E6E66', lineHeight: 21 }}>
                      {tr.invitedPre}
                      <Text style={{ fontWeight: '700', color: '#141414' }}>{invited}</Text>
                    </Text>
                    <Text style={{ marginTop: 6, fontSize: 12.5, color: '#8A8A83', lineHeight: 18 }}>{tr.invitedNote}</Text>
                  </>
                )}

                <View style={{ marginTop: 22, gap: 10 }}>
                  {/* ORDER IS BY PLATFORM, not by preference.
                      
                      On iOS Apple comes first: guideline 4.8 asks that Sign in
                      with Apple sit no lower than the other options, and on an
                      iPhone it is also the one most people will reach for.
                      Everywhere else it goes last, because Google is the
                      habitual first choice on Android and on the web, and a
                      leading Apple button there reads as an app that thinks it
                      is still on an iPhone.
                      
                      A provider that is not configured on THIS platform is not
                      drawn at all. It used to render anyway and answer a tap
                      with "isn't configured yet", which on a store build is a
                      button that does nothing — and a rejection. The mock
                      stand-ins remain for local work without a backend. */}
                  <ProviderRow>
                    {Platform.OS === 'ios' ? <AppleAuthButton /> : null}
                    {googleConfigured ? (
                      <GoogleAuthButton />
                    ) : MOCK_AUTH ? (
                      <Pressable accessibilityRole="button" accessibilityLabel={tr.continueGoogle}
                        style={[ROUND, { backgroundColor: '#fff', borderColor: '#E7E6DF' }]} onPress={() => devSignIn()}>
                        <GoogleMark />
                      </Pressable>
                    ) : null}
                    {microsoftConfigured ? (
                      <MicrosoftAuthButton />
                    ) : MOCK_AUTH ? (
                      <Pressable accessibilityRole="button" accessibilityLabel={tr.continueOutlook}
                        style={[ROUND, { backgroundColor: '#fff', borderColor: '#E7E6DF' }]} onPress={() => devSignIn()}>
                        <OutlookMark />
                      </Pressable>
                    ) : null}
                    {/* Apple LAST off iOS — and only once the web flow exists.
                        `expo-apple-authentication` is an iOS-only native sheet,
                        so there is nothing to mount here yet: Apple on Android
                        and on the web needs their OAuth redirect flow against a
                        Services ID, which is not built. Drawing the button now
                        would be the exact defect the comment above describes. */}
                  </ProviderRow>

                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 4 }}>
                    <View style={{ height: 1, flex: 1, backgroundColor: '#E7E6DF' }} />
                    <Text style={{ fontSize: 12.5, color: '#B5B5AD' }}>{tr.orUseEmail}</Text>
                    <View style={{ height: 1, flex: 1, backgroundColor: '#E7E6DF' }} />
                  </View>

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
                      onSubmitEditing={sendLink}
                      style={[{ flex: 1, height: '100%', fontSize: 16, fontWeight: '600', color: '#141414' }, Platform.OS === 'web' ? ({ outlineStyle: 'none' } as never) : null]}
                    />
                    <Pressable
                      onPress={sendLink}
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
            )}
          </View>
        </SafeAreaView>
      </EditorialBg>
    </View>
  );
}

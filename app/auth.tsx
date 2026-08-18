import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Platform, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router, useLocalSearchParams } from 'expo-router';
import { EditorialBg, Scrim, RiseIn, MonoKicker, Pill } from '@/src/onboarding/editorial/kit';
import { ONBOARDING_IMAGES } from '@/src/onboarding/editorial/images';
import { useAuth } from '@/src/auth/auth-context';
import { useI18n } from '@/src/i18n';

/**
 * The target of the emailed sign-in link. One route, two jobs:
 *
 *   NATIVE — reached as `bloomsline://auth?token=…`. Exchange the token
 *            immediately; the auth gate then routes by session status.
 *   WEB    — reached as `https://app.bloomsline.com/auth?token=…`. This is the
 *            handoff page: it asks the OS to open the app and waits.
 *
 * On web it deliberately does NOT exchange the token on arrival. The token is
 * single-use, so spending it in the browser would burn the one thing the app
 * needs, and the patient would watch their phone's browser sign in while the app
 * they actually installed stayed logged out. Continuing in the browser is
 * offered, but only if they ask for it.
 */
export default function AuthLink() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const { signInWithLink } = useAuth();
  const { t } = useI18n();
  const T = t.authLink;

  const raw = typeof token === 'string' ? token : '';
  const isWeb = Platform.OS === 'web';
  const [state, setState] = useState<'working' | 'handoff' | 'failed'>(isWeb ? 'handoff' : 'working');
  // The server's reason, when it has one worth reading (waitlisted, suspended).
  const [reason, setReason] = useState<string | null>(null);

  const exchange = useCallback(async () => {
    setState('working');
    if (!raw) return setState('failed');
    const r = await signInWithLink(raw);
    if (r.ok) {
      // Go to the index gate, which routes by session status (practitioner home,
      // onboarding, or the patient's chosen tab).
      //
      // This MUST be explicit. `/auth` is a ROOT route: the (auth) and
      // (onboarding) layouts only guard their own groups, so nothing here
      // redirects on a status change. An earlier version relied on "the gates
      // take over" and left every successful sign-in spinning forever — the
      // failure paths all worked, which is exactly why it went unnoticed.
      router.replace('/');
      return;
    }
    setReason(r.message ?? null);
    setState('failed');
  }, [raw, signInWithLink]);

  useEffect(() => {
    if (!raw) return setState('failed');
    if (isWeb) {
      // Ask the OS for the app. If it is installed this page is left behind; if
      // not, nothing observable happens and the handoff copy stays put. There is
      // no reliable way to detect which, so we never guess — we just offer both.
      //
      // Only on a touch device, though. A desktop browser cannot have the app
      // installed, and firing a custom scheme there opens a stray blank tab —
      // which is what it did before this guard.
      const touch = typeof navigator !== 'undefined' && (navigator.maxTouchPoints ?? 0) > 0;
      if (touch) Linking.openURL(`bloomsline://auth?token=${encodeURIComponent(raw)}`).catch(() => {});
      return;
    }
    void exchange();
  }, [raw, isWeb, exchange]);

  return (
    <View style={{ flex: 1 }}>
      <StatusBar style="light" />
      <EditorialBg source={ONBOARDING_IMAGES.splash} zoom>
        <Scrim colors={['rgba(16,18,16,0.62)', 'rgba(16,18,16,0.42)', 'rgba(16,18,16,0.94)']} locations={[0, 0.38, 1]} />
        <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1 }}>
          <View style={{ flex: 1, justifyContent: 'flex-end', paddingHorizontal: 28, paddingBottom: 30 }}>
            <RiseIn>
              <MonoKicker color="rgba(255,255,255,0.6)" style={{ marginBottom: 14 }}>{T.kicker}</MonoKicker>
              <Text style={{ fontSize: 30, fontWeight: '800', color: '#fff', letterSpacing: -1.1, lineHeight: 34 }}>
                {state === 'failed' ? (reason ? T.blockedTitle : T.failedTitle) : T.title}
              </Text>
              <Text style={{ marginTop: 12, fontSize: 15, color: 'rgba(255,255,255,0.82)', lineHeight: 23, maxWidth: 320 }}>
                {state === 'failed'
                  ? (reason ?? T.failedBody)
                  : state === 'working'
                    ? T.workingBody
                    : T.handoffBody}
              </Text>
            </RiseIn>

            <RiseIn delay={300} style={{ marginTop: 26 }}>
              {state === 'working' ? (
                <View style={{ height: 54, alignItems: 'center', justifyContent: 'center' }}>
                  <ActivityIndicator color="#fff" />
                </View>
              ) : state === 'handoff' ? (
                <Pill label={T.continueHere} variant="white" onPress={exchange} />
              ) : reason ? (
                // A waitlisted or suspended account does not need another link,
                // so the way out is the door, not a retry.
                <Pill label={T.back} variant="white" onPress={() => router.replace('/(auth)/welcome')} />
              ) : (
                <Pill label={T.startOver} variant="white" onPress={() => router.replace('/(auth)/sign-up')} />
              )}
            </RiseIn>
          </View>
        </SafeAreaView>
      </EditorialBg>
    </View>
  );
}

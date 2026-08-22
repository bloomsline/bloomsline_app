import '../global.css';
import '@/src/ui/text-global'; // Manrope as the app-wide default Text font
import { Platform, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as WebBrowser from 'expo-web-browser';
import { useFonts } from 'expo-font';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '@/src/auth/auth-context';
import { OnboardingProvider } from '@/src/onboarding/context';
import { LandingProvider } from '@/src/prefs/landing';
import { I18nProvider } from '@/src/i18n';
import { ConfirmProvider } from '@/src/ui/confirm';
import { ThemeProvider, useTheme } from '@/src/ui/theme-mode';
import { FONT_ASSETS } from '@/src/ui/fonts';

// MUST be at the ROOT, not only in the auth modules that start the flow.
//
// On web the OAuth popup redirects back to our ORIGIN (`/?code=...`), not to the
// screen that opened it. That lands on app/index, so `src/auth/google.ts` is
// never imported and its own maybeCompleteAuthSession never runs — the popup
// then boots a second copy of the app and shows the welcome screen inside
// itself instead of closing and handing the result back to the opener.
//
// Calling it here runs it on whatever route the popup lands on. Safe to call
// more than once, and a no-op when there is no auth response in the URL.
WebBrowser.maybeCompleteAuthSession();

// On web, constrain the app to a centered phone-width column so the preview
// reads like a real device instead of stretching across the whole browser.
// No-op on native.
function PhoneFrame({ children }: { children: React.ReactNode }) {
  const { t, mode } = useTheme();
  if (Platform.OS !== 'web') return <>{children}</>;
  return (
    <View style={{ flex: 1, backgroundColor: mode === 'dark' ? '#0A0F0D' : '#E7E7E4', alignItems: 'center' }}>
      <View style={{ flex: 1, width: '100%', maxWidth: 420, backgroundColor: t.bg, overflow: 'hidden' }}>{children}</View>
    </View>
  );
}

/**
 * Everything that needs to know the theme, inside the provider.
 *
 * `ready` is the stored-preference gate: until the saved choice has been read
 * back we render the ground colour and nothing else. Skipping that is how a
 * themed app ships the flash where it paints light, then snaps to dark a frame
 * later — worst for exactly the users who went and set the preference.
 */
function Themed() {
  const { t, mode, ready } = useTheme();
  if (!ready) return <View style={{ flex: 1, backgroundColor: t.bg }} />;
  return (
    <>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      <PhoneFrame>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.bg } }} />
      </PhoneFrame>
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts(FONT_ASSETS);
  // Hold render until the type is ready, so nothing flashes in the system font.
  if (!fontsLoaded) return <View style={{ flex: 1, backgroundColor: '#E4E2DB' }} />;
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <I18nProvider>
          <OnboardingProvider>
            <LandingProvider>
              {/* ThemeProvider wraps ConfirmProvider, not the other way round:
                  ConfirmProvider renders themed UI of its own, so it has to be
                  INSIDE. Nesting it outside typechecks perfectly and throws on
                  first paint. */}
              <ThemeProvider>
                <ConfirmProvider>
                  <Themed />
                </ConfirmProvider>
              </ThemeProvider>
            </LandingProvider>
          </OnboardingProvider>
        </I18nProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

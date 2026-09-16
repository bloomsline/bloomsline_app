import '../global.css';
import '@/src/ui/text-global'; // Manrope as the app-wide default Text font
import { Platform, View, useColorScheme } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as WebBrowser from 'expo-web-browser';
import { useFonts } from 'expo-font';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '@/src/auth/auth-context';
import { OnboardingProvider } from '@/src/onboarding/context';
import { SelectedPractitionerProvider } from '@/src/care/selected-practitioner';
import { AppPrefsProvider } from '@/src/prefs/app-prefs';
import { I18nProvider } from '@/src/i18n';
import { AnalyticsProvider } from '@/src/analytics/provider';
import { ConfirmProvider } from '@/src/ui/confirm';
import { ThemeProvider, useTheme } from '@/src/ui/theme-mode';
import { FONT_ASSETS } from '@/src/ui/fonts';
import { DARK, LIGHT } from '@/src/ui/tokens';

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
  const systemDark = useColorScheme() === 'dark';
  // Hold render until the type is ready, so nothing flashes in the system font.
  // Before fonts, before the theme is read: follow the system, so a dark-mode
  // phone does not open on a light screen. (The saved choice takes over a moment
  // later, in `Themed`.) The theme's own grounds, not copies of them that drift.
  if (!fontsLoaded) return <View style={{ flex: 1, backgroundColor: systemDark ? DARK.bg : LIGHT.bg }} />;
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <I18nProvider>
          {/* Inside Auth (it keys on the session) and OUTSIDE Onboarding: the
              practitioner name every screen reads from onboarding follows the
              selection, so onboarding has to be able to see it. */}
          <SelectedPractitionerProvider>
            <OnboardingProvider>
              <AppPrefsProvider>
                {/* ThemeProvider wraps ConfirmProvider, not the other way round:
                    ConfirmProvider renders themed UI of its own, so it has to be
                    INSIDE. Nesting it outside typechecks perfectly and throws on
                    first paint. */}
                <ThemeProvider>
                  <ConfirmProvider>
                    {/* Analytics sits INSIDE the theme and the confirm dialog:
                        it renders a sheet of its own (the consent question) and
                        reads the router's path for screen names. It is the last
                        wrapper, so nothing in the app can depend on it. */}
                    <AnalyticsProvider>
                      <Themed />
                    </AnalyticsProvider>
                  </ConfirmProvider>
                </ThemeProvider>
              </AppPrefsProvider>
            </OnboardingProvider>
          </SelectedPractitionerProvider>
        </I18nProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

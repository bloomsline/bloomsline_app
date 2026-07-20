import '../global.css';
import { Platform, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as WebBrowser from 'expo-web-browser';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '@/src/auth/auth-context';
import { OnboardingProvider } from '@/src/onboarding/context';

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
  if (Platform.OS !== 'web') return <>{children}</>;
  return (
    <View style={{ flex: 1, backgroundColor: '#E7E7E4', alignItems: 'center' }}>
      <View style={{ flex: 1, width: '100%', maxWidth: 420, backgroundColor: '#fff', overflow: 'hidden' }}>{children}</View>
    </View>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <OnboardingProvider>
          <StatusBar style="dark" />
          <PhoneFrame>
            <Stack screenOptions={{ headerShown: false }} />
          </PhoneFrame>
        </OnboardingProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

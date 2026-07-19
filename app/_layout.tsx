import '../global.css';
import { Platform, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '@/src/auth/auth-context';
import { OnboardingProvider } from '@/src/onboarding/context';

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

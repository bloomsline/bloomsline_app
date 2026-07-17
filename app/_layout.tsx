import '../global.css';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '@/src/auth/auth-context';
import { OnboardingProvider } from '@/src/onboarding/context';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <OnboardingProvider>
          <StatusBar style="dark" />
          <Stack screenOptions={{ headerShown: false }} />
        </OnboardingProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

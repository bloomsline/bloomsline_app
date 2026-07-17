import { Redirect, Stack } from 'expo-router';
import { useAuth } from '@/src/auth/auth-context';

export default function OnboardingLayout() {
  const { status } = useAuth();
  if (status === 'anon') return <Redirect href="/(auth)/welcome" />;
  if (status === 'authed') return <Redirect href="/(app)/home" />;
  return <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />;
}

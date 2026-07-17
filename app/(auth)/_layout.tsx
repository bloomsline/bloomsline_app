import { Redirect, Stack } from 'expo-router';
import { useAuth } from '@/src/auth/auth-context';

export default function AuthLayout() {
  const { status } = useAuth();
  if (status === 'authed') return <Redirect href="/(app)/home" />;
  if (status === 'onboarding') return <Redirect href="/(onboarding)/start" />;
  return <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />;
}

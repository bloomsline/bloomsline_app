import { Redirect, Stack } from 'expo-router';
import { useAuth } from '@/src/auth/auth-context';

// Protected group: anything under (app) requires a session.
export default function AppLayout() {
  const { status } = useAuth();
  if (status !== 'authed') return <Redirect href="/(auth)/sign-in" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}

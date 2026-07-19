import { Redirect, Stack } from 'expo-router';
import { useAuth } from '@/src/auth/auth-context';
import { hrefForStatus } from '@/src/auth/route';

export default function AppLayout() {
  const { status } = useAuth();
  if (status !== 'loading' && status !== 'authed') return <Redirect href={hrefForStatus(status)} />;
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="capture" options={{ presentation: 'modal' }} />
      <Stack.Screen name="session-menu" options={{ presentation: 'transparentModal', animation: 'fade' }} />
    </Stack>
  );
}

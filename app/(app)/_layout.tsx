import { Redirect, Stack, usePathname } from 'expo-router';
import { useAuth } from '@/src/auth/auth-context';
import { rememberRoute } from '@/src/auth/pending-route';
import { hrefForStatus } from '@/src/auth/route';

export default function AppLayout() {
  const { status } = useAuth();
  const pathname = usePathname();
  if (status !== 'loading' && status !== 'authed') {
    // Remember where they were headed (an emailed exercise link, typically) so
    // signing in resumes it instead of dropping them on their home tab.
    rememberRoute(pathname);
    return <Redirect href={hrefForStatus(status)} />;
  }
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="capture" options={{ presentation: 'modal' }} />
      <Stack.Screen name="session-menu" options={{ presentation: 'transparentModal', animation: 'fade' }} />
    </Stack>
  );
}

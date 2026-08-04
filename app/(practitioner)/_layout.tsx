import { Redirect, Stack } from 'expo-router';
import { useAuth } from '@/src/auth/auth-context';
import { hrefForStatus } from '@/src/auth/route';
import { NoteDraftProvider } from '@/src/notes/draft';

export default function PractitionerLayout() {
  const { status } = useAuth();
  if (status !== 'loading' && status !== 'practitioner') return <Redirect href={hrefForStatus(status)} />;
  // The draft lives above the screens so a minimised note survives navigating
  // away from the editor — which is the whole point of minimising it.
  return (
    <NoteDraftProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </NoteDraftProvider>
  );
}

import { useEffect } from 'react';
import { Redirect, Stack } from 'expo-router';
import { useAuth } from '@/src/auth/auth-context';
import { takeRestored } from '@/src/auth/restored-notice';
import { notify } from '@/src/ui/alert';
import { useI18n } from '@/src/i18n';
import { hrefForStatus } from '@/src/auth/route';
import { NoteDraftProvider } from '@/src/notes/draft';

export default function PractitionerLayout() {
  const { status } = useAuth();
  const { t } = useI18n();
  // This sign-in cancelled a deletion request (Settings > Delete account): say
  // so, once, as the patient app does.
  useEffect(() => {
    if (status === 'practitioner' && takeRestored()) notify(t.settings.restoredTitle, t.settings.restoredBody);
  }, [status, t]);
  if (status !== 'loading' && status !== 'practitioner') return <Redirect href={hrefForStatus(status)} />;
  // The draft lives above the screens so a minimised note survives navigating
  // away from the editor — which is the whole point of minimising it.
  return (
    <NoteDraftProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </NoteDraftProvider>
  );
}

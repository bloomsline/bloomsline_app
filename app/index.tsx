import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '@/src/auth/auth-context';
import { hrefForStatus } from '@/src/auth/route';
import { useLanding, LANDING_HREF } from '@/src/prefs/landing';

// Entry gate: route by session status (anon / practitioner / onboarding / authed).
// An authed patient lands on their chosen home tab (My Care or Moments).
export default function Index() {
  const { status } = useAuth();
  const { landing, ready } = useLanding();
  // Hold the spinner until the stored landing preference is read, so we don't
  // flash the default tab and then jump to the chosen one.
  if (status === 'loading' || (status === 'authed' && !ready)) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator color="#4A9A86" />
      </View>
    );
  }
  if (status === 'authed') return <Redirect href={LANDING_HREF[landing] as never} />;
  return <Redirect href={hrefForStatus(status)} />;
}

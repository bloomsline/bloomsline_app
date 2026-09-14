import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '@/src/auth/auth-context';
import { hrefForStatus } from '@/src/auth/route';
import { takeRoute } from '@/src/auth/pending-route';
import { useLanding, LANDING_HREF } from '@/src/prefs/app-prefs';
import { useTheme } from '@/src/ui/theme-mode';

// Entry gate: route by session status (anon / practitioner / onboarding / authed).
// An authed patient lands on their chosen home tab (My Care or Moments).
export default function Index() {
  const { status } = useAuth();
  const { landing, ready } = useLanding();
  const { t: TT } = useTheme();
  // Hold the spinner until the stored landing preference is read, so we don't
  // flash the default tab and then jump to the chosen one.
  if (status === 'loading' || (status === 'authed' && !ready)) {
    return (
      // The theme's own ground. `bg-white` flashed a white screen at every dark-
      // mode launch and sign-in, for as long as the account took to resolve.
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: TT.bg }}>
        <ActivityIndicator color={TT.accent} />
      </View>
    );
  }
  if (status === 'authed') {
    // If they arrived on a link before signing in (an emailed exercise, say),
    // finish that journey rather than dropping them on the default tab.
    const resume = takeRoute();
    if (resume) return <Redirect href={resume as never} />;
    return <Redirect href={LANDING_HREF[landing] as never} />;
  }
  return <Redirect href={hrefForStatus(status)} />;
}

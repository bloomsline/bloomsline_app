import { useEffect } from 'react';
import { Redirect, Stack, usePathname, useRouter } from 'expo-router';
import { useAuth } from '@/src/auth/auth-context';
import { rememberRoute } from '@/src/auth/pending-route';
import { hrefForStatus } from '@/src/auth/route';
import { useLanding, LANDING_HREF } from '@/src/prefs/landing';

/** The three tab routes. Only these are subject to the landing preference — a
 *  resource link, a journal entry or a session sheet is somewhere the patient
 *  asked to be, and must open where it points. */
const TAB_PATHS: Record<string, true> = { '/home': true, '/moments': true, '/for-you': true };

/**
 * Has the landing preference had its say yet, this run?
 *
 * Module scope on purpose: it must survive re-renders and in-app navigation,
 * and reset only when the JS context does — which is exactly "the app was
 * opened". A ref would reset with the component; state would re-run the check
 * on every tab change and bounce the patient home the moment they left it.
 */
let entryDecided = false;

export default function AppLayout() {
  const { status } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const { landing, ready } = useLanding();

  // Opening the app on a tab honours "Home screen", however it was opened.
  //
  // `app/index.tsx` reads the preference and redirects — but only routes that
  // pass through `/` ever reach it, and most openings do not. The web app is a
  // single-page export, so a reopened browser tab, a bookmark or a PWA resume
  // enters straight at the last URL and index.tsx never runs. Set My Care as
  // home, close the app on Moments, reopen: Moments, every time.
  //
  // Imperative rather than a `<Redirect>` returned from this layout: returning
  // one unmounts the Stack and remounts it a frame later, and there is no
  // reason to tear the navigator down to change which tab is showing.
  //
  // Runs ONCE per app start and only on the three tab routes, so navigating to
  // Moments afterwards stays on Moments.
  useEffect(() => {
    if (entryDecided || status !== 'authed' || !ready) return;
    entryDecided = true;
    if (!TAB_PATHS[pathname]) return;
    const want = LANDING_HREF[landing];
    if (!want.endsWith(pathname)) router.replace(want as never);
  }, [status, ready, pathname, landing, router]);

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

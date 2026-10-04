import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useSelectedPractitioner } from '@/src/care/selected-practitioner';
import { turnedAway, type Feature } from '@/src/care/shape';

/**
 * Send a child's or a guardian's view back to My Care from a screen that is not
 * theirs (guardian plan, phase 6), however it was reached: a deep link, a link
 * in an email, a route remembered across sign-in. The server refuses the data
 * anyway; this spares them an empty or failing screen. A patient, and an
 * account with no practitioner, are never turned away.
 */
export function useFeatureGuard(feature: Feature): void {
  const { shape, ready } = useSelectedPractitioner();
  const router = useRouter();
  useEffect(() => {
    if (ready && turnedAway(shape, feature)) router.replace('/home' as never);
  }, [ready, shape, feature, router]);
}

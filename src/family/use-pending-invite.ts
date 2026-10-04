import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { pendingFamilyInvite } from '@/src/auth/family-invite';

/**
 * Signed in (or onboarding) with a guardian's or child's invitation still
 * pending: back to the invitation, where it is accepted by a tap that names the
 * child. Used by BOTH the app and the onboarding layouts: a brand-new parent or
 * child signs up into onboarding, and accepting first is what lets onboarding
 * greet them with their practitioner and tell a child, there and then, that
 * their parent or guardian cannot see what they write.
 */
export function usePendingInviteRedirect(active: boolean): void {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    let alive = true;
    void pendingFamilyInvite().then((p) => {
      if (alive && p) router.push(`/${p.kind}/${encodeURIComponent(p.token)}` as never);
    });
    return () => { alive = false; };
  }, [active, router]);
}

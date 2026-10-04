import { Redirect, Stack } from 'expo-router';
import { useAuth } from '@/src/auth/auth-context';
import { hrefForStatus } from '@/src/auth/route';
import { usePendingInviteRedirect } from '@/src/family/use-pending-invite';

export default function OnboardingLayout() {
  const { status } = useAuth();
  // Before onboarding asks anything: accept the invitation this sign-up was for.
  usePendingInviteRedirect(status === 'onboarding');
  if (status !== 'loading' && status !== 'onboarding') return <Redirect href={hrefForStatus(status)} />;
  // Soft cross-fade between the full-bleed editorial screens (not a hard slide),
  // so each screen dissolves into the next; the per-screen RiseIn motion then
  // carries the content in.
  return <Stack screenOptions={{ headerShown: false, animation: 'fade', animationDuration: 480 }} />;
}

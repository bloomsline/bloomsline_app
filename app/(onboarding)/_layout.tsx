import { Redirect, Stack } from 'expo-router';
import { useAuth } from '@/src/auth/auth-context';
import { hrefForStatus } from '@/src/auth/route';

export default function OnboardingLayout() {
  const { status } = useAuth();
  if (status !== 'loading' && status !== 'onboarding') return <Redirect href={hrefForStatus(status)} />;
  return <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />;
}

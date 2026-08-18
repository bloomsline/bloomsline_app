import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useOnboarding } from '@/src/onboarding/context';

// Waits for the profile to resolve, then enters the flow at "about you".
//
// v2 dropped the splash screen. An invited patient already learned who invited
// them on the pre-auth invite screen, so repeating it after sign-in was a beat
// that earned nothing. `splash.tsx` stays in the tree but nothing routes to it.
export default function OnboardingStart() {
  const { resolved } = useOnboarding();
  if (!resolved) {
    return (
      <View className="flex-1 items-center justify-center bg-surface">
        <ActivityIndicator color="#009B8E" />
      </View>
    );
  }
  return <Redirect href="/(onboarding)/about-you" />;
}

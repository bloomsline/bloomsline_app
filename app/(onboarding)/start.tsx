import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useOnboarding } from '@/src/onboarding/context';

// Decides the branch once the profile has resolved: Flow A (has practitioner)
// begins at the name step; Flow B (solo) goes straight to the arrival screen.
export default function OnboardingStart() {
  const { resolved, hasPractitioner } = useOnboarding();
  if (!resolved) {
    return (
      <View className="flex-1 items-center justify-center bg-surface">
        <ActivityIndicator color="#009B8E" />
      </View>
    );
  }
  return <Redirect href={hasPractitioner ? '/(onboarding)/name' : '/(onboarding)/arrival'} />;
}

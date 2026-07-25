import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useOnboarding } from '@/src/onboarding/context';

// Waits for the profile to resolve, then enters the 5-step flow at the welcome
// screen (both the invited and solo variants start there).
export default function OnboardingStart() {
  const { resolved } = useOnboarding();
  if (!resolved) {
    return (
      <View className="flex-1 items-center justify-center bg-surface">
        <ActivityIndicator color="#009B8E" />
      </View>
    );
  }
  return <Redirect href="/(onboarding)/splash" />;
}

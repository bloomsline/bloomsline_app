import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '@/src/auth/auth-context';

// Entry gate: route by session phase.
export default function Index() {
  const { status } = useAuth();
  if (status === 'loading') {
    return (
      <View className="flex-1 items-center justify-center bg-surface">
        <ActivityIndicator color="#009B8E" />
      </View>
    );
  }
  const href = status === 'authed' ? '/(app)/home' : status === 'onboarding' ? '/(onboarding)/start' : '/(auth)/welcome';
  return <Redirect href={href} />;
}

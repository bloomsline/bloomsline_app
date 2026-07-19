import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '@/src/auth/auth-context';
import { hrefForStatus } from '@/src/auth/route';

// Entry gate: route by session status (anon / practitioner / onboarding / authed).
export default function Index() {
  const { status } = useAuth();
  if (status === 'loading') {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator color="#4A9A86" />
      </View>
    );
  }
  return <Redirect href={hrefForStatus(status)} />;
}

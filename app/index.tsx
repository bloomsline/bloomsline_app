import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '@/src/auth/auth-context';

// Entry gate: send the user to the app or to sign-in based on session state.
export default function Index() {
  const { status } = useAuth();
  if (status === 'loading') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#0d9488" />
      </View>
    );
  }
  return <Redirect href={status === 'authed' ? '/(app)/home' : '/(auth)/sign-in'} />;
}

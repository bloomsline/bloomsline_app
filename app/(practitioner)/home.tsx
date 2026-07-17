import { Alert, Platform, Text, View } from 'react-native';
import { Stethoscope } from 'lucide-react-native';
import { Screen } from '@/src/ui/Screen';
import { Button } from '@/src/ui/Button';
import { useAuth } from '@/src/auth/auth-context';

// Placeholder practitioner home. A practitioner account lands here (routed by
// role after sign-in). The full practitioner app is a later build.
export default function PractitionerHome() {
  const { signOut } = useAuth();

  const confirmSignOut = () => {
    if (Platform.OS === 'web') {
      if (globalThis.confirm?.('Sign out?')) signOut();
      return;
    }
    Alert.alert('Account', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => signOut() },
    ]);
  };

  return (
    <Screen bg="bg-white" className="px-7">
      <View className="flex-1 items-center justify-center">
        <View className="h-16 w-16 items-center justify-center rounded-2xl bg-brand-tint">
          <Stethoscope size={28} color="#4A9A86" strokeWidth={2} />
        </View>
        <Text className="mt-5 text-[22px] font-bold tracking-[-0.4px] text-ink">Practitioner app</Text>
        <Text className="mt-2 max-w-[280px] text-center text-[15px] leading-[22px] text-muted">
          You’re signed in as a practitioner. Your practice tools are coming here soon.
        </Text>
      </View>
      <View className="pb-8">
        <Button label="Sign out" variant="secondary" onPress={confirmSignOut} />
      </View>
    </Screen>
  );
}

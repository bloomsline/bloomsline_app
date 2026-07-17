import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Alert, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import { Screen, IconButton } from '@/src/ui/Screen';
import { Button } from '@/src/ui/Button';
import { useAuth } from '@/src/auth/auth-context';

// Email one-time-code step. On success the session becomes `onboarding`, and the
// (auth) layout redirects into the onboarding flow.
export default function Verify() {
  const { email } = useLocalSearchParams<{ email: string }>();
  const { verifyEmailCode, startEmailSignIn } = useAuth();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const ready = code.trim().length === 6;

  const verify = async () => {
    if (!ready || busy || !email) return;
    setBusy(true);
    try {
      const ok = await verifyEmailCode(email, code.trim());
      if (!ok) Alert.alert('Verify', 'That code is invalid or expired. Request a new one.');
    } catch {
      Alert.alert('Verify', 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    if (!email) return;
    try {
      await startEmailSignIn(email);
      Alert.alert('Verify', 'We sent a new code.');
    } catch {
      Alert.alert('Verify', 'Could not resend the code.');
    }
  };

  return (
    <Screen bg="bg-white" className="px-6">
      <View className="pt-2">
        <IconButton icon={ChevronLeft} tone="teal" onPress={() => router.back()} />
      </View>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 justify-center">
        <Text className="text-[28px] font-bold tracking-[-0.5px] text-ink">Enter your code</Text>
        <Text className="mt-2 text-[15px] leading-[22px] text-muted">
          We emailed a 6-digit code to {email}. It expires in 10 minutes.
        </Text>
        <TextInput
          value={code}
          onChangeText={(t) => setCode(t.replace(/[^0-9]/g, '').slice(0, 6))}
          placeholder="000000"
          placeholderTextColor="#CCCCCC"
          selectionColor="#009B8E"
          keyboardType="number-pad"
          inputMode="numeric"
          maxLength={6}
          autoFocus
          onSubmitEditing={verify}
          className="mt-7 h-[60px] rounded-2xl border border-[#E5E5E5] text-center text-[26px] tracking-[10px] text-ink"
        />
        <View className="mt-4">
          <Button label="Verify" onPress={verify} loading={busy} disabled={!ready} />
        </View>
        <Pressable onPress={resend} className="items-center py-3">
          <Text className="text-[15px] font-semibold text-brand">Resend code</Text>
        </Pressable>
      </KeyboardAvoidingView>
    </Screen>
  );
}

import { useState } from 'react';
import { router } from 'expo-router';
import { Alert, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { X, ArrowRight } from 'lucide-react-native';
import { Screen, IconButton } from '@/src/ui/Screen';
import { Button } from '@/src/ui/Button';
import { useAuth } from '@/src/auth/auth-context';
import { useGoogleSignIn } from '@/src/auth/google';
import { useMicrosoftSignIn } from '@/src/auth/microsoft';
import { googleConfigured, microsoftConfigured, MOCK_AUTH } from '@/src/config';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// A tiny Google "G" mark.
function GoogleMark() {
  return (
    <View className="h-6 w-6 items-center justify-center rounded-md bg-white">
      <Text className="text-[15px] font-bold text-[#4285F4]">G</Text>
    </View>
  );
}
// Outlook 2×2 colored squares.
function OutlookMark() {
  const sq = 'h-[9px] w-[9px]';
  return (
    <View className="h-[20px] w-[20px] flex-row flex-wrap gap-[2px]">
      <View className={`${sq} bg-[#f35325]`} />
      <View className={`${sq} bg-[#81bc06]`} />
      <View className={`${sq} bg-[#05a6f0]`} />
      <View className={`${sq} bg-[#ffba08]`} />
    </View>
  );
}

// The Google auth hook (expo-auth-session) throws on web when no client id is
// set, so it's isolated in a component that's only mounted when configured.
function GoogleAuthButton() {
  const google = useGoogleSignIn((m) => Alert.alert('Sign in', m));
  return <Button label="Continue with Google" variant="dark" leading={<GoogleMark />} onPress={() => google.signIn()} />;
}
function MicrosoftAuthButton() {
  const ms = useMicrosoftSignIn((m) => Alert.alert('Sign in', m));
  return <Button label="Continue with Outlook" variant="secondary" leading={<OutlookMark />} onPress={() => ms.signIn()} />;
}

export default function SignUp() {
  const { startEmailSignIn, devSignIn } = useAuth();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const valid = EMAIL_RE.test(email.trim());

  const sendCode = async () => {
    if (!valid || busy) return;
    const addr = email.trim().toLowerCase();
    setBusy(true);
    try {
      await startEmailSignIn(addr);
      router.push({ pathname: '/(auth)/verify', params: { email: addr } });
    } catch {
      Alert.alert('Sign in', 'Could not send the code. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen bg="bg-white" className="px-6">
      <View className="pt-2">
        <IconButton icon={X} onPress={() => router.back()} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 justify-center">
        <Text className="text-[30px] font-bold tracking-[-0.5px] text-ink">Let’s get you set up</Text>
        <Text className="mt-2 text-[16px] text-muted">No password to invent. We’ll send a link.</Text>

        <View className="mt-8 gap-3">
          {googleConfigured ? (
            <GoogleAuthButton />
          ) : (
            <Button label="Continue with Google" variant="dark" leading={<GoogleMark />} onPress={() => (MOCK_AUTH ? devSignIn() : Alert.alert('Google', 'Google sign-in isn’t configured yet.'))} />
          )}
          {microsoftConfigured ? (
            <MicrosoftAuthButton />
          ) : (
            <Button label="Continue with Outlook" variant="secondary" leading={<OutlookMark />} onPress={() => (MOCK_AUTH ? devSignIn() : Alert.alert('Outlook', 'Outlook sign-in isn’t configured yet.'))} />
          )}

          <View className="my-2 flex-row items-center gap-3">
            <View className="h-px flex-1 bg-[#eee]" />
            <Text className="text-[13px] text-[#ccc]">or use your email</Text>
            <View className="h-px flex-1 bg-[#eee]" />
          </View>

          <View className="h-14 flex-row items-center rounded-[28px] border border-[#E5E5E5] pl-5 pr-2">
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@email.com"
              placeholderTextColor="#BBBBBB"
              selectionColor="#009B8E"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              inputMode="email"
              returnKeyType="go"
              onSubmitEditing={sendCode}
              className="h-full flex-1 text-[16px] text-ink"
            />
            <Pressable
              onPress={sendCode}
              disabled={!valid || busy}
              className={`h-11 w-11 items-center justify-center rounded-full bg-brand ${!valid || busy ? 'opacity-40' : ''}`}
            >
              <ArrowRight size={18} color="#fff" strokeWidth={2.2} />
            </Pressable>
          </View>
        </View>

        <Text className="mt-6 text-center text-[12.5px] leading-[18px] text-[#AEAEAE]">
          By continuing you agree to our terms. We’ll never share your email.
        </Text>
      </KeyboardAvoidingView>
    </Screen>
  );
}

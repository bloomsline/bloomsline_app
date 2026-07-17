import { useState } from 'react';
import { router } from 'expo-router';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/src/auth/auth-context';
import { useGoogleSignIn } from '@/src/auth/google';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignIn() {
  const { startEmailSignIn } = useAuth();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const google = useGoogleSignIn((m) => Alert.alert('Sign in', m));
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
    <SafeAreaView style={styles.safe}>
      <View style={styles.body}>
        <Text style={styles.wordmark}>
          blooms<Text style={{ color: '#0d9488' }}>line</Text>
        </Text>
        <Text style={styles.title}>Welcome</Text>
        <Text style={styles.subtitle}>Sign in to continue. We&apos;ll email you a one-time code.</Text>

        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="you@email.com"
          placeholderTextColor="#9ca3af"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          inputMode="email"
          style={styles.input}
          onSubmitEditing={sendCode}
          returnKeyType="go"
        />

        <Pressable onPress={sendCode} disabled={!valid || busy} style={[styles.primary, (!valid || busy) && styles.disabled]}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Email me a code</Text>}
        </Pressable>

        {google.available && (
          <>
            <View style={styles.divider}>
              <View style={styles.line} />
              <Text style={styles.or}>or</Text>
              <View style={styles.line} />
            </View>
            <Pressable onPress={google.signIn} style={styles.secondary}>
              <Text style={styles.secondaryText}>Continue with Google</Text>
            </Pressable>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#ffffff' },
  body: { flex: 1, paddingHorizontal: 28, justifyContent: 'center', gap: 12 },
  wordmark: { fontSize: 22, fontWeight: '800', color: '#171717', marginBottom: 8 },
  title: { fontSize: 28, fontWeight: '700', color: '#171717' },
  subtitle: { fontSize: 15, color: '#6b7280', marginBottom: 12, lineHeight: 22 },
  input: { height: 52, borderRadius: 14, borderWidth: 1, borderColor: '#e5e7eb', paddingHorizontal: 16, fontSize: 16, color: '#111827' },
  primary: { height: 52, borderRadius: 14, backgroundColor: '#0d9488', alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  disabled: { opacity: 0.5 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 8 },
  line: { flex: 1, height: 1, backgroundColor: '#e5e7eb' },
  or: { color: '#9ca3af', fontSize: 13 },
  secondary: { height: 52, borderRadius: 14, borderWidth: 1, borderColor: '#e5e7eb', alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: '#374151', fontSize: 16, fontWeight: '600' },
});

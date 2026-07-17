import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/src/auth/auth-context';

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
      if (ok) router.replace('/(app)/home');
      else Alert.alert('Verify', 'That code is invalid or expired. Request a new one.');
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
    <SafeAreaView style={styles.safe}>
      <View style={styles.body}>
        <Text style={styles.title}>Enter your code</Text>
        <Text style={styles.subtitle}>We emailed a 6-digit code to {email}. It expires in 10 minutes.</Text>

        <TextInput
          value={code}
          onChangeText={(t) => setCode(t.replace(/[^0-9]/g, '').slice(0, 6))}
          placeholder="123456"
          placeholderTextColor="#9ca3af"
          keyboardType="number-pad"
          inputMode="numeric"
          maxLength={6}
          style={styles.input}
          onSubmitEditing={verify}
          returnKeyType="go"
          autoFocus
        />

        <Pressable onPress={verify} disabled={!ready || busy} style={[styles.primary, (!ready || busy) && styles.disabled]}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Verify</Text>}
        </Pressable>

        <Pressable onPress={resend} style={styles.link}>
          <Text style={styles.linkText}>Resend code</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#ffffff' },
  body: { flex: 1, paddingHorizontal: 28, justifyContent: 'center', gap: 12 },
  title: { fontSize: 28, fontWeight: '700', color: '#171717' },
  subtitle: { fontSize: 15, color: '#6b7280', marginBottom: 12, lineHeight: 22 },
  input: { height: 60, borderRadius: 14, borderWidth: 1, borderColor: '#e5e7eb', paddingHorizontal: 16, fontSize: 24, letterSpacing: 8, textAlign: 'center', color: '#111827' },
  primary: { height: 52, borderRadius: 14, backgroundColor: '#0d9488', alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  disabled: { opacity: 0.5 },
  link: { alignItems: 'center', paddingVertical: 12 },
  linkText: { color: '#0d9488', fontSize: 15, fontWeight: '600' },
});

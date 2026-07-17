import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiFetch, useAuth } from '@/src/auth/auth-context';

// Minimal authenticated home. It exists to PROVE the vertical end to end:
// signed-in → Bearer token attached → an authenticated call to the backend
// succeeds. The real Moments UI (from the cloud designs) replaces this.
export default function Home() {
  const { signOut } = useAuth();
  const [state, setState] = useState<{ loading: boolean; count: number | null; error: string | null }>({ loading: true, count: null, error: null });

  useEffect(() => {
    let alive = true;
    apiFetch('/api/moments?limit=50')
      .then(async (r) => {
        if (!r.ok) throw new Error(String(r.status));
        const data = await r.json();
        if (alive) setState({ loading: false, count: Array.isArray(data.moments) ? data.moments.length : 0, error: null });
      })
      .catch(() => {
        if (alive) setState({ loading: false, count: null, error: 'Could not load your moments.' });
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.body}>
        <Text style={styles.greeting}>You&apos;re signed in 🌿</Text>
        <Text style={styles.subtitle}>Connected to the Bloomsline backend.</Text>

        <View style={styles.card}>
          {state.loading ? (
            <ActivityIndicator color="#0d9488" />
          ) : state.error ? (
            <Text style={styles.error}>{state.error}</Text>
          ) : (
            <>
              <Text style={styles.count}>{state.count}</Text>
              <Text style={styles.countLabel}>moment{state.count === 1 ? '' : 's'} so far</Text>
            </>
          )}
        </View>

        <Pressable onPress={signOut} style={styles.signOut}>
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f7faf9' },
  body: { flex: 1, paddingHorizontal: 28, paddingTop: 24, gap: 8 },
  greeting: { fontSize: 26, fontWeight: '700', color: '#171717' },
  subtitle: { fontSize: 15, color: '#6b7280', marginBottom: 20 },
  card: { backgroundColor: '#fff', borderRadius: 20, borderWidth: 1, borderColor: '#eef2f1', paddingVertical: 36, alignItems: 'center', justifyContent: 'center', minHeight: 140 },
  count: { fontSize: 48, fontWeight: '800', color: '#0d9488' },
  countLabel: { fontSize: 15, color: '#6b7280', marginTop: 4 },
  error: { color: '#b91c1c', fontSize: 15 },
  signOut: { marginTop: 'auto', marginBottom: 12, height: 50, borderRadius: 14, borderWidth: 1, borderColor: '#e5e7eb', alignItems: 'center', justifyContent: 'center' },
  signOutText: { color: '#374151', fontSize: 16, fontWeight: '600' },
});

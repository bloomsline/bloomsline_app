import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Screen, IconButton } from '@/src/ui/Screen';
import { Button } from '@/src/ui/Button';
import { useOnboarding } from '@/src/onboarding/context';
import { useAuth } from '@/src/auth/auth-context';
import { router } from 'expo-router';

const MOODS = [
  { id: 'calm', label: '🍃 Calm' },
  { id: 'hopeful', label: '☀ Hopeful' },
  { id: 'anxious', label: '🌬 Anxious' },
  { id: 'overwhelmed', label: '🌊 Overwhelmed' },
  { id: 'tired', label: '🌙 Tired' },
];

// q7 — A soft first check-in (Flow B only). Optional, private.
export default function CheckIn() {
  const { firstName, update } = useOnboarding();
  const { completeOnboarding } = useAuth();
  const [mood, setMood] = useState<string | null>('calm');
  const [busy, setBusy] = useState(false);

  const finish = async () => {
    setBusy(true);
    update({ mood });
    await completeOnboarding(); // → authed → home
  };

  return (
    <Screen bg="bg-white" className="px-6">
      <View className="flex-row items-center justify-between pt-2">
        <IconButton glyph="‹" onPress={() => router.back()} />
        <View className="rounded-full bg-line-soft px-3 py-1.5">
          <Text className="text-[12.5px] font-semibold text-muted">🔒 Just for you</Text>
        </View>
        <View className="w-10" />
      </View>

      <View className="flex-1 pt-8">
        <Text className="text-[27px] font-bold leading-[33px] tracking-[-0.5px] text-ink">
          Welcome in, {firstName || 'there'}.{'\n'}How are you arriving?
        </Text>
        <Text className="mt-2.5 text-[15px] text-muted">No wrong answer — and you can skip.</Text>

        <View className="mt-7 flex-row flex-wrap gap-2.5">
          {MOODS.map((m) => {
            const on = mood === m.id;
            return (
              <Pressable
                key={m.id}
                onPress={() => setMood(on ? null : m.id)}
                className={`rounded-[20px] px-4 py-3 ${on ? 'bg-brand' : 'bg-line-soft'}`}
              >
                <Text className={`text-[15px] font-medium ${on ? 'text-white' : 'text-[#444]'}`}>{m.label}</Text>
              </Pressable>
            );
          })}
          <Pressable onPress={() => setMood(null)} className="rounded-[20px] bg-line-soft px-4 py-3">
            <Text className="text-[15px] font-medium text-muted-dark">＋</Text>
          </Pressable>
        </View>
      </View>

      <SafeAreaView edges={['bottom']} className="flex-row gap-3">
        <Button label="Skip" variant="secondary" onPress={finish} className="px-7" />
        <View className="flex-1">
          <Button label="Enter Bloomsline" onPress={finish} loading={busy} />
        </View>
      </SafeAreaView>
    </Screen>
  );
}

import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ChevronLeft, Lock, Plus, Leaf, Sun, Wind, Waves, Moon, type LucideIcon } from 'lucide-react-native';
import { Screen, IconButton } from '@/src/ui/Screen';
import { Button } from '@/src/ui/Button';
import { useOnboarding } from '@/src/onboarding/context';
import { useAuth } from '@/src/auth/auth-context';

const MOODS: { id: string; label: string; Icon: LucideIcon; color: string }[] = [
  { id: 'calm', label: 'Calm', Icon: Leaf, color: '#4A9A86' },
  { id: 'hopeful', label: 'Hopeful', Icon: Sun, color: '#F59E0B' },
  { id: 'anxious', label: 'Anxious', Icon: Wind, color: '#8B5CF6' },
  { id: 'overwhelmed', label: 'Overwhelmed', Icon: Waves, color: '#3B82F6' },
  { id: 'tired', label: 'Tired', Icon: Moon, color: '#6B7280' },
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
        <IconButton icon={ChevronLeft} tone="teal" onPress={() => router.back()} />
        <View className="flex-row items-center gap-1.5 rounded-full bg-line-soft px-3 py-1.5">
          <Lock size={13} color="#999999" strokeWidth={2} />
          <Text className="text-[12.5px] font-semibold text-muted">Just for you</Text>
        </View>
        <View className="w-11" />
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
                className={`flex-row items-center gap-2 rounded-[20px] px-4 py-3 ${on ? 'bg-ink' : 'bg-line-soft'}`}
              >
                <m.Icon size={16} color={on ? '#fff' : m.color} strokeWidth={2} />
                <Text className={`text-[15px] font-medium ${on ? 'text-white' : 'text-[#444]'}`}>{m.label}</Text>
              </Pressable>
            );
          })}
          <Pressable onPress={() => setMood(null)} className="flex-row items-center rounded-[20px] bg-line-soft px-4 py-3">
            <Plus size={16} color="#8A8A8A" strokeWidth={2} />
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

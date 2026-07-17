import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { ChevronLeft, HeartHandshake, Leaf, Plus } from 'lucide-react-native';
import { Screen, IconButton } from '@/src/ui/Screen';
import { ProgressBar } from '@/src/ui/ProgressBar';
import { Button } from '@/src/ui/Button';
import { useOnboarding } from '@/src/onboarding/context';
import { TEAL_GRADIENT, TEAL_GRADIENT_LOCS } from '@/src/ui/theme';

function initialOf(name: string | null, fallback: string) {
  if (!name) return fallback;
  const parts = name.replace(/^dr\.?\s*/i, '').trim().split(/\s+/);
  return (parts[0]?.[0] ?? fallback).toUpperCase();
}

export default function Arrival() {
  const { hasPractitioner, firstName, practitionerName } = useOnboarding();
  const next = () => router.push('/(onboarding)/consent');

  if (hasPractitioner) {
    // g5 — Welcome + your practitioner (auto-matched). Full-bleed teal.
    const prac = practitionerName ?? 'Your practitioner';
    return (
      <View className="flex-1">
        <StatusBar style="light" />
        <LinearGradient colors={[...TEAL_GRADIENT]} locations={[...TEAL_GRADIENT_LOCS]} style={{ position: 'absolute', inset: 0 }} />
        <SafeAreaView edges={['top', 'bottom']} className="flex-1 px-6">
          <View className="flex-1 items-center justify-center">
            <Text className="text-[14px] font-semibold uppercase tracking-[1px] text-white/65">Bloomsline</Text>
            <Text className="mt-3 text-[34px] font-bold tracking-[-0.6px] text-white">Welcome, {firstName || 'there'}.</Text>
            <Text className="mt-3 max-w-[300px] text-center text-[15px] leading-[22px] text-white/85">
              {prac} invited you — you’re connected. She’s here to support you.
            </Text>

            <View className="mt-9 w-full flex-row items-center rounded-3xl bg-white p-6">
              <View className="items-center">
                <View className="h-[58px] w-[58px] items-center justify-center rounded-full bg-[#E0DED9]">
                  <Text className="text-[20px] font-bold text-[#7A756C]">{initialOf(firstName, 'Y')}</Text>
                </View>
                <Text className="mt-2 text-[12.5px] text-muted-dark">You</Text>
              </View>

              <View className="mx-2 flex-1 items-center justify-center">
                <View className="absolute left-0 right-0 top-[29px] border-t border-dashed border-[#C9D8D2]" />
                <View className="h-8 w-8 items-center justify-center rounded-full bg-mint">
                  <HeartHandshake size={16} color="#4A9A86" strokeWidth={2} />
                </View>
              </View>

              <View className="items-center">
                <View className="h-[58px] w-[58px] items-center justify-center rounded-full bg-brand">
                  <Text className="text-[20px] font-bold text-white">{initialOf(prac, 'M')}</Text>
                </View>
                <Text className="mt-2 text-[12.5px] text-muted-dark">{prac}</Text>
              </View>
            </View>
          </View>
          <Button label="Continue" variant="white" onPress={next} />
        </SafeAreaView>
      </View>
    );
  }

  // q5b — On your own, for now (solo). White.
  return (
    <Screen bg="bg-white" className="px-6">
      <View className="flex-row items-center gap-3 pt-2">
        <IconButton icon={ChevronLeft} tone="teal" onPress={() => router.back()} />
        <ProgressBar steps={2} filled={1} />
      </View>
      <View className="flex-1 pt-8">
        <View className="h-14 w-14 items-center justify-center rounded-2xl border border-line bg-white">
          <Leaf size={24} color="#4A9A86" strokeWidth={2} />
        </View>
        <Text className="mt-6 text-[28px] font-bold leading-[34px] tracking-[-0.5px] text-ink">
          This space is{'\n'}yours alone
        </Text>
        <Text className="mt-2.5 text-[15px] leading-[23px] text-muted">
          Track how you feel, journal, and try practices — all completely private. No one else is involved.
        </Text>

        <View className="mt-6 flex-row items-start gap-3 rounded-[18px] border border-line bg-line-soft p-4">
          <Plus size={18} color="#4A9A86" strokeWidth={2} />
          <View className="flex-1">
            <Text className="text-[15px] font-bold text-ink">Want a therapist later?</Text>
            <Text className="mt-1 text-[13px] leading-[19px] text-muted">
              Add one anytime from My Care — nothing you’ve written is shared until you choose to.
            </Text>
          </View>
        </View>
      </View>
      <SafeAreaView edges={['bottom']}>
        <Button label="Sounds good" onPress={next} />
      </SafeAreaView>
    </Screen>
  );
}

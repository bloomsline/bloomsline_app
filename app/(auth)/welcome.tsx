import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SunriseHero } from '@/src/ui/SunriseHero';
import { Button } from '@/src/ui/Button';

// g1 / q1 — Welcome. Shared across both signup flows.
export default function Welcome() {
  return (
    <View className="flex-1 bg-white">
      <SunriseHero />
      <View className="flex-1 px-[34px] pt-6">
        <Text className="text-[15px] font-extrabold tracking-[0.5px] text-brand">bloomsline</Text>
        <Text className="mt-3 text-[31px] font-bold leading-[36px] tracking-[-0.6px] text-ink">
          Taking this step{'\n'}takes <Text className="text-brand">courage.</Text>
        </Text>
        <Text className="mt-3.5 text-[16px] leading-[24px] text-muted-warm">
          A calm space for the small moments — one at a time.
        </Text>
      </View>
      <SafeAreaView edges={['bottom']} className="px-6">
        <Button label="Create my profile" variant="dark" onPress={() => router.push('/(auth)/sign-up')} />
        <Button label="I already have an account" variant="ghost" onPress={() => router.push('/(auth)/sign-up')} />
      </SafeAreaView>
    </View>
  );
}

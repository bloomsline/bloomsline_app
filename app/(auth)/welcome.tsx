import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Lock } from 'lucide-react-native';
import { SunriseHero } from '@/src/ui/SunriseHero';
import { Button } from '@/src/ui/Button';

// Welcome. Warm, inclusive entry; role (patient vs practitioner) is decided
// after sign-in. Soft dawn hero + a quiet trust cue.
export default function Welcome() {
  return (
    <View className="flex-1 bg-white">
      <SunriseHero height={260} />

      <View className="flex-1 justify-between px-7 pt-8">
        <View>
          <Text className="text-[15px] font-extrabold tracking-[0.5px] text-brand">bloomsline</Text>
          <Text className="mt-4 text-[28px] font-bold leading-[35px] tracking-[-0.5px] text-ink">
            However you’re arriving,{'\n'}you’re <Text className="text-brand">welcome here.</Text>
          </Text>
          <Text className="mt-3 text-[16px] leading-[24px] text-muted">
            A private space for your wellbeing, one small moment at a time.
          </Text>
        </View>

        <SafeAreaView edges={['bottom']} className="pb-2">
          <View className="mb-5 flex-row items-center justify-center gap-1.5">
            <Lock size={13} color="#8A8A8A" strokeWidth={2} />
            <Text className="text-[12.5px] font-medium text-muted-dark">Private by default. Yours alone.</Text>
          </View>

          <Button label="Create my profile" onPress={() => router.push('/(auth)/sign-up')} />

          <Pressable onPress={() => router.push('/(auth)/sign-up')} className="items-center py-4">
            <Text className="text-[15px] font-semibold text-ink">I already have an account</Text>
          </Pressable>
        </SafeAreaView>
      </View>
    </View>
  );
}

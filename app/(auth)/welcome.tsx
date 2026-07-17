import { router } from 'expo-router';
import { Linking, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Lock } from 'lucide-react-native';
import { SunriseHero } from '@/src/ui/SunriseHero';
import { Button } from '@/src/ui/Button';
import { PRACTITIONER_WEB_URL } from '@/src/config';

// g1 / q1 — Welcome. First impression for individuals (patients + curious).
// Warm + orienting + a quiet trust cue. Practitioners are pointed to the web.
export default function Welcome() {
  return (
    <View className="flex-1 bg-white">
      <SunriseHero />
      <View className="flex-1 px-[34px] pt-6">
        <Text className="text-[15px] font-extrabold tracking-[0.5px] text-brand">bloomsline</Text>
        <Text className="mt-3 text-[29px] font-bold leading-[36px] tracking-[-0.6px] text-ink">
          However you’re arriving,{'\n'}you’re <Text className="text-brand">welcome here.</Text>
        </Text>
        <Text className="mt-3.5 text-[16px] leading-[24px] text-muted-warm">
          A private space for your wellbeing, one small moment at a time.
        </Text>
      </View>

      <SafeAreaView edges={['bottom']} className="px-6">
        <View className="mb-3 flex-row items-center gap-2 px-1">
          <Lock size={14} color="#8A8A8A" strokeWidth={2} />
          <Text className="text-[12.5px] font-medium text-muted-dark">Private by default. Yours alone.</Text>
        </View>

        <Button label="Create my profile" variant="dark" onPress={() => router.push('/(auth)/sign-up')} />
        <Button label="I already have an account" variant="ghost" onPress={() => router.push('/(auth)/sign-up')} />

        <Pressable onPress={() => Linking.openURL(PRACTITIONER_WEB_URL)} className="items-center pt-2 pb-1">
          <Text className="text-[13px] text-muted">
            Are you a practitioner? <Text className="font-semibold text-brand">Continue on the web</Text>
          </Text>
        </Pressable>
      </SafeAreaView>
    </View>
  );
}

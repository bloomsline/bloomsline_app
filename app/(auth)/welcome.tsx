import { router } from 'expo-router';
import { Linking, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Lock } from 'lucide-react-native';
import { SunriseHero } from '@/src/ui/SunriseHero';
import { Button } from '@/src/ui/Button';
import { PRACTITIONER_WEB_URL } from '@/src/config';

// g1 / q1 — Welcome. Warm, inclusive first impression for individuals; a quiet
// trust cue; practitioners are pointed to the web.
export default function Welcome() {
  return (
    <View className="flex-1 bg-white">
      <SunriseHero height={260} />

      <View className="flex-1 justify-between px-7 pt-8">
        {/* value */}
        <View>
          <Text className="text-[15px] font-extrabold tracking-[0.5px] text-brand">bloomsline</Text>
          <Text className="mt-4 text-[28px] font-bold leading-[35px] tracking-[-0.5px] text-ink">
            However you’re arriving,{'\n'}you’re <Text className="text-brand">welcome here.</Text>
          </Text>
          <Text className="mt-3 text-[16px] leading-[24px] text-muted">
            A private space for your wellbeing, one small moment at a time.
          </Text>
        </View>

        {/* actions */}
        <SafeAreaView edges={['bottom']} className="pb-2">
          <View className="mb-5 flex-row items-center justify-center gap-1.5">
            <Lock size={13} color="#8A8A8A" strokeWidth={2} />
            <Text className="text-[12.5px] font-medium text-muted-dark">Private by default. Yours alone.</Text>
          </View>

          <Button label="Create my profile" onPress={() => router.push('/(auth)/sign-up')} />

          <Pressable onPress={() => router.push('/(auth)/sign-up')} className="items-center py-4">
            <Text className="text-[15px] font-semibold text-ink">I already have an account</Text>
          </Pressable>

          <Pressable onPress={() => Linking.openURL(PRACTITIONER_WEB_URL)} className="items-center pt-1">
            <Text className="text-[13px] text-muted">
              Are you a practitioner? <Text className="font-semibold text-brand">Continue on the web</Text>
            </Text>
          </Pressable>
        </SafeAreaView>
      </View>
    </View>
  );
}

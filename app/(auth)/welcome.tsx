import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Flower2, Lock } from 'lucide-react-native';
import { Button } from '@/src/ui/Button';

// Welcome. Shared entry for everyone; role (patient vs practitioner) is decided
// after sign-in. Brand-forward and role-neutral: no illustration, a calm teal
// wash, a small bloom mark, and neutral CTAs.
export default function Welcome() {
  return (
    <View className="flex-1 bg-white">
      <LinearGradient colors={['#E7F2EE', '#F3FAF8', '#FFFFFF']} locations={[0, 0.5, 1]} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />

      <SafeAreaView edges={['top', 'bottom']} className="flex-1 justify-between px-8">
        {/* brand + promise, centered in the space */}
        <View className="flex-1 items-center justify-center">
          <View
            className="h-[68px] w-[68px] items-center justify-center rounded-[22px] bg-white"
            style={{ shadowColor: '#4A9A86', shadowOpacity: 0.18, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 6 }}
          >
            <Flower2 size={30} color="#4A9A86" strokeWidth={2} />
          </View>
          <Text className="mt-6 text-[26px] font-extrabold tracking-[-0.3px] text-ink">bloomsline</Text>
          <Text className="mt-4 max-w-[300px] text-center text-[19px] font-medium leading-[27px] text-muted-dark">
            A calmer space for care.
          </Text>
        </View>

        {/* actions */}
        <View className="pb-2">
          <Button label="Get started" onPress={() => router.push('/(auth)/sign-up')} />
          <Pressable onPress={() => router.push('/(auth)/sign-up')} className="items-center py-4">
            <Text className="text-[15px] font-semibold text-ink">I already have an account</Text>
          </Pressable>
          <View className="flex-row items-center justify-center gap-1.5 pb-1">
            <Lock size={12} color="#9A9A9A" strokeWidth={2} />
            <Text className="text-[12px] font-medium text-muted">Private by default. Yours alone.</Text>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

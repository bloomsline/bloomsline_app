import { useState } from 'react';
import { router } from 'expo-router';
import { KeyboardAvoidingView, Platform, Pressable, Text, View } from 'react-native';
import { ChevronLeft, Cake } from 'lucide-react-native';
import { Screen, IconButton } from '@/src/ui/Screen';
import { ProgressBar } from '@/src/ui/ProgressBar';
import { Field } from '@/src/ui/Field';
import { Button } from '@/src/ui/Button';
import { useOnboarding } from '@/src/onboarding/context';
import { saveProfile } from '@/src/api/me';
import { notify } from '@/src/ui/alert';

// g4 — Your name (Flow A, step 1 of 3). Private to the patient.
export default function NameStep() {
  const { firstName, lastName, update } = useOnboarding();
  const [first, setFirst] = useState(firstName);
  const [last, setLast] = useState(lastName);
  const ready = first.trim().length > 0;

  const next = () => {
    if (!ready) return;
    update({ firstName: first.trim(), lastName: last.trim() });
    saveProfile({ firstName: first.trim(), lastName: last.trim() }); // best-effort
    router.push('/(onboarding)/arrival');
  };

  return (
    <Screen bg="bg-white" scroll className="px-6 pb-6">
      <View className="flex-row items-center gap-3 pt-2">
        <IconButton icon={ChevronLeft} tone="teal" onPress={() => router.back()} />
        <ProgressBar steps={3} filled={1} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <Text className="mt-7 text-[28px] font-bold leading-[34px] tracking-[-0.5px] text-ink">
          What should we{'\n'}call you?
        </Text>
        <Text className="mt-2 text-[15px] text-muted">Only shown to you, inside your space.</Text>

        <View className="mt-7 flex-row gap-3">
          <Field label="First name" required value={first} onChangeText={setFirst} autoFocus autoCapitalize="words" className="flex-1" />
          <Field label="Last name" value={last} onChangeText={setLast} autoCapitalize="words" className="flex-1" />
        </View>

        <Text className="mb-2 mt-5 text-[12.5px] font-semibold uppercase tracking-[0.5px] text-muted">
          When’s your birthday? <Text className="font-normal normal-case tracking-normal text-[#C4C4C4]">· optional</Text>
        </Text>
        <Pressable
          onPress={() => notify('Birthday', 'Date picker coming soon.')}
          className="h-[58px] flex-row items-center justify-between rounded-2xl border border-[#E5E5E5] px-4"
        >
          <Text className="text-[16px] text-[#BBBBBB]">Pick a date</Text>
          <Cake size={18} color="#BBBBBB" strokeWidth={2} />
        </Pressable>

        <View className="flex-1" />
        <View className="pt-8">
          <Button label="Continue" onPress={next} disabled={!ready} />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

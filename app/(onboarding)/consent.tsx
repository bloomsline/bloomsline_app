import { useState } from 'react';
import { router } from 'expo-router';
import { Alert, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Screen, IconButton } from '@/src/ui/Screen';
import { ProgressBar } from '@/src/ui/ProgressBar';
import { Button } from '@/src/ui/Button';
import { useOnboarding } from '@/src/onboarding/context';
import { useAuth } from '@/src/auth/auth-context';
import { saveProfile } from '@/src/api/me';

function Promise({ icon, title, caption }: { icon: string; title: string; caption: string }) {
  return (
    <View className="flex-row items-start gap-3 rounded-2xl border border-line bg-white p-4">
      <Text className="text-[18px] text-brand">{icon}</Text>
      <View className="flex-1">
        <Text className="text-[15px] font-bold text-ink">{title}</Text>
        <Text className="mt-1 text-[12.5px] leading-[18px] text-muted-dark">{caption}</Text>
      </View>
    </View>
  );
}

export default function Consent() {
  const { hasPractitioner, practitionerName, update } = useOnboarding();
  const { completeOnboarding } = useAuth();
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const prac = practitionerName ?? 'Your practitioner';

  const captions = hasPractitioner
    ? [`${prac} sees nothing unless you share it.`, 'A badge marks anything your care team can see.', 'Export or delete everything, one tap.']
    : ['Nothing you write is shared with anyone.', 'If you add a therapist later, you choose what they see.', 'Export or delete everything, one tap.'];

  const agree = async () => {
    if (!agreed || busy) return;
    setBusy(true);
    update({ agreedToTerms: true });
    saveProfile({ agreedToTerms: true }); // best-effort
    if (hasPractitioner) {
      await completeOnboarding(); // → authed → home
    } else {
      router.push('/(onboarding)/check-in');
      setBusy(false);
    }
  };

  return (
    <Screen bg="bg-surface" scroll className="px-6 pb-4">
      <View className="flex-row items-center gap-3 pt-2">
        <IconButton glyph="‹" onPress={() => router.back()} className="border border-line bg-white" />
        <ProgressBar steps={hasPractitioner ? 3 : 2} filled={hasPractitioner ? 3 : 2} />
      </View>

      <Text className="mt-7 text-[26px] font-bold tracking-[-0.5px] text-ink">Before you begin, here’s the deal</Text>
      <Text className="mt-2 text-[14.5px] text-muted-dark">Plain and simple. You can read this again anytime.</Text>

      <View className="mt-6 gap-2.5">
        <Promise icon="🔒" title="Everything is private by default" caption={captions[0]} />
        <Promise icon="👁" title="You’ll always know what’s shared" caption={captions[1]} />
        <Promise icon="↩" title="You can leave & take your data" caption={captions[2]} />
      </View>

      {!hasPractitioner && (
        <Pressable onPress={() => Alert.alert('Privacy', 'The full privacy promise opens here.')} className="items-center py-4">
          <Text className="text-[14px] text-muted-dark underline">Read the full privacy promise</Text>
        </Pressable>
      )}

      <View className="flex-1" />

      <SafeAreaView edges={['bottom']} className="pt-6">
        <Pressable onPress={() => setAgreed((v) => !v)} className="mb-3 flex-row items-start gap-2.5">
          <View className={`mt-0.5 h-6 w-6 items-center justify-center rounded-[7px] ${agreed ? 'bg-brand' : 'border border-[#CCCCCC] bg-white'}`}>
            {agreed ? <Text className="text-[13px] font-bold text-white">✓</Text> : null}
          </View>
          <Text className="flex-1 text-[13px] leading-[19px] text-[#6A6A6A]">
            I’ve read and agree to the <Text className="font-semibold text-ink">privacy promise</Text> and terms.
          </Text>
        </Pressable>
        <Button label="Agree & continue" onPress={agree} loading={busy} disabled={!agreed} />
      </SafeAreaView>
    </Screen>
  );
}

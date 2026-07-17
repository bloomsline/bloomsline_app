import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { Screen } from '@/src/ui/Screen';
import { useAuth } from '@/src/auth/auth-context';
import { useOnboarding } from '@/src/onboarding/context';

// g8 / q8 — the "all set" home landing after signup. The full section content
// (My Care / Moments / For You) is a separate flow; this is the onboarding
// terminus with its first-run highlight card + the app shell.
export default function Home() {
  const { signOut } = useAuth();
  const { hasPractitioner, firstName, practitionerName } = useOnboarding();
  const [coachDismissed, setCoachDismissed] = useState(false);
  const prac = practitionerName ?? 'your practitioner';

  const openSettings = () =>
    Alert.alert('Account', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => signOut() },
    ]);

  return (
    <Screen bg="bg-surface" scroll className="px-6 pb-32">
      {/* greeting */}
      <View className="flex-row items-start justify-between pt-3">
        <Text className="text-[27px] font-bold leading-[32px] tracking-[-0.4px] text-ink">
          Good morning,{'\n'}
          <Text className="text-muted">{firstName || 'there'}.</Text>
        </Text>
        <Pressable onPress={openSettings} className="h-[38px] w-[38px] items-center justify-center rounded-full border border-line bg-white">
          <Text className="text-[16px] text-[#666]">⚙</Text>
        </Pressable>
      </View>

      {hasPractitioner ? (
        <>
          {!coachDismissed && (
            <View className="mt-6 rounded-[20px] border border-mint-border bg-mint p-5">
              <Text className="text-[18px] text-brand-dark">✓</Text>
              <Text className="mt-2 text-[16px] font-bold text-brand-deep">Your Follow-up Space</Text>
              <Text className="mt-1.5 text-[13.5px] leading-[20px] text-brand-body">
                Here, you’ll find the resources shared by your practitioner, your upcoming sessions, and your progress. Everything is in one place.
              </Text>
              <Pressable onPress={() => setCoachDismissed(true)} className="mt-3 h-[38px] w-24 items-center justify-center rounded-full bg-brand">
                <Text className="text-[14px] font-semibold text-white">Got it</Text>
              </Pressable>
            </View>
          )}

          {/* feed preview (real content lands with the My Care flow) */}
          <View className="mt-4 gap-3 opacity-40">
            <View className="flex-row items-center gap-3 rounded-2xl border border-line bg-white p-4">
              <View className="h-11 w-11 items-center justify-center rounded-full bg-brand"><Text className="font-bold text-white">{(prac.replace(/^dr\.?\s*/i, '')[0] ?? 'M').toUpperCase()}</Text></View>
              <View className="flex-1">
                <Text className="text-[15px] font-bold text-ink">{practitionerName ?? 'Your practitioner'}</Text>
                <Text className="text-[12.5px] text-muted">Clinical psychologist · connected</Text>
              </View>
              <Text className="text-muted">›</Text>
            </View>
            <View className="rounded-2xl bg-brand p-5">
              <Text className="text-[11px] font-semibold uppercase tracking-[1px] text-white/70">Next session</Text>
              <Text className="mt-1 text-[18px] font-bold text-white">Not booked yet</Text>
              <View className="mt-3 h-10 w-36 items-center justify-center rounded-full bg-white"><Text className="font-semibold text-brand-deep">Book a session</Text></View>
            </View>
            <View className="rounded-2xl border border-line bg-white p-5">
              <Text className="text-[15px] font-bold text-ink">No shared resources yet</Text>
              <Text className="mt-1 text-[13px] text-muted">Anything {prac} shares with you will appear here.</Text>
            </View>
          </View>
        </>
      ) : (
        <>
          <View className="mt-6 rounded-[20px] border border-line bg-white p-5">
            <Text className="text-[18px] text-brand-dark">✓</Text>
            <Text className="mt-2 text-[16px] font-bold text-ink">Your space is ready</Text>
            <Text className="mt-1 text-[13.5px] text-muted">Everything private, just for you</Text>
          </View>

          <View className="mt-4 self-start rounded-full border border-line bg-white px-3 py-1.5">
            <Text className="text-[12.5px] font-semibold text-[#666]">🔒 Today’s moments are private to you</Text>
          </View>

          <View className="mt-4 items-center rounded-3xl border border-line bg-white px-6 py-9">
            <Text className="text-[15px] font-bold text-ink">Nothing captured yet</Text>
            <Text className="mt-1 text-center text-[13px] text-muted">When you’re ready, tap ＋ to notice how you feel.</Text>
          </View>

          <Pressable
            onPress={() => Alert.alert('Add practitioner', 'Practitioner linking comes with the My Care flow.')}
            className="mt-4 flex-row items-center gap-3 rounded-[20px] border border-mint-border bg-mint p-4"
          >
            <View className="h-11 w-11 items-center justify-center rounded-2xl bg-white"><Text className="text-[18px]">🤝</Text></View>
            <View className="flex-1">
              <Text className="text-[15px] font-bold text-brand-deep">Add your practitioner</Text>
              <Text className="text-[12.5px] text-brand-body">Whenever you’re ready — optional</Text>
            </View>
            <Text className="text-[#7FBAAC]">›</Text>
          </Pressable>
        </>
      )}

      <TabBar active={hasPractitioner ? 'care' : 'moments'} />
    </Screen>
  );
}

// Bottom tab shell + FAB. Tabs are placeholders until their flows are built.
function TabBar({ active }: { active: 'care' | 'moments' | 'foryou' }) {
  const tabs = [
    { id: 'care', label: 'My Care', icon: '👤' },
    { id: 'moments', label: 'Moments', icon: '♥' },
    { id: 'foryou', label: 'For You', icon: '🌿' },
  ] as const;
  return (
    <View className="absolute inset-x-6 bottom-8 flex-row items-center gap-3">
      <View
        className="flex-1 flex-row justify-around rounded-[40px] bg-white px-4 py-3"
        style={{ shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 20, shadowOffset: { width: 0, height: 6 }, elevation: 8 }}
      >
        {tabs.map((t) => (
          <Pressable key={t.id} className="items-center" onPress={() => {}}>
            <Text className={`text-[18px] ${t.id === active ? '' : 'opacity-40'}`}>{t.icon}</Text>
            <Text className={`mt-0.5 text-[11px] ${t.id === active ? 'font-bold text-brand' : 'text-muted'}`}>{t.label}</Text>
          </Pressable>
        ))}
      </View>
      <Pressable
        className="h-[54px] w-[54px] items-center justify-center rounded-[27px] bg-brand"
        style={{ shadowColor: '#3E8A78', shadowOpacity: 0.4, shadowRadius: 20, shadowOffset: { width: 0, height: 6 }, elevation: 8 }}
        onPress={() => {}}
      >
        <Text className="text-[26px] font-light text-white">+</Text>
      </Pressable>
    </View>
  );
}

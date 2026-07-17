import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { Settings, Check, HeartHandshake, ChevronRight, Lock, User, Heart, HandHeart, Plus, type LucideIcon } from 'lucide-react-native';
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
    <Screen bg="bg-white" scroll className="px-6 pb-32">
      {/* greeting */}
      <View className="flex-row items-start justify-between pt-3">
        <Text className="text-[27px] font-bold leading-[32px] tracking-[-0.4px] text-ink">
          Good morning,{'\n'}
          <Text className="text-muted">{firstName || 'there'}.</Text>
        </Text>
        <Pressable onPress={openSettings} className="h-[38px] w-[38px] items-center justify-center rounded-full border border-line bg-white">
          <Settings size={18} color="#666666" strokeWidth={1.8} />
        </Pressable>
      </View>

      {hasPractitioner ? (
        <>
          {!coachDismissed && (
            <View className="mt-6 rounded-[20px] border border-mint-border bg-mint p-5">
              <Check size={18} color="#2F6E5F" strokeWidth={2.5} />
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
              <ChevronRight size={18} color="#D4D4D4" strokeWidth={2} />
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
            <Check size={18} color="#2F6E5F" strokeWidth={2.5} />
            <Text className="mt-2 text-[16px] font-bold text-ink">Your space is ready</Text>
            <Text className="mt-1 text-[13.5px] text-muted">Everything private, just for you</Text>
          </View>

          <View className="mt-4 flex-row items-center gap-1.5 self-start rounded-full border border-line bg-white px-3 py-1.5">
            <Lock size={13} color="#666666" strokeWidth={2} />
            <Text className="text-[12.5px] font-semibold text-[#666]">Today’s moments are private to you</Text>
          </View>

          <View className="mt-4 items-center rounded-3xl border border-line bg-white px-6 py-9">
            <Text className="text-[15px] font-bold text-ink">Nothing captured yet</Text>
            <Text className="mt-1 text-center text-[13px] text-muted">When you’re ready, tap + to notice how you feel.</Text>
          </View>

          <Pressable
            onPress={() => Alert.alert('Add practitioner', 'Practitioner linking comes with the My Care flow.')}
            className="mt-4 flex-row items-center gap-3 rounded-[20px] border border-mint-border bg-mint p-4"
          >
            <View className="h-11 w-11 items-center justify-center rounded-2xl bg-white"><HeartHandshake size={20} color="#4A9A86" strokeWidth={2} /></View>
            <View className="flex-1">
              <Text className="text-[15px] font-bold text-brand-deep">Add your practitioner</Text>
              <Text className="text-[12.5px] text-brand-body">Whenever you’re ready — optional</Text>
            </View>
            <ChevronRight size={18} color="#7FBAAC" strokeWidth={2} />
          </Pressable>
        </>
      )}

      <TabBar active={hasPractitioner ? 'care' : 'moments'} />
    </Screen>
  );
}

// Floating pill tab bar + FAB (v1 style). Tabs are placeholders until their
// flows are built.
function TabBar({ active }: { active: 'care' | 'moments' | 'foryou' }) {
  const tabs: { id: 'care' | 'moments' | 'foryou'; label: string; Icon: LucideIcon }[] = [
    { id: 'care', label: 'My Care', Icon: User },
    { id: 'moments', label: 'Moments', Icon: Heart },
    { id: 'foryou', label: 'For You', Icon: HandHeart },
  ];
  return (
    <View className="absolute inset-x-6 bottom-8 flex-row items-center gap-3">
      <View
        className="flex-1 flex-row justify-around rounded-[40px] border border-line bg-white px-4 py-3"
        style={{ shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 20, shadowOffset: { width: 0, height: 6 }, elevation: 8 }}
      >
        {tabs.map((t) => {
          const on = t.id === active;
          return (
            <Pressable key={t.id} className="items-center" onPress={() => {}}>
              <View className={`h-[46px] w-[46px] items-center justify-center rounded-full ${on ? 'bg-brand' : 'border border-[#E5E5E3] bg-white'}`}>
                <t.Icon size={20} color={on ? '#fff' : '#999999'} strokeWidth={on ? 2 : 1.6} />
              </View>
              <Text className={`mt-1 text-[11px] ${on ? 'font-bold text-brand' : 'text-muted-dark'}`}>{t.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <Pressable
        className="h-[54px] w-[54px] items-center justify-center rounded-[27px] border border-line bg-white"
        style={{ shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 16, shadowOffset: { width: 0, height: 4 }, elevation: 6 }}
        onPress={() => {}}
      >
        <Plus size={24} color="#1A1A1A" strokeWidth={2} />
      </Pressable>
    </View>
  );
}

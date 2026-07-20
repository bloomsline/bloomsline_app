import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Lock } from 'lucide-react-native';
import { SunriseHero } from '@/src/ui/SunriseHero';
import { Button } from '@/src/ui/Button';
import { fetchInvite } from '@/src/api/invite';

// Landing for a practitioner's invitation email.
//
// The point of this screen is the ADDRESS. Previously an invited patient landed
// on the generic welcome and had to guess which of their addresses their
// practitioner had used — and guessing wrong means the account never links to
// them. Showing it, and carrying it into sign-up, removes the guess.
//
// A bad or expired token falls back to the ordinary welcome copy rather than an
// error: this person came from a real email, and the worst a stale link should
// cost them is a pre-filled field.
export default function InviteLanding() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const [invite, setInvite] = useState<{ email: string; practitionerName: string | null } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetchInvite(String(token ?? '')).then((r) => {
      if (!alive) return;
      setInvite(r);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [token]);

  // Carry the address into sign-up so the field is filled and locked there too.
  const start = () =>
    router.push(
      invite ? { pathname: '/(auth)/sign-up', params: { email: invite.email } } : '/(auth)/sign-up',
    );

  return (
    <View className="flex-1 bg-white">
      <SunriseHero height={260} />

      <View className="flex-1 justify-between px-7 pt-8">
        <View>
          <Text className="text-[15px] font-extrabold tracking-[0.5px] text-brand">bloomsline</Text>

          {loading ? (
            <View className="mt-8 items-start">
              <ActivityIndicator color="#4A9A86" />
            </View>
          ) : invite ? (
            <>
              <Text className="mt-4 text-[28px] font-bold leading-[35px] tracking-[-0.5px] text-ink">
                {invite.practitionerName ? (
                  <>
                    {invite.practitionerName} invited you to{'\n'}
                    <Text className="text-brand">Bloomsline.</Text>
                  </>
                ) : (
                  <>
                    You’re invited to{'\n'}
                    <Text className="text-brand">Bloomsline.</Text>
                  </>
                )}
              </Text>
              <Text className="mt-3 text-[16px] leading-[24px] text-muted">
                A private space for your wellbeing, one small moment at a time.
              </Text>

              <View className="mt-6 rounded-2xl bg-[#F5F5F3] px-4 py-3">
                <Text className="text-[12.5px] text-muted-dark">You were invited as</Text>
                <Text className="mt-0.5 text-[15px] font-semibold text-ink" numberOfLines={1}>
                  {invite.email}
                </Text>
              </View>
            </>
          ) : (
            <>
              <Text className="mt-4 text-[28px] font-bold leading-[35px] tracking-[-0.5px] text-ink">
                However you’re arriving,{'\n'}you’re <Text className="text-brand">welcome here.</Text>
              </Text>
              <Text className="mt-3 text-[16px] leading-[24px] text-muted">
                A private space for your wellbeing, one small moment at a time.
              </Text>
            </>
          )}
        </View>

        <SafeAreaView edges={['bottom']} className="pb-2">
          <View className="mb-5 flex-row items-center justify-center gap-1.5">
            <Lock size={13} color="#8A8A8A" strokeWidth={2} />
            <Text className="text-[12.5px] font-medium text-muted-dark">Private by default. Yours alone.</Text>
          </View>

          <Button label="Create my profile" onPress={start} />

          <Pressable onPress={start} className="items-center py-4">
            <Text className="text-[15px] font-semibold text-ink">I already have an account</Text>
          </Pressable>
        </SafeAreaView>
      </View>
    </View>
  );
}

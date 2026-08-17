import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Lock } from 'lucide-react-native';
import { StatusBar } from 'expo-status-bar';
import { EditorialBg, Scrim, RiseIn, MonoKicker, Pill, LangToggle } from '@/src/onboarding/editorial/kit';
import { ONBOARDING_IMAGES } from '@/src/onboarding/editorial/images';
import { fetchInvite, type PatientInvite } from '@/src/api/invite';
import { useI18n, fmt } from '@/src/i18n';

// Landing for a practitioner's invitation email — the first screen a patient
// ever sees, so it opens in the same editorial world as the rest of onboarding:
// full-bleed imagery, one oversized headline, a glassy "invited as" chip.
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
  const { t, locale, setLocale } = useI18n();
  const [invite, setInvite] = useState<PatientInvite | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetchInvite(String(token ?? '')).then((r) => {
      if (!alive) return;
      setInvite(r);
      // A French invite opens the app in French from here on, and makes French
      // the saved default (persists through onboarding).
      if (r) setLocale(r.locale);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [token, setLocale]);

  // Carry the address into sign-up so the field is filled and locked there too.
  const start = () =>
    router.push(
      invite ? { pathname: '/(auth)/sign-up', params: { email: invite.email } } : '/(auth)/sign-up',
    );

  return (
    <View style={{ flex: 1 }}>
      <StatusBar style="light" />
      <EditorialBg source={ONBOARDING_IMAGES.splash} zoom>
        <Scrim colors={['rgba(16,18,16,0.55)', 'rgba(16,18,16,0.18)', 'rgba(16,18,16,0.92)']} locations={[0, 0.34, 1]} />
        <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1 }}>
          <View style={{ flex: 1, paddingHorizontal: 28 }}>
            <RiseIn style={{ marginTop: 26 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'flex-start', marginBottom: 18 }}>
                <LangToggle value={locale} onChange={(v) => setLocale(v as typeof locale)} />
              </View>
              <MonoKicker>{t.invite.kicker}</MonoKicker>

              {loading ? (
                <View style={{ marginTop: 22, alignItems: 'flex-start' }}>
                  <ActivityIndicator color="#fff" />
                </View>
              ) : invite ? (
                <>
                  <Text style={{ marginTop: 12, fontSize: 34, fontWeight: '800', color: '#fff', letterSpacing: -1.1, lineHeight: 40 }}>
                    {invite.practitionerName ? fmt(t.invite.invitedBy, { prac: invite.practitionerName }) : t.invite.invited}
                    {'\n'}
                    <Text style={{ color: '#7FD9C0' }}>{t.invite.bloomsline}.</Text>
                  </Text>
                  <Text style={{ marginTop: 14, fontSize: 15, color: 'rgba(255,255,255,0.82)', lineHeight: 23, maxWidth: 300 }}>{t.invite.tagline}</Text>
                </>
              ) : (
                <>
                  <Text style={{ marginTop: 12, fontSize: 34, fontWeight: '800', color: '#fff', letterSpacing: -1.1, lineHeight: 40 }}>
                    {t.invite.fallbackPre}
                    <Text style={{ color: '#7FD9C0' }}>{t.invite.fallbackAccent}</Text>
                  </Text>
                  <Text style={{ marginTop: 14, fontSize: 15, color: 'rgba(255,255,255,0.82)', lineHeight: 23, maxWidth: 300 }}>{t.invite.tagline}</Text>
                </>
              )}
            </RiseIn>

            <View style={{ flex: 1 }} />

            <RiseIn delay={350} style={{ paddingBottom: 12 }}>
              {invite && (
                <View style={{ alignSelf: 'stretch', backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', borderRadius: 18, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 16 }}>
                  <Text style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.65)' }}>{t.invite.invitedAs}</Text>
                  <Text style={{ marginTop: 2, fontSize: 15, fontWeight: '700', color: '#fff' }} numberOfLines={1}>
                    {invite.email}
                  </Text>
                </View>
              )}

              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 16 }}>
                <Lock size={13} color="rgba(255,255,255,0.7)" strokeWidth={2} />
                <Text style={{ fontSize: 12.5, fontWeight: '500', color: 'rgba(255,255,255,0.7)' }}>{t.invite.private}</Text>
              </View>

              <Pill label={t.invite.createProfile} onPress={start} />

              <Pressable onPress={start} style={{ alignItems: 'center', paddingVertical: 16 }}>
                <Text style={{ fontSize: 15, fontWeight: '600', color: 'rgba(255,255,255,0.9)' }}>{t.invite.haveAccount}</Text>
              </Pressable>
            </RiseIn>
          </View>
        </SafeAreaView>
      </EditorialBg>
    </View>
  );
}

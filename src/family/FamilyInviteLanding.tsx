import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Lock } from 'lucide-react-native';
import { StatusBar } from 'expo-status-bar';
import { EditorialBg, Scrim, RiseIn, MonoKicker, Pill, LangToggle } from '@/src/onboarding/editorial/kit';
import { ONBOARDING_IMAGES } from '@/src/onboarding/editorial/images';
import { fetchFamilyInvite, type FamilyInvite } from '@/src/api/invite';
import { useI18n, fmt } from '@/src/i18n';
import { useAuth } from '@/src/auth/auth-context';
import { hrefForStatus } from '@/src/auth/route';
import { rememberFamilyInvite, acceptPendingFamilyInvite, clearFamilyInvite } from '@/src/auth/family-invite';
import { useSelectedPractitioner } from '@/src/care/selected-practitioner';
import { track } from '@/src/analytics/client';
import { OVER_MEDIA, onMedia } from '@/src/ui/tokens';

/**
 * Where a guardian's or a child's invitation email lands (guardian plan,
 * phase 6), at `/guardian/<token>` or `/child/<token>`.
 *
 * The token is remembered first thing, so whatever way the person signs in
 * next carries it, including the web flows that leave the page. Signed out:
 * create a profile or sign in, and the invitation is accepted the moment they
 * are in (see `afterSignIn`). Already signed in (a parent who is a patient
 * somewhere, opening their child's link): accept here, then go to the app.
 *
 * Outside the (auth) group on purpose: that group sends a signed-in person
 * away, and a signed-in parent is exactly who must be able to accept here.
 */
export function FamilyInviteLanding({ kind, token }: { kind: 'guardian' | 'child'; token: string }) {
  const { t, locale, setLocale } = useI18n();
  const { status } = useAuth();
  const { refresh } = useSelectedPractitioner();
  const [invite, setInvite] = useState<FamilyInvite | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // A practitioner's session counts as signed in too: the server refuses it
  // (`not_patient`) and the screen says why, rather than offering a sign-up
  // the (auth) group would bounce them out of.
  const signedIn = status === 'authed' || status === 'onboarding' || status === 'practitioner';

  useEffect(() => {
    let alive = true;
    void rememberFamilyInvite(token, kind);
    fetchFamilyInvite(kind, token).then((r) => {
      if (!alive) return;
      track('family_invite_opened', { kind, found: !!r });
      setInvite(r);
      if (r) setLocale(r.locale);
      setLoading(false);
    });
    return () => { alive = false; };
  }, [kind, token, setLocale]);

  const child = invite?.childFirstName ?? '';
  const prac = invite?.practitionerName ?? null;
  const title = kind === 'guardian'
    ? fmt(prac ? t.family.guardianTitle : t.family.guardianTitleNoPrac, { prac: prac ?? '', child })
    : fmt(prac ? t.family.childTitle : t.family.childTitleNoPrac, { prac: prac ?? '' });
  const body = kind === 'guardian' ? fmt(t.family.guardianBody, { child }) : t.family.childBody;

  const start = (mode?: 'signin') =>
    router.push({ pathname: '/(auth)/sign-up', params: { ...(invite?.email ? { email: invite.email } : {}), ...(mode ? { mode } : {}) } });

  const acceptNow = async () => {
    setBusy(true);
    setError(null);
    const out = await acceptPendingFamilyInvite();
    setBusy(false);
    if (out && !out.ok) {
      setError(t.family.refused[out.code as keyof typeof t.family.refused] ?? t.family.refused.invalid);
      return;
    }
    // `refresh` opens on the profile just accepted (`takeNextProfile`): the
    // child's care, for a guardian.
    await refresh();
    router.replace(hrefForStatus(status));
  };

  // Not theirs, or not now: forget it, so it is not offered again on this device.
  const notNow = async () => {
    await clearFamilyInvite();
    router.replace(hrefForStatus(status));
  };

  return (
    <View style={{ flex: 1 }}>
      <StatusBar style="light" />
      <EditorialBg source={ONBOARDING_IMAGES.splash} zoom>
        <Scrim colors={['rgba(16,18,16,0.55)', 'rgba(16,18,16,0.18)', 'rgba(16,18,16,0.92)']} locations={[0, 0.34, 1]} />
        <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1 }}>
          <View style={{ flex: 1, paddingHorizontal: 28 }}>
            <RiseIn style={{ marginTop: 26 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 18 }}>
                <LangToggle value={locale} onChange={(v) => setLocale(v as typeof locale)} />
              </View>
              <MonoKicker>{t.family.kicker}</MonoKicker>
              {loading ? (
                <View style={{ marginTop: 22, alignItems: 'flex-start' }}><ActivityIndicator color={OVER_MEDIA.ink} /></View>
              ) : invite ? (
                <>
                  <Text style={{ marginTop: 12, fontSize: 30, fontWeight: '800', color: OVER_MEDIA.ink, letterSpacing: -1, lineHeight: 36 }}>{title}</Text>
                  <Text style={{ marginTop: 14, fontSize: 15, color: onMedia(0.84), lineHeight: 23, maxWidth: 320 }}>{body}</Text>
                </>
              ) : (
                <Text style={{ marginTop: 14, fontSize: 16, color: onMedia(0.9), lineHeight: 24, maxWidth: 320 }}>{t.family.invalid}</Text>
              )}
            </RiseIn>

            <View style={{ flex: 1 }} />

            {invite && (
              <RiseIn delay={350} style={{ paddingBottom: 12 }}>
                {invite.email && (
                  <View style={{ alignSelf: 'stretch', backgroundColor: onMedia(0.12), borderWidth: 1, borderColor: onMedia(0.2), borderRadius: 18, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 12 }}>
                    <Text style={{ fontSize: 12.5, color: onMedia(0.65) }}>{t.family.sentTo}</Text>
                    <Text style={{ marginTop: 2, fontSize: 15, fontWeight: '700', color: OVER_MEDIA.ink }} numberOfLines={1}>{invite.email}</Text>
                  </View>
                )}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 16 }}>
                  <Lock size={13} color={onMedia(0.7)} strokeWidth={2} />
                  <Text style={{ fontSize: 12.5, fontWeight: '500', color: onMedia(0.75), textAlign: 'center' }}>{t.family.anyAddress}</Text>
                </View>
                {error && <Text accessibilityRole="alert" style={{ fontSize: 14, color: '#FFD3C9', textAlign: 'center', marginBottom: 12, lineHeight: 20 }}>{error}</Text>}
                {signedIn ? (
                  <>
                    <Pill label={busy ? t.family.accepting : t.family.accept} onPress={() => { if (!busy) void acceptNow(); }} />
                    <Pressable onPress={() => { void notNow(); }} style={{ alignItems: 'center', paddingVertical: 16 }}>
                      <Text style={{ fontSize: 15, fontWeight: '600', color: onMedia(0.9) }}>{t.family.notNow}</Text>
                    </Pressable>
                  </>
                ) : (
                  <>
                    <Pill label={t.invite.createProfile} onPress={() => start()} />
                    <Pressable onPress={() => start('signin')} style={{ alignItems: 'center', paddingVertical: 16 }}>
                      <Text style={{ fontSize: 15, fontWeight: '600', color: onMedia(0.9) }}>{t.invite.haveAccount}</Text>
                    </Pressable>
                  </>
                )}
              </RiseIn>
            )}
          </View>
        </SafeAreaView>
      </EditorialBg>
    </View>
  );
}

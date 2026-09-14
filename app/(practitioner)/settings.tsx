// Practitioner settings — the patient's panel, minus the one thing that does
// not apply.
//
// It used to be a third of that: a name, a language toggle, sign out. No way to
// change your own picture, no light or dark, no link to the policies you are
// asking patients to accept. A practitioner uses this app all day; the patient
// uses it in bursts. The smaller panel was on the wrong side.
//
// The ONE difference is Home screen: a patient chooses whether the app opens on
// My Care or on Moments, and a practitioner has one home. Everything else here
// is the same rows in the same order, drawn by the same `Row`, so the two stay
// the same as either is edited.
//
// Deliberately NOT here: delete account. A patient's account is theirs to end;
// a practitioner's carries other people's records, and ending it is a
// conversation, not a button.
import { useEffect, useState } from 'react';
import { Image, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MessageCircle, MessageCircleQuestionMark, LogOut, ChevronRight, Languages, Palette, ShieldCheck, FileText, Database, Lock } from 'lucide-react-native';
import { notify } from '@/src/ui/alert';
import { EdHeader, EdCard, FadeIn, Kicker } from '@/src/ui/editorial';
import { OptionSheet } from '@/src/ui/option-sheet';
import { Row } from '@/src/ui/settings-row';
import { openContact, openPublic } from '@/src/settings/links';
import { useTheme, type ThemeChoice } from '@/src/ui/theme-mode';
import { useAuth } from '@/src/auth/auth-context';
import { useConfirm } from '@/src/ui/confirm';
import { useI18n, type Locale } from '@/src/i18n';
import { fetchMe } from '@/src/api/me';
import { useMeFace } from '@/src/profile/me-face';

type Sheet = 'language' | 'appearance' | null;

export default function PractitionerSettings() {
  const { t: TT, choice, setChoice } = useTheme();
  const router = useRouter();
  const { signOut } = useAuth();
  const confirm = useConfirm();
  const { t, locale, setLocale } = useI18n();
  const face = useMeFace();
  const [name, setName] = useState('');
  const [sheet, setSheet] = useState<Sheet>(null);

  useEffect(() => {
    let alive = true;
    void fetchMe().then((me) => {
      if (!alive || !me) return;
      const full = `${me.firstName ?? ''} ${me.lastName ?? ''}`.trim();
      if (full) setName(full);
    });
    return () => { alive = false; };
  }, []);

  // The server hears about it from the language provider, which retries a save
  // that failed instead of dropping it.
  const changeLocale = (l: Locale) => setLocale(l);

  const doSignOut = async () => {
    if (await confirm({ title: t.settings.signOutConfirm, confirmLabel: t.settings.signOut, cancelLabel: t.common.cancel, destructive: true })) signOut();
  };

  const displayName = face?.name || name || t.settings.practitioner;
  const initial = displayName.charAt(0).toUpperCase();
  const back = () => (router.canGoBack() ? router.back() : router.navigate('/(practitioner)/home' as never));

  const localeLabel = locale === 'fr' ? t.settings.french : t.settings.english;
  const themeLabel = choice === 'light' ? t.settings.themeLight : choice === 'dark' ? t.settings.themeDark : t.settings.themeSystem;

  return (
    <View style={{ flex: 1, backgroundColor: TT.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <EdHeader title={t.settings.title} onBack={back} />

        <FadeIn style={{ paddingHorizontal: 22, paddingTop: 20 }}>
          {/* The card was a statement of who you are; it is the way to change it
              now, picture included. A chevron, because it goes somewhere. */}
          <EdCard style={{ padding: 0, overflow: 'hidden', marginBottom: 24 }}>
            <TouchableOpacity
              onPress={() => router.navigate('/(practitioner)/profile' as never)}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={t.profile.yourDetails}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 16, padding: 16 }}
            >
              {face?.avatarUrl ? (
                <Image source={{ uri: face.avatarUrl }} style={{ width: 52, height: 52, borderRadius: 26, borderWidth: 1, borderColor: TT.cardLine }} />
              ) : (
                <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: TT.accent, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 21, fontWeight: '700', color: TT.onAccent }}>{initial}</Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 17, fontWeight: '700', color: TT.ink }}>{displayName}</Text>
                <Text style={{ fontSize: 13, color: TT.faint, marginTop: 1 }}>{t.settings.practitioner}</Text>
              </View>
              <ChevronRight size={18} color={TT.faint} strokeWidth={2} />
            </TouchableOpacity>
          </EdCard>

          <Kicker color={TT.faint} style={{ marginBottom: 10 }}>{t.settings.preferences}</Kicker>
          <EdCard style={{ padding: 0, overflow: 'hidden', marginBottom: 24 }}>
            <Row Icon={Languages} title={t.settings.language} value={localeLabel} onPress={() => setSheet('language')} divider />
            <Row Icon={Palette} title={t.settings.appearance} value={themeLabel} onPress={() => setSheet('appearance')} />
          </EdCard>

          <Kicker color={TT.faint} style={{ marginBottom: 10 }}>{t.settings.support}</Kicker>
          <EdCard style={{ padding: 0, overflow: 'hidden', marginBottom: 24 }}>
            <Row Icon={MessageCircle} title={t.settings.contactUs} value={t.settings.contactSub} onPress={openContact} divider />
            <Row Icon={MessageCircleQuestionMark} title={t.settings.help} onPress={() => notify(t.common.comingSoon)} />
          </EdCard>

          {/* The same promises the patient can read. A practitioner is the one
              asking patients to accept them, so "what exactly did I ask them to
              agree to" should not require finding the website on a laptop. */}
          <Kicker color={TT.faint} style={{ marginBottom: 10 }}>{t.settings.legalSection}</Kicker>
          <EdCard style={{ padding: 0, overflow: 'hidden', marginBottom: 24 }}>
            <Row Icon={ShieldCheck} title={t.settings.privacyPolicy} onPress={() => openPublic('privacy', locale)} divider />
            <Row Icon={FileText} title={t.settings.termsOfUse} onPress={() => openPublic('terms', locale)} divider />
            <Row Icon={Database} title={t.settings.dataProtection} value={t.settings.dataProtectionSub} onPress={() => openPublic('data-protection', locale)} divider />
            <Row Icon={Lock} title={t.settings.security} value={t.settings.securitySub} onPress={() => openPublic('security', locale)} />
          </EdCard>

          <Kicker color={TT.faint} style={{ marginBottom: 10 }}>{t.settings.accountSection}</Kicker>
          <EdCard style={{ padding: 0, overflow: 'hidden' }}>
            <Row Icon={LogOut} title={t.settings.signOut} onPress={doSignOut} chevron={false} />
          </EdCard>

          <Text style={{ textAlign: 'center', fontSize: 13, color: TT.faint, marginTop: 28 }}>{t.settings.madeBy}</Text>
        </FadeIn>
      </ScrollView>

      <OptionSheet
        visible={sheet === 'language'}
        title={t.settings.language}
        options={[
          { value: 'en', label: t.settings.english },
          { value: 'fr', label: t.settings.french },
        ]}
        selected={locale}
        onSelect={changeLocale}
        onClose={() => setSheet(null)}
      />

      <OptionSheet
        visible={sheet === 'appearance'}
        title={t.settings.appearance}
        options={[
          { value: 'system', label: t.settings.themeSystem, hint: t.settings.themeSystemHint },
          { value: 'light', label: t.settings.themeLight },
          { value: 'dark', label: t.settings.themeDark },
        ]}
        selected={choice}
        onSelect={(v: ThemeChoice) => { setChoice(v); setSheet(null); }}
        onClose={() => setSheet(null)}
      />
    </View>
  );
}

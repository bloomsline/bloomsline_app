// Settings — grouped rows, not a wall of tiles.
//
// This page used to lay every choice out at once: three grids of large tiles,
// each under a heading and a sentence explaining what the choice meant. Eight
// tiles and three paragraphs to say three things, none of which anyone was in
// the middle of changing. Now each setting is one line that states its current
// value, and tapping it opens the options — so the page reads as a summary of
// how the app is set up, which is what someone opening Settings is usually
// checking.
//
// Order is deliberate: language first (the setting most likely to be wrong for
// someone who has just installed the app, and the one that changes every other
// word on the page), then appearance, then the rest.
import { useEffect, useState } from 'react';
import { Image, Linking, Platform, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { MessageCircle, MessageCircleQuestionMark, LogOut, ChevronRight, Trash2, Languages, Palette, Home, type LucideIcon } from 'lucide-react-native';
import { EdHeader, EdCard, FadeIn, Kicker } from '@/src/ui/editorial';
import { OptionSheet } from '@/src/ui/option-sheet';
import { useTheme, type ThemeChoice } from '@/src/ui/theme-mode';
import { useAuth } from '@/src/auth/auth-context';
import { useOnboarding } from '@/src/onboarding/context';
import { useLanding, type LandingTab } from '@/src/prefs/landing';
import { useI18n, type Locale } from '@/src/i18n';
import { useConfirm } from '@/src/ui/confirm';
import { fetchMe, requestAccountDeletion, saveProfile } from '@/src/api/me';
import { useMeFace } from '@/src/profile/me-face';

const APP_VERSION = 'Bloomsline · v2 (preview)';

/** Which setting's options are open, if any. */
type Sheet = 'language' | 'appearance' | 'landing' | null;

export default function Settings() {
  const { choice, setChoice, t: TT } = useTheme();
  const router = useRouter();
  const { signOut } = useAuth();
  const onboarding = useOnboarding();
  const { landing, setLanding } = useLanding();
  const { t, locale, setLocale } = useI18n();
  const confirm = useConfirm();
  const [name, setName] = useState(`${onboarding.firstName} ${onboarding.lastName}`.trim());
  const [role, setRole] = useState<string | null>(null);
  // The shared face, not a local copy. Settings fetched once on mount and never
  // again, so after changing the photo the old one sat on this card until the
  // screen was left and re-entered.
  const face = useMeFace();
  const [leavingAt, setLeavingAt] = useState<string | null>(null);
  const [sheet, setSheet] = useState<Sheet>(null);

  const changeLocale = (l: Locale) => {
    setLocale(l);
    void saveProfile({ locale: l }); // persist as the server-side default
  };

  // Load the real profile (onboarding context may be empty for returning users).
  useEffect(() => {
    let alive = true;
    fetchMe().then((me) => {
      if (!alive || !me) return;
      const full = `${me.firstName ?? ''} ${me.lastName ?? ''}`.trim();
      if (full) setName(full);
      setRole(me.role);
      setLeavingAt(me.deletionRequestedAt);
    });
    return () => { alive = false; };
  }, []);

  const displayName = face?.name || name || t.settings.yourAccount;
  const initial = displayName.charAt(0).toUpperCase();
  const back = () => (router.canGoBack() ? router.back() : router.navigate('/home' as never));

  const contact = () => {
    const url = 'https://wa.me/33671482004?text=' + encodeURIComponent('Hi Bloomsline 👋');
    if (Platform.OS === 'web') globalThis.open?.(url, '_blank');
    else Linking.openURL(url).catch(() => {});
  };

  const doSignOut = async () => {
    if (await confirm({ title: t.settings.signOutConfirm, confirmLabel: t.settings.signOut, cancelLabel: t.common.cancel, destructive: true })) signOut();
  };

  const doDelete = async () => {
    const ok = await confirm({
      title: t.settings.deleteConfirm,
      message: t.settings.deleteMessage,
      confirmLabel: t.settings.deleteCta,
      cancelLabel: t.common.cancel,
      destructive: true,
    });
    if (!ok) return;
    const res = await requestAccountDeletion();
    // Silence would read as "nothing happened" on the one action where that is
    // the wrong thing to believe.
    if (!res) {
      await confirm({ title: t.settings.deleteFailed, confirmLabel: t.common.ok, cancelLabel: t.common.cancel });
      return;
    }
    signOut(); // every token is already revoked server-side
  };

  const themeLabel = choice === 'light' ? t.settings.themeLight : choice === 'dark' ? t.settings.themeDark : t.settings.themeSystem;
  const localeLabel = locale === 'fr' ? t.settings.french : t.settings.english;
  const landingLabel = landing === 'moments' ? t.settings.homeMoments : t.settings.homeCare;

  return (
    <View style={{ flex: 1, backgroundColor: TT.bg }}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {/* No kicker: it would say "Settings" above "Settings". */}
        <EdHeader title={t.settings.title} onBack={back} />

        <FadeIn style={{ paddingHorizontal: 22, paddingTop: 20 }}>
          {/* Who you are signed in as */}
          {/* The card was a statement of who you are; it is the way to change
              it now. A chevron, because it goes somewhere. */}
          <EdCard style={{ padding: 0, overflow: 'hidden', marginBottom: 24 }}>
            <TouchableOpacity
              onPress={() => router.navigate('/profile' as never)}
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
                <Text style={{ fontSize: 13, color: TT.faint, marginTop: 1 }}>{role === 'practitioner' ? t.settings.practitioner : t.settings.account}</Text>
              </View>
              <ChevronRight size={18} color={TT.faint} strokeWidth={2} />
            </TouchableOpacity>
          </EdCard>

          <Kicker color={TT.faint} style={{ marginBottom: 10 }}>{t.settings.preferences}</Kicker>
          <EdCard style={{ padding: 0, overflow: 'hidden', marginBottom: 24 }}>
            <Row Icon={Languages} title={t.settings.language} value={localeLabel} onPress={() => setSheet('language')} divider />
            <Row Icon={Palette} title={t.settings.appearance} value={themeLabel} onPress={() => setSheet('appearance')} divider />
            <Row Icon={Home} title={t.settings.homeScreen} value={landingLabel} onPress={() => setSheet('landing')} />
          </EdCard>

          <Kicker color={TT.faint} style={{ marginBottom: 10 }}>{t.settings.support}</Kicker>
          <EdCard style={{ padding: 0, overflow: 'hidden', marginBottom: 24 }}>
            <Row Icon={MessageCircle} title={t.settings.contactUs} value={t.settings.contactSub} onPress={contact} divider />
            <Row Icon={MessageCircleQuestionMark} title={t.settings.help} onPress={() => Platform.OS === 'web' && globalThis.alert?.(t.common.comingSoon)} />
          </EdCard>

          <Kicker color={TT.faint} style={{ marginBottom: 10 }}>{t.settings.accountSection}</Kicker>
          <EdCard style={{ padding: 0, overflow: 'hidden' }}>
            <Row Icon={LogOut} title={t.settings.signOut} onPress={doSignOut} divider chevron={false} />
            {/* A pending deletion replaces the row rather than sitting beside
                it: the question has been answered, and the useful thing to show
                is the way back. */}
            {leavingAt ? (
              <View style={{ paddingVertical: 15, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Trash2 size={20} color={TT.danger} strokeWidth={1.9} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, color: TT.danger }}>{t.settings.deletePending}</Text>
                  <Text style={{ fontSize: 12.5, color: TT.faint, marginTop: 1 }}>
                    {t.settings.deletePendingSub.replace('{date}', purgeDate(leavingAt, locale))}
                  </Text>
                </View>
              </View>
            ) : (
              <Row Icon={Trash2} title={t.settings.deleteAccount} onPress={doDelete} tone="danger" chevron={false} />
            )}
          </EdCard>

          <Text style={{ textAlign: 'center', fontSize: 13, color: TT.faint, marginTop: 28 }}>{APP_VERSION}</Text>
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
        onSelect={(v: ThemeChoice) => setChoice(v)}
        onClose={() => setSheet(null)}
      />

      <OptionSheet
        visible={sheet === 'landing'}
        title={t.settings.homeScreen}
        options={[
          { value: 'care', label: t.settings.homeCare },
          { value: 'moments', label: t.settings.homeMoments },
        ]}
        selected={landing}
        onSelect={(v: LandingTab) => setLanding(v)}
        onClose={() => setSheet(null)}
      />
    </View>
  );
}

/** The day the account actually goes, in the reader's language. */
function purgeDate(requestedAt: string, locale: Locale): string {
  const d = new Date(new Date(requestedAt).getTime() + 30 * 86_400_000);
  return d.toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-GB', { day: 'numeric', month: 'long' });
}

function Row({ Icon, title, value, onPress, divider, tone, chevron = true }: {
  Icon: LucideIcon;
  title: string;
  /** The setting's current value, or a one-line hint for a row that has none. */
  value?: string;
  onPress: () => void;
  divider?: boolean;
  tone?: 'danger';
  /** A chevron promises somewhere to go. Sign out and Delete are acts, not
   *  destinations, so they do not get one. */
  chevron?: boolean;
}) {
  const { t: TT } = useTheme();
  const ink = tone === 'danger' ? TT.danger : TT.ink;
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={{ paddingVertical: 15, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: divider ? 1 : 0, borderBottomColor: TT.line }}
    >
      <Icon size={20} color={tone === 'danger' ? TT.danger : TT.accent} strokeWidth={1.9} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 16, color: ink }}>{title}</Text>
        {value ? <Text style={{ fontSize: 12.5, color: TT.faint, marginTop: 1 }}>{value}</Text> : null}
      </View>
      {chevron ? <ChevronRight size={18} color={TT.faint} strokeWidth={2} /> : null}
    </TouchableOpacity>
  );
}

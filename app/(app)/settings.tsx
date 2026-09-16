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
import { useRouter } from 'expo-router';
import { MessageCircle, MessageCircleQuestionMark, LogOut, ChevronRight, ChevronDown, Trash2, Languages, Palette, Home, ShieldCheck, FileText, Database, Lock, UserRound, ChartNoAxesColumn } from 'lucide-react-native';
import { notify } from '@/src/ui/alert';
import { EdHeader, EdCard, FadeIn, Kicker } from '@/src/ui/editorial';
import { OptionSheet } from '@/src/ui/option-sheet';
import { useTheme, type ThemeChoice } from '@/src/ui/theme-mode';
import { useAuth } from '@/src/auth/auth-context';
import { useOnboarding } from '@/src/onboarding/context';
import { useLanding, type LandingTab } from '@/src/prefs/app-prefs';
import { useI18n, type Locale } from '@/src/i18n';
import { useConfirm } from '@/src/ui/confirm';
import { fetchMe, requestAccountDeletion } from '@/src/api/me';
import { useMeFace } from '@/src/profile/me-face';
import { Row } from '@/src/ui/settings-row';
import { useSelectedPractitioner } from '@/src/care/selected-practitioner';
import { usePractitionerSwitcher } from '@/src/care/PractitionerSwitcher';
import { useAnalytics } from '@/src/analytics/provider';
import { track } from '@/src/analytics/client';

// Was "Bloomsline · v2 (preview)". A version string is a note we left for
// ourselves at the foot of a patient's own settings screen, and "preview" tells
// someone trusting the app with how they feel that it is not finished yet.

/** Which setting's options are open, if any. */
type Sheet = 'language' | 'appearance' | 'landing' | 'analytics' | null;

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
  // The statistics answer, so it can be changed here as easily as it was given.
  const analytics = useAnalytics();
  // Deliberately NOT persisted. Revealing the delete row is a decision about
  // this visit; a patient who opened it once last month and moved on should not
  // find it waiting for their thumb the next time they change their language.
  const [showMore, setShowMore] = useState(false);
  // Which practitioner the app is showing, for a patient linked to several.
  // Here as well as on My Care because Settings is where people look for "who
  // am I looking at" once they have forgotten where the switch was.
  const { selected } = useSelectedPractitioner();
  const switcher = usePractitionerSwitcher();

  // The server hears about it from the language provider, which retries a save
  // that failed instead of dropping it.
  const changeLocale = (l: Locale) => setLocale(l);

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

  /**
   * The public pages, in the patient's own language.
   *
   * Not copies. These same documents are what the site serves, and the one
   * thing worse than a policy nobody reads is two versions of it that disagree
   * — so the app links to the source rather than restating it.
   */
  const openPublic = (slug: string) => {
    const url = `https://www.bloomsline.com${locale === 'fr' ? '/fr' : ''}/${slug}`;
    if (Platform.OS === 'web') globalThis.open?.(url, '_blank');
    else Linking.openURL(url).catch(() => {});
  };

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
    track('account_deletion_requested');
    signOut(); // every token is already revoked server-side
  };

  const themeLabel = choice === 'light' ? t.settings.themeLight : choice === 'dark' ? t.settings.themeDark : t.settings.themeSystem;
  const localeLabel = locale === 'fr' ? t.settings.french : t.settings.english;
  const landingLabel = landing === 'moments' ? t.settings.homeMoments : t.settings.homeCare;

  return (
    <View style={{ flex: 1, backgroundColor: TT.bg }}>
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
            <Row Icon={Home} title={t.settings.homeScreen} value={landingLabel} onPress={() => setSheet('landing')} divider={switcher.canSwitch} />
            {switcher.canSwitch ? (
              <Row Icon={UserRound} title={t.settings.yourPractitioner} value={selected?.name} onPress={switcher.open} />
            ) : null}
          </EdCard>

          <Kicker color={TT.faint} style={{ marginBottom: 10 }}>{t.settings.support}</Kicker>
          <EdCard style={{ padding: 0, overflow: 'hidden', marginBottom: 24 }}>
            <Row Icon={MessageCircle} title={t.settings.contactUs} value={t.settings.contactSub} onPress={contact} divider />
            <Row Icon={MessageCircleQuestionMark} title={t.settings.help} onPress={() => notify(t.common.comingSoon)} />
          </EdCard>

          {/* Where the promises live. A patient consented to these during
              onboarding and has had no way to read them again since; "what did
              I agree to" is a fair question at any hour, and it should not
              require finding the website on a laptop. */}
          <Kicker color={TT.faint} style={{ marginBottom: 10 }}>{t.settings.legalSection}</Kicker>
          <EdCard style={{ padding: 0, overflow: 'hidden', marginBottom: 24 }}>
            <Row Icon={ShieldCheck} title={t.settings.privacyPolicy} onPress={() => openPublic('privacy')} divider />
            <Row Icon={FileText} title={t.settings.termsOfUse} onPress={() => openPublic('terms')} divider />
            <Row Icon={Database} title={t.settings.dataProtection} value={t.settings.dataProtectionSub} onPress={() => openPublic('data-protection')} divider />
            <Row Icon={Lock} title={t.settings.security} value={t.settings.securitySub} onPress={() => openPublic('security')} divider={analytics.available} />
            {/* Changing your mind has to be as easy as the sheet that asked.
                Hidden entirely in a build with no analytics key, rather than
                offering a setting that does nothing. */}
            {analytics.available ? (
              <Row
                Icon={ChartNoAxesColumn}
                title={t.settings.statistics}
                value={analytics.consent === 'granted' ? t.settings.statisticsOn : t.settings.statisticsOff}
                onPress={() => setSheet('analytics')}
              />
            ) : null}
          </EdCard>

          <Kicker color={TT.faint} style={{ marginBottom: 10 }}>{t.settings.accountSection}</Kicker>
          <EdCard style={{ padding: 0, overflow: 'hidden' }}>
            <Row Icon={LogOut} title={t.settings.signOut} onPress={doSignOut} divider={showMore || !!leavingAt} chevron={false} />

            {/* Deleting an account sat one row under signing out of it, the same
                size and a thumb's width away, and it was tapped by accident.
                The confirm caught it — but a destructive action should not be
                relying on its confirm to be the first line of defence. It is
                behind a disclosure now: a deliberate press to reveal it, then
                the confirm, then the seven days it already waits before
                anything is purged.

                A pending deletion is NOT hidden. That question has been asked
                and answered, and the useful thing then is the way back. */}
            {!leavingAt && !showMore ? (
              <Row Icon={ChevronDown} title={t.settings.moreOptions} onPress={() => setShowMore(true)} chevron={false} />
            ) : null}
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
            ) : showMore ? (
              <Row Icon={Trash2} title={t.settings.deleteAccount} onPress={doDelete} tone="danger" chevron={false} />
            ) : null}
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

      <OptionSheet
        visible={sheet === 'analytics'}
        title={t.analytics.sheetTitle}
        options={[
          { value: 'granted', label: t.settings.statisticsOn, hint: t.analytics.onHint },
          { value: 'refused', label: t.settings.statisticsOff, hint: t.analytics.offHint },
        ]}
        selected={analytics.consent === 'granted' ? 'granted' : 'refused'}
        onSelect={(v: 'granted' | 'refused') => analytics.setAnalyticsConsent(v === 'granted')}
        onClose={() => setSheet(null)}
      />

      {switcher.element}
    </View>
  );
}

/** The day the account actually goes, in the reader's language. */
function purgeDate(requestedAt: string, locale: Locale): string {
  const d = new Date(new Date(requestedAt).getTime() + 30 * 86_400_000);
  return d.toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-GB', { day: 'numeric', month: 'long' });
}

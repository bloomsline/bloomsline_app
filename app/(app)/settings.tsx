// Settings — v2 mobile, hybrid editorial re-skin. A dark photographic header,
// then light editorial content: profile, home-screen + language toggles, support,
// and sign out. Only presentation changed — all logic (useLanding, useI18n,
// setLocale, saveProfile, signOut) is preserved.
import { useEffect, useState } from 'react';
import { Linking, Platform, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { MessageCircle, MessageCircleQuestionMark, LogOut, ChevronRight, User, Heart, Check, Languages, type LucideIcon, Sun, Moon, SunMoon} from 'lucide-react-native';
import { EdHeader, EdCard, EdSection, FadeIn, MonoLabel } from '@/src/ui/editorial';
import { useTheme } from '@/src/ui/theme-mode';
import { useAuth } from '@/src/auth/auth-context';
import { useOnboarding } from '@/src/onboarding/context';
import { useLanding } from '@/src/prefs/landing';
import { useI18n, type Locale } from '@/src/i18n';
import { useConfirm } from '@/src/ui/confirm';
import { fetchMe, saveProfile } from '@/src/api/me';

const APP_VERSION = 'Bloomsline · v2 (preview)';

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
    });
    return () => { alive = false; };
  }, []);

  const displayName = name || 'Your account';
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

  return (
    <View style={{ flex: 1, backgroundColor: TT.bg }}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <EdHeader kicker="SETTINGS" title={t.settings.title} onBack={back} />

        <FadeIn style={{ paddingHorizontal: 22, paddingTop: 20 }}>
          {/* Profile card */}
          <EdCard style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 24 }}>
            <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: TT.accent, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 21, fontWeight: '700', color: '#fff' }}>{initial}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 17, fontWeight: '700', color: TT.ink }}>{displayName}</Text>
              <Text style={{ fontSize: 13, color: TT.faint, marginTop: 1 }}>{role === 'practitioner' ? t.settings.practitioner : t.settings.account}</Text>
            </View>
          </EdCard>

          {/* Appearance — first, because changing it re-renders everything below
              it, so the effect of the tap is visible in the same glance. */}
          <MonoLabel color={TT.faint} style={{ marginBottom: 6 }}>{t.settings.appearance}</MonoLabel>
          <Text style={{ fontSize: 13, color: TT.inkSoft, marginBottom: 12, lineHeight: 18 }}>{t.settings.appearanceSub}</Text>
          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 24 }}>
            <ToggleOption Icon={SunMoon} label={t.settings.themeSystem} selected={choice === 'system'} onPress={() => setChoice('system')} />
            <ToggleOption Icon={Sun} label={t.settings.themeLight} selected={choice === 'light'} onPress={() => setChoice('light')} />
            <ToggleOption Icon={Moon} label={t.settings.themeDark} selected={choice === 'dark'} onPress={() => setChoice('dark')} />
          </View>

          {/* Home screen — which tab you open to, and where the greeting shows. */}
          <MonoLabel color={TT.faint} style={{ marginBottom: 6 }}>{t.settings.homeScreen}</MonoLabel>
          <Text style={{ fontSize: 13, color: TT.inkSoft, marginBottom: 12, lineHeight: 18 }}>{t.settings.homeScreenSub}</Text>
          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 24 }}>
            <ToggleOption Icon={User} label={t.tabs.care} selected={landing === 'care'} onPress={() => setLanding('care')} />
            <ToggleOption Icon={Heart} label={t.tabs.moments} selected={landing === 'moments'} onPress={() => setLanding('moments')} />
          </View>

          {/* Language */}
          <MonoLabel color={TT.faint} style={{ marginBottom: 6 }}>{t.settings.language}</MonoLabel>
          <Text style={{ fontSize: 13, color: TT.inkSoft, marginBottom: 12, lineHeight: 18 }}>{t.settings.languageSub}</Text>
          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 24 }}>
            <ToggleOption Icon={Languages} label={t.settings.english} selected={locale === 'en'} onPress={() => changeLocale('en')} />
            <ToggleOption Icon={Languages} label={t.settings.french} selected={locale === 'fr'} onPress={() => changeLocale('fr')} />
          </View>

          {/* Support */}
          <EdSection label={t.settings.support} />
          <EdCard style={{ padding: 0, overflow: 'hidden', marginBottom: 24 }}>
            <Row Icon={MessageCircle} tint={TT.accent} title={t.settings.contactUs} sub={t.settings.contactSub} onPress={contact} divider />
            <Row Icon={MessageCircleQuestionMark} tint={TT.faint} title={t.settings.help} onPress={() => Platform.OS === 'web' && globalThis.alert?.(t.common.comingSoon)} />
          </EdCard>

          {/* Sign out */}
          <TouchableOpacity onPress={doSignOut} activeOpacity={0.8} style={{ backgroundColor: TT.card, borderWidth: 1, borderColor: TT.line, borderRadius: 18, paddingVertical: 16, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <LogOut size={19} color="#C0392B" strokeWidth={2} />
            <Text style={{ fontSize: 16, fontWeight: '600', color: '#C0392B' }}>{t.settings.signOut}</Text>
          </TouchableOpacity>

          <Text style={{ textAlign: 'center', fontSize: 13, color: TT.faint, marginTop: 28 }}>{APP_VERSION}</Text>
        </FadeIn>
      </ScrollView>
    </View>
  );
}

function ToggleOption({ Icon, label, selected, onPress }: { Icon: LucideIcon; label: string; selected: boolean; onPress: () => void }) {
  const { t: TT } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={{
        flex: 1,
        backgroundColor: selected ? TT.accentTint : TT.card,
        borderWidth: 1.5,
        borderColor: selected ? TT.accent : TT.line,
        borderRadius: 16,
        paddingVertical: 18,
        alignItems: 'center',
        gap: 8,
      }}
    >
      <View style={{ position: 'absolute', top: 10, right: 10, width: 18, height: 18, borderRadius: 9, backgroundColor: selected ? TT.accent : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
        {selected ? <Check size={12} color="#fff" strokeWidth={3} /> : null}
      </View>
      <Icon size={24} color={selected ? TT.accent : TT.faint} strokeWidth={2} />
      <Text style={{ fontSize: 14, fontWeight: '600', color: selected ? TT.ink : TT.inkSoft }}>{label}</Text>
    </TouchableOpacity>
  );
}

function Row({ Icon, tint, title, sub, onPress, divider }: { Icon: typeof MessageCircle; tint: string; title: string; sub?: string; onPress: () => void; divider?: boolean }) {
  const { t: TT } = useTheme();
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={{ paddingVertical: 15, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: divider ? 1 : 0, borderBottomColor: TT.line }}>
      <Icon size={20} color={tint} strokeWidth={1.9} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 16, color: TT.ink }}>{title}</Text>
        {sub ? <Text style={{ fontSize: 12.5, color: TT.faint, marginTop: 1 }}>{sub}</Text> : null}
      </View>
      <ChevronRight size={18} color={TT.faint} strokeWidth={2} />
    </TouchableOpacity>
  );
}

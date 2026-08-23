import { useEffect, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { Check, Languages, LogOut, type LucideIcon } from 'lucide-react-native';
import { EdHeader, EdCard, EdSection, FadeIn, Kicker } from '@/src/ui/editorial';
import { useAuth } from '@/src/auth/auth-context';
import { useConfirm } from '@/src/ui/confirm';
import { useI18n, type Locale } from '@/src/i18n';
import { fetchMe, saveProfile } from '@/src/api/me';
import { useTheme } from '@/src/ui/theme-mode';

// Practitioner settings — the same shape as the patient's (app/(app)/settings):
// profile card, language toggle, sign out. Language changes the app AND is
// persisted server-side, so their emails follow on any device rather than only
// where the switch was flipped.
const T = {
  en: { kicker: 'SETTINGS', title: 'Settings', language: 'LANGUAGE', languageSub: 'Used across the app and in what we send you.', english: 'English', french: 'Français', account: 'ACCOUNT', practitioner: 'Practitioner', signOut: 'Sign out', signOutConfirm: 'Sign out?', cancel: 'Cancel' },
  fr: { kicker: 'RÉGLAGES', title: 'Réglages', language: 'LANGUE', languageSub: 'Utilisée dans l’app et dans ce que nous vous envoyons.', english: 'English', french: 'Français', account: 'COMPTE', practitioner: 'Praticien', signOut: 'Se déconnecter', signOutConfirm: 'Se déconnecter ?', cancel: 'Annuler' },
} as const;

export default function PractitionerSettings() {
  const { t: TT } = useTheme();
  const router = useRouter();
  const { signOut } = useAuth();
  const confirm = useConfirm();
  const { locale, setLocale } = useI18n();
  const tr = T[locale] ?? T.en;
  const [name, setName] = useState('');

  useEffect(() => {
    let alive = true;
    void fetchMe().then((me) => {
      if (!alive || !me) return;
      setName(`${me.firstName ?? ''} ${me.lastName ?? ''}`.trim());
    });
    return () => { alive = false; };
  }, []);

  const changeLocale = (l: Locale) => {
    setLocale(l);
    void saveProfile({ locale: l }); // persist as the server-side default
  };

  const doSignOut = async () => {
    if (await confirm({ title: tr.signOutConfirm, confirmLabel: tr.signOut, cancelLabel: tr.cancel, destructive: true })) signOut();
  };

  const displayName = name || tr.practitioner;
  const back = () => (router.canGoBack() ? router.back() : router.navigate('/(practitioner)/home' as never));

  return (
    <View style={{ flex: 1, backgroundColor: TT.bg }}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <EdHeader kicker={tr.kicker} title={tr.title} onBack={back} />

        <FadeIn style={{ paddingHorizontal: 22, paddingTop: 20 }}>
          <EdCard style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 24 }}>
            <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: TT.accent, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 21, fontWeight: '700', color: TT.onAccent }}>{displayName.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 17, fontWeight: '700', color: TT.ink }}>{displayName}</Text>
              <Text style={{ fontSize: 13, color: TT.faint, marginTop: 1 }}>{tr.practitioner}</Text>
            </View>
          </EdCard>

          <Kicker color={TT.faint} style={{ marginBottom: 6 }}>{tr.language}</Kicker>
          <Text style={{ fontSize: 13, color: TT.inkSoft, marginBottom: 12, lineHeight: 18 }}>{tr.languageSub}</Text>
          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 24 }}>
            <ToggleOption Icon={Languages} label={tr.english} selected={locale === 'en'} onPress={() => changeLocale('en')} />
            <ToggleOption Icon={Languages} label={tr.french} selected={locale === 'fr'} onPress={() => changeLocale('fr')} />
          </View>

          <EdSection label={tr.account} />
          <EdCard onPress={doSignOut} style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View style={{ height: 38, width: 38, borderRadius: 19, backgroundColor: TT.bg, alignItems: 'center', justifyContent: 'center' }}>
              <LogOut size={17} color={TT.faint} strokeWidth={2} />
            </View>
            <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: TT.ink }}>{tr.signOut}</Text>
          </EdCard>
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
        flex: 1, backgroundColor: selected ? TT.accentTint : TT.card,
        borderWidth: 1.5, borderColor: selected ? TT.accent : TT.line,
        borderRadius: 16, paddingVertical: 18, alignItems: 'center', gap: 8,
      }}
    >
      <View style={{ position: 'absolute', top: 10, right: 10, width: 18, height: 18, borderRadius: 9, backgroundColor: selected ? TT.accent : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
        {selected ? <Check size={11} color={TT.onAccent} strokeWidth={3} /> : null}
      </View>
      <Icon size={20} color={selected ? TT.accent : TT.faint} strokeWidth={2} />
      <Text style={{ fontSize: 14, fontWeight: '700', color: selected ? TT.accentDeep : TT.inkSoft }}>{label}</Text>
    </TouchableOpacity>
  );
}

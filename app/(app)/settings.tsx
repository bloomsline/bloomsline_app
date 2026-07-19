// Settings — v2 mobile. A clean equivalent of the v1 settings screen using only
// what's wired in v2: profile (from /api/mobile/me), contact, and sign out.
// Deferred (not yet wired in v2 mobile): language toggle (no i18n), the in-app
// feedback form (no /api/feedback), and edit-name.
import { useEffect, useState } from 'react';
import { Linking, Platform, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, MessageCircle, MessageCircleQuestionMark, LogOut, ChevronRight } from 'lucide-react-native';
import { CARE } from '@/src/care/theme';
import { useAuth } from '@/src/auth/auth-context';
import { useOnboarding } from '@/src/onboarding/context';
import { fetchMe } from '@/src/api/me';

const APP_VERSION = 'Bloomsline · v2 (preview)';

export default function Settings() {
  const router = useRouter();
  const { signOut } = useAuth();
  const onboarding = useOnboarding();
  const [name, setName] = useState(`${onboarding.firstName} ${onboarding.lastName}`.trim());
  const [role, setRole] = useState<string | null>(null);

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

  const doSignOut = () => {
    if (Platform.OS === 'web') {
      if (globalThis.confirm?.('Sign out?')) signOut();
    } else {
      signOut();
    }
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: CARE.canvas }}>
      <View style={{ paddingHorizontal: 24, paddingTop: 8 }}>
        <TouchableOpacity onPress={back} activeOpacity={0.7} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: '#fff', borderWidth: 1, borderColor: CARE.border, alignItems: 'center', justifyContent: 'center' }}>
          <ChevronLeft size={18} color="#333" strokeWidth={2} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <Text style={{ fontSize: 30, fontWeight: '700', letterSpacing: -0.6, color: CARE.ink, marginBottom: 24 }}>Settings</Text>

        {/* Profile card */}
        <View style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: CARE.border, borderRadius: 20, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 24 }}>
          <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: CARE.teal, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 21, fontWeight: '700', color: '#fff' }}>{initial}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 17, fontWeight: '700', color: CARE.ink }}>{displayName}</Text>
            <Text style={{ fontSize: 13, color: '#999', marginTop: 1 }}>{role === 'practitioner' ? 'Practitioner' : 'Bloomsline account'}</Text>
          </View>
        </View>

        {/* Support */}
        <Text style={{ fontSize: 12.5, fontWeight: '600', color: '#9A9A9A', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>Support</Text>
        <View style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: CARE.border, borderRadius: 18, overflow: 'hidden', marginBottom: 24 }}>
          <Row Icon={MessageCircle} tint={CARE.teal} title="Contact us" sub="Quick response via WhatsApp" onPress={contact} divider />
          <Row Icon={MessageCircleQuestionMark} tint="#9A9A9A" title="Help & Support" onPress={() => Platform.OS === 'web' && globalThis.alert?.('Coming soon')} />
        </View>

        {/* Sign out */}
        <TouchableOpacity onPress={doSignOut} activeOpacity={0.8} style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: CARE.border, borderRadius: 18, paddingVertical: 16, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <LogOut size={19} color={CARE.danger} strokeWidth={2} />
          <Text style={{ fontSize: 16, fontWeight: '600', color: CARE.danger }}>Sign out</Text>
        </TouchableOpacity>

        <Text style={{ textAlign: 'center', fontSize: 13, color: '#CCC', marginTop: 28 }}>{APP_VERSION}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ Icon, tint, title, sub, onPress, divider }: { Icon: typeof MessageCircle; tint: string; title: string; sub?: string; onPress: () => void; divider?: boolean }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={{ paddingVertical: 15, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: divider ? 1 : 0, borderBottomColor: '#F2F2F2' }}>
      <Icon size={20} color={tint} strokeWidth={1.9} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 16, color: CARE.ink }}>{title}</Text>
        {sub ? <Text style={{ fontSize: 12.5, color: '#999', marginTop: 1 }}>{sub}</Text> : null}
      </View>
      <ChevronRight size={18} color="#CCC" strokeWidth={2} />
    </TouchableOpacity>
  );
}

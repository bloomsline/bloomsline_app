import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { EditorialBg, Scrim, MonoKicker, Pill } from '@/src/onboarding/editorial/kit';
import { AnimatedPromiseIcon, type PromiseIcon } from '@/src/onboarding/editorial/AnimatedIcon';
import { ONBOARDING_IMAGES } from '@/src/onboarding/editorial/images';
import { useOnboarding } from '@/src/onboarding/context';
import { useI18n } from '@/src/i18n';
import { saveProfile } from '@/src/api/me';

// e4b — The privacy promise, editorial theme. Imagery held behind a deep scrim,
// promises as hairline-divided rows, an explicit consent checkbox above the pill.
export default function Privacy() {
  const { update } = useOnboarding();
  const { locale } = useI18n();
  const [agreed, setAgreed] = useState(false);

  const T = {
    en: {
      kicker: 'The trust bit',
      title: 'Your stuff stays\nyour stuff.',
      subtitle: 'No jargon, no 40-page policy. Just the promises that matter.',
      rows: [
        { icon: 'lock' as PromiseIcon, title: 'Private by default', body: "What you write is yours. We're not reading over your shoulder." },
        { icon: 'ban' as PromiseIcon, title: 'Never sold. Full stop.', body: 'No ads, no data brokers, no "surprise" third parties.' },
        { icon: 'shield' as PromiseIcon, title: 'Locked up tight', body: "Encrypted end to end. Even we can't peek, that's the point." },
        { icon: 'wave' as PromiseIcon, title: 'Leave anytime, take it all', body: 'Export or delete everything in one tap. No hard feelings.' },
      ],
      consentPre: "I've read and agree to the ",
      consentA: 'privacy promise',
      consentMid: ' and ',
      consentB: 'terms',
      cta: 'Love it, continue',
    },
    fr: {
      kicker: 'Le pacte de confiance',
      title: 'Vos données restent\nles vôtres.',
      subtitle: 'Pas de jargon, pas de politique de 40 pages. Juste les promesses qui comptent.',
      rows: [
        { icon: 'lock' as PromiseIcon, title: 'Privé par défaut', body: 'Ce que vous écrivez vous appartient. Nous ne lisons pas par-dessus votre épaule.' },
        { icon: 'ban' as PromiseIcon, title: 'Jamais vendu. Point.', body: 'Pas de pub, pas de courtiers en données, pas de tiers « surprise ».' },
        { icon: 'shield' as PromiseIcon, title: 'Bien protégé', body: 'Chiffré de bout en bout. Même nous ne pouvons pas regarder, c’est le principe.' },
        { icon: 'wave' as PromiseIcon, title: 'Partez quand vous voulez, avec tout', body: 'Exportez ou supprimez tout en un geste. Sans rancune.' },
      ],
      consentPre: 'J’ai lu et j’accepte la ',
      consentA: 'promesse de confidentialité',
      consentMid: ' et les ',
      consentB: 'conditions',
      cta: 'J’adore, continuer',
    },
  }[locale];

  const next = () => {
    if (!agreed) return;
    update({ agreedToTerms: true });
    saveProfile({ agreedToTerms: true });
    router.push('/(onboarding)/ready');
  };

  return (
    <View style={{ flex: 1 }}>
      <StatusBar style="light" />
      <EditorialBg source={ONBOARDING_IMAGES.privacy}>
        <Scrim colors={['rgba(16,18,16,0.72)', 'rgba(16,18,16,0.88)', 'rgba(16,18,16,0.96)']} locations={[0, 0.42, 1]} />
        <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1 }}>
          <View style={{ flex: 1, paddingHorizontal: 24 }}>
            {/* Header: back + 2-seg progress + counter */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingTop: 8 }}>
              <Pressable onPress={() => router.back()} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' }}>
                <ChevronLeft size={18} color="#fff" strokeWidth={2} />
              </Pressable>
              <View style={{ flex: 1, flexDirection: 'row', gap: 6 }}>
                <View style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: '#fff' }} />
                <View style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: '#fff' }} />
              </View>
              <MonoKicker size={10} color="rgba(255,255,255,0.55)">02/02</MonoKicker>
            </View>

            <MonoKicker size={10} color="rgba(255,255,255,0.55)" style={{ marginTop: 26, marginBottom: 12 }}>{T.kicker}</MonoKicker>
            <Text style={{ fontSize: 30, fontWeight: '800', color: '#fff', letterSpacing: -1.1, lineHeight: 32 }}>{T.title}</Text>
            <Text style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.7)', lineHeight: 20, marginTop: 10 }}>{T.subtitle}</Text>

            <View style={{ marginTop: 20 }}>
              {T.rows.map((r, i) => (
                <View key={r.title} style={{ flexDirection: 'row', gap: 13, alignItems: 'flex-start', paddingVertical: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.12)' }}>
                  <View style={{ width: 22, alignItems: 'center', marginTop: 1 }}>
                    <AnimatedPromiseIcon type={r.icon} delay={i * 130} color="#fff" size={19} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff' }}>{r.title}</Text>
                    <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.62)', lineHeight: 17, marginTop: 2 }}>{r.body}</Text>
                  </View>
                </View>
              ))}
            </View>

            <View style={{ flex: 1 }} />

            <View style={{ paddingBottom: 10 }}>
              <Pressable onPress={() => setAgreed((v) => !v)} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 11, marginBottom: 16 }}>
                <View style={{ width: 22, height: 22, borderRadius: 7, backgroundColor: agreed ? '#fff' : 'transparent', borderWidth: agreed ? 0 : 1.5, borderColor: 'rgba(255,255,255,0.5)', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
                  {agreed ? <Text style={{ fontSize: 13, fontWeight: '800', color: '#141414' }}>✓</Text> : null}
                </View>
                <Text style={{ flex: 1, fontSize: 12.5, color: 'rgba(255,255,255,0.78)', lineHeight: 18 }}>
                  {T.consentPre}<Text style={{ color: '#fff', fontWeight: '700' }}>{T.consentA}</Text>{T.consentMid}<Text style={{ color: '#fff', fontWeight: '700' }}>{T.consentB}</Text>.
                </Text>
              </Pressable>
              <Pill label={T.cta} variant="white" disabled={!agreed} onPress={next} />
            </View>
          </View>
        </SafeAreaView>
      </EditorialBg>
    </View>
  );
}

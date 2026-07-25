import { useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { EditorialBg, Scrim, MonoKicker, HaloArrow, Dashes, RiseIn } from '@/src/onboarding/editorial/kit';
import { ONBOARDING_IMAGES } from '@/src/onboarding/editorial/images';
import { useOnboarding } from '@/src/onboarding/context';
import { useI18n } from '@/src/i18n';

// e2–e3b — the swipeable value carousel. Top-anchored (card near the top, a peek
// of the next card, controls directly under it), weighted deceleration, a mono
// NN / 04 counter, the halo arrow, and a Continue pill that stays dimmed until
// every card has been seen.
export default function Stories() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { practitionerName } = useOnboarding();
  const { locale } = useI18n();
  const prac = (practitionerName ?? (locale === 'fr' ? 'Votre praticien' : 'Your practitioner')).replace(/^dr\.?\s*/i, '').split(/\s+/)[0];

  const PAD = 24;
  const GAP = 12;
  const CARD_W = Math.min(320, width - 64);
  const SNAP = CARD_W + GAP;
  const TOP_GAP = 14;
  const HEADER = 116;
  const CONTROLS = 112;
  const CARD_H = Math.max(340, height - insets.top - insets.bottom - TOP_GAP - HEADER - CONTROLS);

  const intro = {
    en: { kicker: 'Welcome', title: 'A few things\nto know.' },
    fr: { kicker: 'Bienvenue', title: 'Quelques mots\npour commencer.' },
  }[locale];

  const cards = {
    en: [
      { title: "A space that's\njust yours", body: 'No pressure. Come as you are, whenever you like.', img: ONBOARDING_IMAGES.card1 },
      { title: 'Private, unless\nyou say so', body: `You choose what ${prac} sees. Change your mind anytime.`, img: ONBOARDING_IMAGES.card2 },
      { title: `${prac} is\nright beside you`, body: 'Your sessions and shared notes, all in one place.', img: ONBOARDING_IMAGES.card3 },
      { title: 'Something for\nthe harder days', body: 'Gentle tools for when it feels heavy.', img: ONBOARDING_IMAGES.card4 },
    ],
    fr: [
      { title: 'Un espace\nrien qu’à vous', body: 'Pas de pression. Venez comme vous êtes, quand vous voulez.', img: ONBOARDING_IMAGES.card1 },
      { title: 'Privé, sauf si\nvous décidez', body: `Vous choisissez ce que ${prac} voit. Changez d’avis à tout moment.`, img: ONBOARDING_IMAGES.card2 },
      { title: `${prac} est\nà vos côtés`, body: 'Vos séances et les notes partagées, au même endroit.', img: ONBOARDING_IMAGES.card3 },
      { title: 'Pour les jours\nplus difficiles', body: 'Des outils doux pour quand c’est lourd.', img: ONBOARDING_IMAGES.card4 },
    ],
  }[locale];

  const scroller = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);
  const [maxSeen, setMaxSeen] = useState(0);
  const seenAll = maxSeen >= cards.length - 1;
  const cta = locale === 'fr' ? 'Continuer' : 'Get started';

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / SNAP);
    if (i !== index) setIndex(i);
    if (i > maxSeen) setMaxSeen(i);
  };
  const goNext = (i: number) => scroller.current?.scrollTo({ x: (i + 1) * SNAP, animated: true });

  return (
    <View style={{ flex: 1, backgroundColor: '#0E1512', paddingTop: insets.top + TOP_GAP, paddingBottom: insets.bottom + 10 }}>
      <StatusBar style="light" />

      <RiseIn style={{ paddingHorizontal: 24, height: HEADER, justifyContent: 'flex-start', paddingTop: 4, paddingBottom: 24 }}>
        <MonoKicker size={11} color="rgba(255,255,255,0.6)" style={{ marginBottom: 8 }}>{intro.kicker}</MonoKicker>
        <Text style={{ fontSize: 27, fontWeight: '800', color: '#fff', letterSpacing: -0.9, lineHeight: 30 }}>{intro.title}</Text>
      </RiseIn>

      <ScrollView
        ref={scroller}
        horizontal
        style={{ height: CARD_H, flexGrow: 0 }}
        showsHorizontalScrollIndicator={false}
        snapToInterval={SNAP}
        decelerationRate={0.86}
        disableIntervalMomentum
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingLeft: PAD, paddingRight: PAD }}
      >
        {cards.map((c, i) => {
          const last = i === cards.length - 1;
          return (
            <View key={i} style={{ width: CARD_W, height: CARD_H, marginRight: GAP, borderRadius: 22, overflow: 'hidden', opacity: i === index ? 1 : 0.5 }}>
              <EditorialBg source={c.img} />
              <Scrim colors={['rgba(16,18,16,0.28)', 'transparent', 'rgba(16,18,16,0.86)']} locations={[0, 0.4, 1]} />
              <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: 22 }}>
                <Text style={{ fontSize: 25, fontWeight: '800', color: '#fff', letterSpacing: -0.8, lineHeight: 28 }}>{c.title}</Text>
                <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.85)', lineHeight: 21, marginTop: 10 }}>{c.body}</Text>
                <MonoKicker size={11} color="rgba(255,255,255,0.65)" style={{ marginTop: 18 }}>{`0${i + 1} / 0${cards.length}`}</MonoKicker>
              </View>
              {!last && (
                <Pressable onPress={() => goNext(i)} style={{ position: 'absolute', right: 16, bottom: 18 }}>
                  <HaloArrow />
                </Pressable>
              )}
            </View>
          );
        })}
      </ScrollView>

      <View style={{ paddingHorizontal: 24, paddingTop: 20 }}>
        <View style={{ marginBottom: 16 }}>
          <Dashes total={cards.length} index={index} />
        </View>
        {seenAll ? (
          <Pressable onPress={() => router.push('/(onboarding)/about-you')} style={{ height: 54, borderRadius: 27, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: '#141414' }}>{cta}</Text>
          </Pressable>
        ) : (
          <View style={{ height: 54, borderRadius: 27, backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.24)', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: 'rgba(255,255,255,0.42)' }}>{cta}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

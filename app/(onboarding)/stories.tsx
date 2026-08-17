import { useRef, useState } from 'react';
import { PanResponder, Platform, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { EditorialBg, Scrim, MonoKicker, Dashes, RiseIn, Pill } from '@/src/onboarding/editorial/kit';
import { ONBOARDING_IMAGES } from '@/src/onboarding/editorial/images';
import { useI18n } from '@/src/i18n';

// c2–c4 — the three value screens, one per tab the patient is about to meet:
// My Care, Moments, For You.
//
// v2 replaced the four-card swipe deck with three FULL-SCREEN pages. The deck
// asked people to read a stack of cards before it would let them continue;
// these ask for one thought at a time, and each page carries its own button, so
// the way forward is never dimmed out waiting for you to swipe far enough.
//
// Rendered one page at a time rather than as a horizontal pager, with swipe
// supplied by PanResponder. A paging ScrollView is the obvious shape, but on
// react-native-web `pagingEnabled` compiles to `scroll-snap-type: x mandatory`
// while animated `scrollTo` steps `scrollLeft` frame by frame — the snap drags
// each step back and the view creeps a few pixels instead of turning the page.
export default function Stories() {
  const { t } = useI18n();
  const T = t.onboarding.stories;

  const pages = [
    { title: T.s1Title, body: T.s1Body, img: ONBOARDING_IMAGES.card3 },
    { title: T.s2Title, body: T.s2Body, img: ONBOARDING_IMAGES.card2 },
    { title: T.s3Title, body: T.s3Body, img: ONBOARDING_IMAGES.card4 },
  ];

  const [index, setIndex] = useState(0);
  const page = pages[index];
  const last = index === pages.length - 1;

  const advance = () => (last ? router.push('/(onboarding)/privacy') : setIndex((i) => i + 1));

  // Swipe left/right between the three screens. Deliberately release-only: the
  // page does not follow the finger, it turns when you let go.
  //
  // Claiming the responder on MOVE rather than on START is what keeps the button
  // working — a tap never becomes a gesture, so the Pill still receives it. The
  // horizontal test (|dx| > |dy|) stops a vertical scroll flick from paging.
  //
  // Swiping stays INSIDE the carousel: it will not carry you on to the privacy
  // screen from the last page. Leaving onboarding is a commitment, and a stray
  // flick should not make it — that is what "Get started" is for.
  const index_ = useRef(index);
  index_.current = index;
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderRelease: (_, g) => {
        const i = index_.current;
        if (g.dx < -50 && i < pages.length - 1) setIndex(i + 1);
        else if (g.dx > 50 && i > 0) setIndex(i - 1);
      },
    }),
  ).current;

  return (
    // The web-only `userSelect` stops a swipe from dragging a text selection
    // across the headline and leaving it highlighted. Cast because it is not in
    // this React Native version's ViewStyle; same shape as the `outlineStyle`
    // escape hatch in about-you.
    <View
      style={[
        { flex: 1, backgroundColor: '#0E1512' },
        Platform.OS === 'web' ? ({ userSelect: 'none' } as never) : null,
      ]}
      {...pan.panHandlers}
    >
      <StatusBar style="light" />
      <EditorialBg key={index} source={page.img} zoom>
        <Scrim
          colors={['rgba(16,18,16,0.34)', 'rgba(16,18,16,0.12)', 'rgba(16,18,16,0.93)']}
          locations={[0, 0.38, 1]}
        />
        <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1 }}>
          <View style={{ flex: 1, justifyContent: 'flex-end', paddingHorizontal: 28, paddingBottom: 26 }}>
            {/* Keyed so the copy re-runs its entrance on every page turn. */}
            <RiseIn key={index}>
              <MonoKicker size={11} color="rgba(255,255,255,0.62)">{`0${index + 1} / 0${pages.length}`}</MonoKicker>
              <Text style={{ marginTop: 14, fontSize: 34, fontWeight: '800', color: '#fff', letterSpacing: -1.3, lineHeight: 37 }}>
                {page.title}
              </Text>
              <Text style={{ marginTop: 12, fontSize: 14.5, color: 'rgba(255,255,255,0.82)', lineHeight: 21, maxWidth: 300 }}>
                {page.body}
              </Text>
            </RiseIn>

            <View style={{ alignItems: 'flex-start', marginTop: 22, marginBottom: 18 }}>
              <Dashes total={pages.length} index={index} />
            </View>
            <Pill label={last ? T.getStarted : T.next} variant="white" onPress={advance} />
          </View>
        </SafeAreaView>
      </EditorialBg>
    </View>
  );
}

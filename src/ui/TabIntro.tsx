import { useEffect, useRef } from 'react';
import { Animated, Easing, Modal, Pressable, Text, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { Check } from 'lucide-react-native';
import { useTabIntro } from '@/src/prefs/app-prefs';
import { useI18n } from '@/src/i18n';
import { useTheme } from '@/src/ui/theme-mode';

type TabKey = 'care' | 'moments' | 'foryou';

// First-visit explainer for a tab.
//
// It was an inline card at the top of the tab's content, and it half-worked:
// people scrolled past it, or tapped the things underneath it and wondered why
// the page looked faded. It is a POPUP now — over a scrim, above the tab bar,
// with the page behind it inert — so it is the one thing to deal with, and the
// tab is whole the moment it is dismissed.
//
// Dismissal is remembered ON THE ACCOUNT, not on the phone. See `app-prefs`:
// the Keychain version came back after every reinstall, which is the reverse of
// what a "shown once" card is for.
//
// There is no `tone` any more. It existed because the card sat ON the tab and
// had to match a light or a dark page; over a scrim it matches neither, and the
// theme already knows which way round the app is.
export function TabIntro({ tabKey }: { tabKey: TabKey }) {
  const { t: TT } = useTheme();
  const { t } = useI18n();
  // Versioned so a reworded explainer can be shown again on purpose.
  const { show, dismiss } = useTabIntro(`intro.v3.${tabKey}`);
  // Two tabs both hold one of these and both can be mounted at once, so without
  // this the tab you are NOT looking at can put its card over the one you are.
  // The same rule the confirm dialog learned the hard way.
  const focused = useIsFocused();
  const visible = show && focused;

  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!visible) return;
    anim.setValue(0);
    Animated.timing(anim, { toValue: 1, duration: 260, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  }, [visible, anim]);

  if (!visible) return null;
  const copy = t.tabIntro[tabKey];

  return (
    // No `onRequestClose` that dismisses: Android's back button must not put
    // this away silently, because "put away" is a decision we remember for good.
    // It closes one way, through the button that says so.
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={() => {}}>
      <View style={{ flex: 1, backgroundColor: 'rgba(8,10,9,0.72)', justifyContent: 'center', paddingHorizontal: 22 }}>
        <Animated.View
          style={{
            opacity: anim,
            transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
          }}
        >
          <View
            style={{
              borderRadius: 22,
              padding: 20,
              backgroundColor: TT.sheet,
              borderWidth: 1,
              borderColor: TT.cardLine,
              // It is lifted off the page it covers, on both platforms.
              shadowColor: '#000',
              shadowOpacity: 0.4,
              shadowRadius: 26,
              shadowOffset: { width: 0, height: 14 },
              elevation: 12,
            }}
          >
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Check size={19} color={TT.accent} strokeWidth={2.5} style={{ marginTop: 1 }} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 17, fontWeight: '800', letterSpacing: -0.2, color: TT.ink }}>{copy.title}</Text>
                <Text style={{ marginTop: 7, fontSize: 14.5, lineHeight: 21, color: TT.inkSoft }}>{copy.body}</Text>
              </View>
            </View>
            <Pressable
              onPress={dismiss}
              accessibilityRole="button"
              style={{ marginTop: 18, height: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 25, backgroundColor: TT.ctaBg }}
            >
              <Text style={{ fontSize: 15, fontWeight: '700', color: TT.ctaFg }}>{t.tabIntro.gotIt}</Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

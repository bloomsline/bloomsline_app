import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { storageGet, storageSet } from '@/src/storage';
import { useI18n } from '@/src/i18n';
import { useTheme } from '@/src/ui/theme-mode';

type TabKey = 'care' | 'moments' | 'foryou';

// First-visit explainer for a tab. An INLINE card at the top of the tab content
// (not a popup) that gently fades in, shown once per tab and remembered via
// storage. Dismissed with "Got it".
//
// `tone` follows the tab it sits on: a mint card reads as a highlight on the
// light tabs and as a hole punched in the page on the dark ones.
export function TabIntro({ tabKey, tone = 'light', onActiveChange }: { tabKey: TabKey; tone?: 'light' | 'dark'; onActiveChange?: (active: boolean) => void }) {
  const { t: TT } = useTheme();
  const { t } = useI18n();
  const [show, setShow] = useState(false);
  const anim = useRef(new Animated.Value(0)).current;
  // Versioned so a prior dismissal doesn't hide an updated intro during review.
  const key = `intro.v3.${tabKey}`;

  useEffect(() => {
    let alive = true;
    storageGet(key).then((v) => {
      if (alive && !v) {
        setShow(true);
        onActiveChange?.(true);
      }
    });
    return () => {
      alive = false;
    };
  }, [key, onActiveChange]);

  useEffect(() => {
    if (show) Animated.timing(anim, { toValue: 1, duration: 320, useNativeDriver: true }).start();
  }, [show, anim]);

  const dismiss = () => {
    void storageSet(key, '1');
    onActiveChange?.(false);
    Animated.timing(anim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setShow(false));
  };

  if (!show) return null;
  const copy = t.tabIntro[tabKey];
  const dark = tone === 'dark';

  return (
    <Animated.View
      style={{
        opacity: anim,
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-6, 0] }) }],
        marginBottom: 16,
      }}
    >
      {dark ? (
        <View style={{ borderRadius: 18, padding: 16, backgroundColor: TT.card, borderWidth: 1, borderColor: TT.cardLine }}>
          <View className="flex-row gap-2.5">
            <Check size={18} color={TT.accent} strokeWidth={2.5} style={{ marginTop: 1 }} />
            <View className="flex-1">
              <Text style={{ fontSize: 15, fontWeight: '700', color: TT.ink }}>{copy.title}</Text>
              <Text style={{ marginTop: 4, fontSize: 13, lineHeight: 19, color: TT.inkSoft }}>{copy.body}</Text>
            </View>
          </View>
          <Pressable onPress={dismiss} style={{ marginTop: 14, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: TT.ctaBg }}>
            <Text style={{ fontSize: 14.5, fontWeight: '700', color: TT.ctaFg }}>{t.tabIntro.gotIt}</Text>
          </Pressable>
        </View>
      ) : (
        <View className="rounded-2xl bg-brand-tint p-4">
          <View className="flex-row gap-2.5">
            <Check size={18} color="#2F6E5F" strokeWidth={2.5} style={{ marginTop: 1 }} />
            <View className="flex-1">
              <Text className="text-[15px] font-bold text-ink">{copy.title}</Text>
              <Text className="mt-1 text-[13px] leading-[19px] text-[#57736A]">{copy.body}</Text>
            </View>
          </View>
          <Pressable onPress={dismiss} className="mt-3.5 h-[46px] items-center justify-center rounded-full bg-brand">
            <Text className="text-[15px] font-semibold text-white">{t.tabIntro.gotIt}</Text>
          </Pressable>
        </View>
      )}
    </Animated.View>
  );
}

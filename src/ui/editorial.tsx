// App-side editorial toolkit (the "hybrid" theme): a dark photographic header
// per screen, then light editorial content below. Manrope + IBM Plex Mono, the
// #128069 green as the single accent, black pill CTAs, hairline dividers.
import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Easing, Pressable, Text, View, type ImageSourcePropType, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, type LucideIcon } from 'lucide-react-native';
import { MONO } from '@/src/ui/fonts';

export const EDA = {
  canvas: '#F6F5F2', // near-white page
  card: '#FFFFFF', // white cards
  ink: '#141414',
  inkSoft: '#5A5A52', // secondary text
  faint: '#9A9A90', // tertiary / captions
  green: '#128069',
  greenDeep: '#0C5B4B',
  greenTint: '#E7F0EC',
  line: '#EAE8E2', // hairline divider
  slot: '#101210', // dark accent
};

/**
 * The dark ground v2 uses for the tabs a patient lives in — My Care and Moments
 * are both drawn dark on the design board. It lives beside EDA rather than
 * inside one screen so the two cannot drift apart.
 *
 * Surfaces are translucent white rather than opaque greys, so they sit correctly
 * on whatever is behind them — which matters because Moments puts photography
 * back there.
 */
export const EDD = {
  ground: '#0E1512',
  card: 'rgba(255,255,255,0.055)',
  cardLine: 'rgba(255,255,255,0.10)',
  text: '#FFFFFF',
  textSoft: 'rgba(255,255,255,0.68)',
  faint: 'rgba(255,255,255,0.40)',
  green: '#7FD9C0', // the accent the dark onboarding screens already use
  amber: '#E9C46A', // "awaiting payment" only — never decorative
};

const RISE = Easing.bezier(0.16, 0.84, 0.24, 1);

/** Opacity + gentle upward glide on mount — the app's default entrance, and the
 *  soft "arrival" when landing in the app from onboarding. */
export function FadeIn({ delay = 0, y = 12, duration = 600, style, children }: { delay?: number; y?: number; duration?: number; style?: ViewStyle; children: ReactNode }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(a, { toValue: 1, duration, delay, easing: RISE, useNativeDriver: true }).start();
  }, [a, delay, duration]);
  return <Animated.View style={[style, { opacity: a, transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [y, 0] }) }] }]}>{children}</Animated.View>;
}

/** Monospaced editorial label / kicker. */
export function MonoLabel({ children, color = EDA.green, size = 10.5, style }: { children: ReactNode; color?: string; size?: number; style?: ViewStyle }) {
  return <Text style={[{ fontFamily: MONO, fontSize: size, letterSpacing: 2, textTransform: 'uppercase', color }, style]}>{children}</Text>;
}

/** Clean light screen header — a mono kicker + oversized title on the canvas,
 *  no imagery. (Keeps `source`/`height` in the signature so callers still
 *  compile; they're intentionally ignored — the app is solid-colour, not
 *  photographic.) */
export function EdHeader({
  kicker,
  title,
  subtitle,
  onBack,
  rightIcon,
  onRight,
}: {
  kicker: string;
  title: string;
  subtitle?: string;
  source?: ImageSourcePropType;
  height?: number;
  onBack?: () => void;
  rightIcon?: LucideIcon;
  onRight?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const RightIcon = rightIcon;
  const circle = { width: 38, height: 38, borderRadius: 19, backgroundColor: EDA.card, borderWidth: 1, borderColor: EDA.line, alignItems: 'center' as const, justifyContent: 'center' as const };
  const rightBtn =
    RightIcon && onRight ? (
      <Pressable onPress={onRight} style={circle}>
        <RightIcon size={18} color={EDA.ink} strokeWidth={2} />
      </Pressable>
    ) : null;
  // A back chevron keeps its own top row (standard nav). Otherwise the right
  // action sits in-line with the title block, top-aligned to the kicker — so the
  // kicker reads level with the icon instead of below it.
  return (
    <View style={{ paddingTop: insets.top, backgroundColor: EDA.canvas }}>
      <View style={{ paddingHorizontal: 22, paddingTop: 12, paddingBottom: 4 }}>
        {onBack ? (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <Pressable onPress={onBack} style={circle}>
              <ChevronLeft size={18} color={EDA.ink} strokeWidth={2} />
            </Pressable>
            {rightBtn}
          </View>
        ) : null}
        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <MonoLabel color={EDA.green} style={{ marginBottom: 8 }}>{kicker}</MonoLabel>
            <Text style={{ fontSize: 30, fontWeight: '800', color: EDA.ink, letterSpacing: -0.9, lineHeight: 34 }}>{title}</Text>
            {subtitle ? <Text style={{ fontSize: 14.5, color: EDA.inkSoft, lineHeight: 21, marginTop: 8, maxWidth: 320 }}>{subtitle}</Text> : null}
          </View>
          {!onBack && rightBtn ? <View style={{ marginLeft: 12 }}>{rightBtn}</View> : null}
        </View>
      </View>
    </View>
  );
}

/** A light editorial card. */
export function EdCard({ children, style, onPress }: { children: ReactNode; style?: ViewStyle; onPress?: () => void }) {
  const inner = <View style={[{ backgroundColor: EDA.card, borderRadius: 20, borderWidth: 1, borderColor: EDA.line, padding: 18 }, style]}>{children}</View>;
  return onPress ? <Pressable onPress={onPress}>{inner}</Pressable> : inner;
}

/** Section label + optional action, editorial style. */
export function EdSection({ label, action, onAction }: { label: string; action?: string; onAction?: () => void }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
      <MonoLabel color={EDA.faint}>{label}</MonoLabel>
      {action && onAction ? (
        <Pressable onPress={onAction}>
          <Text style={{ fontSize: 12.5, fontWeight: '700', color: EDA.green }}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Pill button. dark = ink CTA, green = accent, outline = secondary on light. */
export function EdPill({ label, onPress, variant = 'dark', disabled = false, style }: { label: string; onPress?: () => void; variant?: 'dark' | 'green' | 'outline'; disabled?: boolean; style?: ViewStyle }) {
  const bg = variant === 'dark' ? EDA.ink : variant === 'green' ? EDA.green : 'transparent';
  const fg = variant === 'outline' ? EDA.ink : '#fff';
  const border = variant === 'outline' ? { borderWidth: 1.5, borderColor: EDA.line } : undefined;
  return (
    <Pressable onPress={disabled ? undefined : onPress} style={[{ height: 54, borderRadius: 27, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.45 : 1 }, border, style]}>
      <Text style={{ fontSize: 15.5, fontWeight: '700', color: fg }}>{label}</Text>
    </Pressable>
  );
}

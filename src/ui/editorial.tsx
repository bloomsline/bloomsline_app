// App-side editorial toolkit (the "hybrid" theme): a dark photographic header
// per screen, then light editorial content below. Manrope + IBM Plex Mono, the
// #128069 green as the single accent, black pill CTAs, hairline dividers.
import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Easing, Pressable, Text, View, type ImageSourcePropType, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, type LucideIcon } from 'lucide-react-native';
import { useTheme } from './theme-mode';

// EDA and EDD now live in `tokens.ts`, where each key carries BOTH a light and
// a dark value, and are re-exported here so the ~35 screens importing them from
// this module keep working. Two hardcoded palettes could not support a switcher:
// nothing could ask "what is the page colour" without knowing its own theme.
//
// New code should use `useTheme()` from `theme-mode` instead of either name.
export { EDD } from './tokens';

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

/**
 * How far a screen's header sits below the safe-area edge.
 *
 * Shared so the top of every screen agrees, and so this is one number to
 * change. Screens used to pick their own — 6, 8, 12, 14 — which put the first
 * line of type almost on the status bar and made each screen's top edge sit at
 * a slightly different height as you moved between tabs.
 */
export const HEADER_TOP = 36;

/**
 * The small label above a title — a section name, a state, a category.
 *
 * Was `Kicker`: IBM Plex Mono, uppercase, 2px tracking. That reads as a
 * system stamp rather than as writing, which is the wrong voice for an app
 * whose whole job is a person putting words to how they feel. Sentence case in
 * the app's own sans says the same thing in the app's own voice.
 *
 * `size` is bumped inside the component rather than at the ~37 call sites,
 * because the values they pass (9.5–11) were chosen for tracked uppercase mono,
 * which occupies far more width and reads larger than sentence-case sans at the
 * same pixel size.
 */
export function Kicker({ children, color, size = 11, style }: { children: ReactNode; color?: string; size?: number; style?: ViewStyle }) {
  const { t: TT } = useTheme();
  // Resolved in the body, not as a default parameter: defaults evaluate before
  // the hook runs, so `color = TT.accent` is a reference to a value that does
  // not exist yet.
  const tone = color ?? TT.accent;
  return <Text style={[{ fontSize: size + 2, fontWeight: '700', letterSpacing: 0.2, color: tone }, style]}>{children}</Text>;
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
  /** The eyebrow above the title. Omitted where it would only repeat the
   *  title — a page whose kicker and title are the same word says it twice. */
  kicker?: string;
  title: string;
  subtitle?: string;
  source?: ImageSourcePropType;
  height?: number;
  onBack?: () => void;
  rightIcon?: LucideIcon;
  onRight?: () => void;
}) {
  const { t: TT } = useTheme();
  const insets = useSafeAreaInsets();
  const RightIcon = rightIcon;
  const circle = { width: 38, height: 38, borderRadius: 19, backgroundColor: TT.card, borderWidth: 1, borderColor: TT.line, alignItems: 'center' as const, justifyContent: 'center' as const };
  const rightBtn =
    RightIcon && onRight ? (
      <Pressable onPress={onRight} style={circle}>
        <RightIcon size={18} color={TT.ink} strokeWidth={2} />
      </Pressable>
    ) : null;
  // A back chevron keeps its own top row (standard nav). Otherwise the right
  // action sits in-line with the title block, top-aligned to the kicker — so the
  // kicker reads level with the icon instead of below it.
  return (
    <View style={{ paddingTop: insets.top, backgroundColor: TT.bg }}>
      <View style={{ paddingHorizontal: 22, paddingTop: HEADER_TOP, paddingBottom: 4 }}>
        {onBack ? (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <Pressable onPress={onBack} style={circle}>
              <ChevronLeft size={18} color={TT.ink} strokeWidth={2} />
            </Pressable>
            {rightBtn}
          </View>
        ) : null}
        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            {kicker ? <Kicker color={TT.accent} style={{ marginBottom: 8 }}>{kicker}</Kicker> : null}
            <Text style={{ fontSize: 30, fontWeight: '800', color: TT.ink, letterSpacing: -0.9, lineHeight: 34 }}>{title}</Text>
            {subtitle ? <Text style={{ fontSize: 14.5, color: TT.inkSoft, lineHeight: 21, marginTop: 8, maxWidth: 320 }}>{subtitle}</Text> : null}
          </View>
          {!onBack && rightBtn ? <View style={{ marginLeft: 12 }}>{rightBtn}</View> : null}
        </View>
      </View>
    </View>
  );
}

/** A light editorial card. */
export function EdCard({ children, style, onPress }: { children: ReactNode; style?: ViewStyle; onPress?: () => void }) {
  const { t: TT } = useTheme();
  const inner = <View style={[{ backgroundColor: TT.card, borderRadius: 20, borderWidth: 1, borderColor: TT.line, padding: 18 }, style]}>{children}</View>;
  return onPress ? <Pressable onPress={onPress}>{inner}</Pressable> : inner;
}

/** Section label + optional action, editorial style. */
export function EdSection({ label, action, onAction }: { label: string; action?: string; onAction?: () => void }) {
  const { t: TT } = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
      <Kicker color={TT.faint}>{label}</Kicker>
      {action && onAction ? (
        <Pressable onPress={onAction}>
          <Text style={{ fontSize: 12.5, fontWeight: '700', color: TT.accent }}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Pill button. dark = ink CTA, green = accent, outline = secondary on light. */
export function EdPill({ label, onPress, variant = 'dark', disabled = false, style }: { label: string; onPress?: () => void; variant?: 'dark' | 'green' | 'outline'; disabled?: boolean; style?: ViewStyle }) {
  const { t: TT } = useTheme();
  const bg = variant === 'dark' ? TT.ink : variant === 'green' ? TT.accent : 'transparent';
  const fg = variant === 'outline' ? TT.ink : '#fff';
  const border = variant === 'outline' ? { borderWidth: 1.5, borderColor: TT.line } : undefined;
  return (
    <Pressable onPress={disabled ? undefined : onPress} style={[{ height: 54, borderRadius: 27, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.45 : 1 }, border, style]}>
      <Text style={{ fontSize: 15.5, fontWeight: '700', color: fg }}>{label}</Text>
    </Pressable>
  );
}

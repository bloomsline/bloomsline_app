// Editorial onboarding kit — the shared primitives for the photography-led flow.
// Motion is RN Animated tuned to the design's easing (long, soft, no bounce).
import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Easing, ImageBackground, Pressable, Text, View, type ImageSourcePropType, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export const ED = {
  ink: '#141414',
  green: '#128069',
  greenDeep: '#0C5B4B',
  sheet: '#FBFAF6',
};

// The soft "rise" easing from the design: cubic-bezier(.16,.84,.24,1).
export const RISE_EASE = Easing.bezier(0.16, 0.84, 0.24, 1);
// The slow image "breathe" easing: cubic-bezier(.22,.61,.36,1).
export const ZOOM_EASE = Easing.bezier(0.22, 0.61, 0.36, 1);

// Brand gradient shown in any image slot that has no photo yet (deep green → ink).
const SLOT_COLORS = ['#1F5E4F', '#163B33', '#0E1512'] as const;

/** Full-bleed background: photo if provided, else a soft brand gradient. `zoom`
 *  adds the slow 7s "breathe" scale from the design. */
export function EditorialBg({
  source,
  zoom = false,
  children,
  style,
}: {
  source?: ImageSourcePropType;
  zoom?: boolean;
  children?: ReactNode;
  style?: ViewStyle;
}) {
  const scale = useRef(new Animated.Value(zoom ? 1.06 : 1)).current;
  useEffect(() => {
    if (zoom) {
      Animated.timing(scale, { toValue: 1, duration: 7000, easing: ZOOM_EASE, useNativeDriver: true }).start();
    }
  }, [zoom, scale]);

  return (
    <View style={[{ flex: 1, backgroundColor: '#0E1512' }, style]}>
      <Animated.View style={{ position: 'absolute', inset: 0, transform: [{ scale }] }}>
        {source ? (
          <ImageBackground source={source} resizeMode="cover" style={{ flex: 1 }} />
        ) : (
          <LinearGradient colors={[...SLOT_COLORS]} locations={[0, 0.55, 1]} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={{ flex: 1 }} />
        )}
      </Animated.View>
      {children}
    </View>
  );
}

/** A top-to-bottom scrim over the imagery so white type always reads. */
export function Scrim({ colors, locations }: { colors: string[]; locations?: number[] }) {
  return <LinearGradient colors={colors as [string, string, ...string[]]} locations={locations as [number, number, ...number[]] | undefined} style={{ position: 'absolute', inset: 0 }} pointerEvents="none" />;
}

/** Opacity + upward glide, on the design's soft easing. */
export function RiseIn({ delay = 0, y = 18, duration = 1100, children, style }: { delay?: number; y?: number; duration?: number; children: ReactNode; style?: ViewStyle }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(a, { toValue: 1, duration, delay, easing: RISE_EASE, useNativeDriver: true }).start();
  }, [a, delay, duration]);
  return (
    <Animated.View style={[style, { opacity: a, transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [y, 0] }) }] }]}>
      {children}
    </Animated.View>
  );
}

/**
 * The brand, set apart from the kicker on purpose.
 *
 * It used to render through `MonoKicker`, so the sentence-case sweep on
 * 2026-08-23 turned the first thing a new patient sees into "bloomsline" — a
 * word rather than a mark. A wordmark is not a label: labels became sentence
 * case because they were shouting, and this one is supposed to.
 */
export function Wordmark({ children, color = 'rgba(255,255,255,0.66)', size = 11.5, style }: { children: ReactNode; color?: string; size?: number; style?: ViewStyle }) {
  return <Text style={[{ fontSize: size, fontWeight: '800', letterSpacing: 2.6, textTransform: 'uppercase', color }, style]}>{children}</Text>;
}

/** The onboarding flow's kicker. Same move as `Kicker` in `src/ui/editorial`:
 *  out of uppercase mono and into the app's own sans, so the first screens a
 *  patient sees are written rather than stamped. */
export function MonoKicker({ children, color = 'rgba(255,255,255,0.72)', size = 10.5, style }: { children: ReactNode; color?: string; size?: number; style?: ViewStyle }) {
  return <Text style={[{ fontSize: size + 2, fontWeight: '700', letterSpacing: 0.2, color }, style]}>{children}</Text>;
}

/** Fully-rounded pill button. white = primary, outline = secondary on dark,
 *  dark = ink pill on light sheets. */
export function Pill({
  label,
  onPress,
  variant = 'white',
  disabled = false,
  style,
}: {
  label: string;
  onPress?: () => void;
  variant?: 'white' | 'outline' | 'dark';
  disabled?: boolean;
  style?: ViewStyle;
}) {
  const bg = variant === 'white' ? '#fff' : variant === 'dark' ? ED.ink : 'transparent';
  const fg = variant === 'white' ? ED.ink : '#fff';
  const border = variant === 'outline' ? { borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.55)' } : undefined;
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={[{ height: 56, borderRadius: 28, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.5 : 1 }, border, style]}
    >
      <Text style={{ fontSize: 16, fontWeight: '700', color: fg }}>{label}</Text>
    </Pressable>
  );
}

/** A compact EN/FR segmented toggle for the dark photographic screens. Glassy
 *  track, the active segment fills white. Wire `value`/`onChange` to the i18n
 *  locale so it switches the whole app immediately. */
export function LangToggle({ value, onChange, options }: { value: string; onChange: (v: string) => void; options?: Array<{ code: string; label: string }> }) {
  const opts = options ?? [{ code: 'en', label: 'EN' }, { code: 'fr', label: 'FR' }];
  return (
    <View style={{ flexDirection: 'row', padding: 3, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)' }}>
      {opts.map((o) => {
        const on = value === o.code;
        return (
          <Pressable key={o.code} onPress={() => onChange(o.code)} style={{ paddingHorizontal: 13, height: 30, borderRadius: 15, backgroundColor: on ? '#fff' : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 12.5, fontWeight: '700', letterSpacing: 0.3, color: on ? ED.ink : 'rgba(255,255,255,0.75)' }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** The glowing, gently-nudging "next" affordance from the carousel cards. */
export function HaloArrow({ size = 46 }: { size?: number }) {
  const halo = useRef(new Animated.Value(0)).current;
  const nudge = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(Animated.timing(halo, { toValue: 1, duration: 2600, easing: Easing.out(Easing.ease), useNativeDriver: true })).start();
    Animated.loop(Animated.sequence([
      Animated.timing(nudge, { toValue: 1, duration: 1300, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(nudge, { toValue: 0, duration: 1300, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ])).start();
  }, [halo, nudge]);
  return (
    <View style={{ width: size, height: size }}>
      <Animated.View
        style={{
          position: 'absolute', inset: 0, borderRadius: size / 2, backgroundColor: 'rgba(255,255,255,0.5)',
          opacity: halo.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] }),
          transform: [{ scale: halo.interpolate({ inputRange: [0, 1], outputRange: [1, 1.45] }) }],
        }}
      />
      <View style={{ position: 'absolute', inset: 0, borderRadius: size / 2, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', shadowColor: '#fff', shadowOpacity: 0.45, shadowRadius: 22, shadowOffset: { width: 0, height: 6 } }}>
        <Animated.Text style={{ fontSize: 19, fontWeight: '700', color: ED.ink, transform: [{ translateX: nudge.interpolate({ inputRange: [0, 1], outputRange: [0, 3] }) }] }}>→</Animated.Text>
      </View>
    </View>
  );
}

/** The slim dash progress from the carousel (n of total filled). */
export function Dashes({ total, index }: { total: number; index: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'center' }}>
      {Array.from({ length: total }).map((_, i) => (
        <View key={i} style={{ width: i === index ? 22 : 8, height: 4, borderRadius: 2, backgroundColor: i <= index ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.3)' }} />
      ))}
    </View>
  );
}

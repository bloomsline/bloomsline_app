import { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import { Ban, Hand, Lock, ShieldCheck, type LucideIcon } from 'lucide-react-native';

// Small animated line icons for the privacy promises. Each fades + scales in
// (staggered down the list), then settles into a gentle signature motion — a
// breathing lock/shield, a waving hand — so the row feels alive without being
// noisy. Pure RN Animated (Expo Go / web safe).
export type PromiseIcon = 'lock' | 'ban' | 'shield' | 'wave';

const MAP: Record<PromiseIcon, LucideIcon> = { lock: Lock, ban: Ban, shield: ShieldCheck, wave: Hand };

export function AnimatedPromiseIcon({ type, delay = 0, color = '#fff', size = 19 }: { type: PromiseIcon; delay?: number; color?: string; size?: number }) {
  const Icon = MAP[type];
  const enter = useRef(new Animated.Value(0)).current;
  const idle = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: 520, delay, easing: Easing.bezier(0.16, 0.84, 0.24, 1), useNativeDriver: true }).start(({ finished }) => {
      if (!finished) return;
      const dur = type === 'wave' ? 1800 : 3200;
      Animated.loop(Animated.timing(idle, { toValue: 1, duration: dur, easing: Easing.inOut(Easing.ease), useNativeDriver: true })).start();
    });
    return () => {
      enter.stopAnimation();
      idle.stopAnimation();
    };
  }, [enter, idle, delay, type]);

  const enterScale = enter.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] });
  const breathe = idle.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.08, 1] });
  const wave = idle.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: ['0deg', '14deg', '0deg', '-12deg', '0deg'] });

  const transform: Animated.WithAnimatedArray<{ scale?: unknown; rotate?: unknown }> = [{ scale: enterScale }];
  if (type === 'wave') transform.push({ rotate: wave });
  else if (type === 'lock' || type === 'shield') transform.push({ scale: breathe });

  return (
    <Animated.View style={{ opacity: enter, transform: transform as never }}>
      <Icon size={size} color={color} strokeWidth={2} />
    </Animated.View>
  );
}

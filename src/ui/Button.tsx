import { ActivityIndicator, Pressable, Text, View } from 'react-native';

// v1 pill CTA: full-round (radius 28), height 56. `dark` (black) is the auth-
// entry / social CTA; `primary` (teal) is the step-confirm; disabled goes solid
// grey with muted text (v1 behavior), not just faded.
type Variant = 'primary' | 'dark' | 'secondary' | 'ghost' | 'white';

const BG: Record<Variant, string> = {
  primary: 'bg-brand',
  dark: 'bg-ink',
  secondary: 'bg-line-soft',
  ghost: 'bg-transparent',
  white: 'bg-white',
};
const FG: Record<Variant, string> = {
  primary: 'text-white',
  dark: 'text-white',
  secondary: 'text-[#333]',
  ghost: 'text-ink',
  white: 'text-brand-deep',
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  leading,
  className = '',
}: {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  leading?: React.ReactNode;
  className?: string;
}) {
  const off = disabled || loading;
  // v1 disabled: solid #E5E5E5 with #999 text (for the filled CTAs).
  const solidDisabled = off && (variant === 'primary' || variant === 'dark');
  const bg = solidDisabled ? 'bg-[#E5E5E5]' : BG[variant];
  const fg = solidDisabled ? 'text-muted' : FG[variant];
  const spinner = variant === 'primary' || variant === 'dark' ? '#fff' : '#4A9A86';

  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      className={`h-14 flex-row items-center justify-center gap-2.5 rounded-[28px] px-5 ${bg} ${off && !solidDisabled ? 'opacity-50' : ''} ${className}`}
      style={({ pressed }) => (pressed && !off ? { opacity: 0.9 } : undefined)}
    >
      {loading ? (
        <ActivityIndicator color={spinner} />
      ) : (
        <>
          {leading ? <View>{leading}</View> : null}
          <Text className={`text-[17px] font-semibold ${fg}`}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

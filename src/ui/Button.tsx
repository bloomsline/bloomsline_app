import { ActivityIndicator, Pressable, Text, View } from 'react-native';

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
  secondary: 'text-muted-dark',
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
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      className={`h-14 flex-row items-center justify-center gap-2.5 rounded-[28px] px-5 ${BG[variant]} ${off ? 'opacity-50' : ''} ${className}`}
      style={({ pressed }) => (pressed && !off ? { opacity: 0.9 } : undefined)}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' || variant === 'dark' ? '#fff' : '#009B8E'} />
      ) : (
        <>
          {leading ? <View>{leading}</View> : null}
          <Text className={`text-[17px] font-semibold ${FG[variant]}`}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

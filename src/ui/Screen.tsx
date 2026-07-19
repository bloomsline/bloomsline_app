import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { LucideIcon } from 'lucide-react-native';

// A screen container. `bg` is a Tailwind bg-* class. When `scroll`, content
// scrolls; otherwise it's a flex column. `edges` lets full-bleed heroes skip the
// top safe-area inset.
export function Screen({
  children,
  bg = 'bg-white',
  scroll = false,
  edges = ['top', 'bottom'],
  className = '',
}: {
  children: React.ReactNode;
  bg?: string;
  scroll?: boolean;
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
  className?: string;
}) {
  return (
    <SafeAreaView edges={edges} className={`flex-1 ${bg}`}>
      {scroll ? (
        <ScrollView contentContainerClassName={`flex-grow ${className}`} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {children}
        </ScrollView>
      ) : (
        <View className={`flex-1 ${className}`}>{children}</View>
      )}
    </SafeAreaView>
  );
}

// Circular header icon button. `tone="teal"` is v1's auth back button (44px
// teal circle, white icon); `neutral` is the grey 36px chip (close, etc.).
export function IconButton({ icon: Icon, onPress, tone = 'neutral' }: { icon: LucideIcon; onPress?: () => void; tone?: 'teal' | 'neutral' }) {
  const teal = tone === 'teal';
  return (
    <Pressable onPress={onPress} className={`items-center justify-center rounded-full ${teal ? 'h-11 w-11 bg-brand' : 'h-9 w-9 bg-line-soft'}`}>
      <Icon size={teal ? 22 : 20} color={teal ? '#fff' : '#333'} strokeWidth={2} />
    </Pressable>
  );
}

import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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

// Circular icon button (back ‹ / close ✕) used in headers.
export function IconButton({ glyph, onPress, className = 'bg-line-soft' }: { glyph: string; onPress?: () => void; className?: string }) {
  return (
    <Pressable onPress={onPress} className={`h-10 w-10 items-center justify-center rounded-full ${className}`}>
      <Text className="text-[18px] leading-[20px] text-[#333]">{glyph}</Text>
    </Pressable>
  );
}

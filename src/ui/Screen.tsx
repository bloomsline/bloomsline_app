import { ScrollView, View } from 'react-native';
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


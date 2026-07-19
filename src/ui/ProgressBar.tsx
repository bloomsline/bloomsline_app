import { View } from 'react-native';

// Row of equal segments; `filled` of `steps` are teal, the rest gray.
export function ProgressBar({ steps, filled }: { steps: number; filled: number }) {
  return (
    <View className="flex-1 flex-row gap-1.5">
      {Array.from({ length: steps }).map((_, i) => (
        <View key={i} className={`h-1.5 flex-1 rounded-[3px] ${i < filled ? 'bg-brand' : 'bg-[#E5E5E5]'}`} />
      ))}
    </View>
  );
}

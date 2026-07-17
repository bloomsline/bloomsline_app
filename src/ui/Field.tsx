import { useState } from 'react';
import { Text, TextInput, View, type TextInputProps } from 'react-native';

// Labeled text input. Uppercase label + optional required asterisk; border turns
// teal on focus. `radius` = 'lg' (16, form fields) or 'pill' (28, email row).
export function Field({
  label,
  required,
  optionalNote,
  radius = 'lg',
  className = '',
  ...input
}: {
  label?: string;
  required?: boolean;
  optionalNote?: string;
  radius?: 'lg' | 'pill';
  className?: string;
} & TextInputProps) {
  const [focused, setFocused] = useState(false);
  const r = radius === 'pill' ? 'rounded-[28px] h-14' : 'rounded-2xl h-[58px]';
  return (
    <View className={className}>
      {label ? (
        <Text className="mb-2 text-[12.5px] font-semibold uppercase tracking-[0.5px] text-muted">
          {label}
          {required ? <Text className="text-brand"> *</Text> : null}
          {optionalNote ? <Text className="font-normal normal-case tracking-normal text-[#C4C4C4]"> {optionalNote}</Text> : null}
        </Text>
      ) : null}
      <TextInput
        {...input}
        onFocus={(e) => { setFocused(true); input.onFocus?.(e); }}
        onBlur={(e) => { setFocused(false); input.onBlur?.(e); }}
        placeholderTextColor="#BBBBBB"
        selectionColor="#009B8E"
        className={`${r} border px-4 text-[16px] text-ink ${focused ? 'border-[1.5px] border-brand' : 'border-[#E5E5E5]'}`}
      />
    </View>
  );
}

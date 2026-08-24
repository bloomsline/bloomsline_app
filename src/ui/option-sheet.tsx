// A single-choice sheet: the options for one setting, the current one ticked.
//
// Settings used to show every choice at once as a grid of tiles — three rows of
// them, each with a heading and a sentence of explanation, so the page was
// mostly the explaining of choices nobody was in the middle of making. A row
// that states its current value and opens this on tap says the same thing in
// one line and keeps the page readable at a glance.
import { Modal, Pressable, Text, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { useTheme } from '@/src/ui/theme-mode';

export interface Option<T extends string> {
  value: T;
  label: string;
  /** One short line, only where the label alone would leave someone guessing. */
  hint?: string;
}

export function OptionSheet<T extends string>({
  visible,
  title,
  options,
  selected,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  options: Option<T>[];
  selected: T;
  onSelect: (value: T) => void;
  onClose: () => void;
}) {
  const { t: TT } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(20,20,20,0.4)' }} onPress={onClose}>
        <Pressable style={{ borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: TT.sheet, paddingBottom: 34 }} onPress={() => {}}>
          <View style={{ alignItems: 'center', paddingTop: 12 }}>
            <View style={{ height: 4, width: 40, borderRadius: 2, backgroundColor: TT.line }} />
          </View>

          <Text style={{ fontSize: 17, fontWeight: '800', color: TT.ink, letterSpacing: -0.2, paddingHorizontal: 24, paddingTop: 18, paddingBottom: 6 }}>
            {title}
          </Text>

          {options.map((o, i) => {
            const on = o.value === selected;
            return (
              <Pressable
                key={o.value}
                onPress={() => { onSelect(o.value); onClose(); }}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 12,
                  paddingHorizontal: 24, paddingVertical: 15,
                  borderTopWidth: i === 0 ? 0 : 1, borderTopColor: TT.line,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: on ? '700' : '500', color: TT.ink }}>{o.label}</Text>
                  {o.hint ? <Text style={{ fontSize: 13, color: TT.faint, marginTop: 2 }}>{o.hint}</Text> : null}
                </View>
                {/* The tick marks the current choice, and nothing marks the
                    others — an empty circle beside every option reads as a form
                    to fill in rather than a setting that already has a value. */}
                {on ? <Check size={19} color={TT.accent} strokeWidth={2.6} /> : null}
              </Pressable>
            );
          })}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

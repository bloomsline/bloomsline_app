import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { ChevronDown } from 'lucide-react-native';

// A dependency-free date-of-birth picker: a bordered field that opens a modal
// with three tap-to-select columns (day / month / year). Works on web and in
// Expo Go (no native datetime module). Value + onChange are 'YYYY-MM-DD'.
type Props = {
  value: string | null;
  onChange: (iso: string) => void;
  months: string[]; // 12 localized month names
  placeholder: string;
  doneLabel: string;
  titleLabel: string;
};

const pad = (n: number) => String(n).padStart(2, '0');
const daysInMonth = (year: number, monthIndex: number) => new Date(year, monthIndex + 1, 0).getDate();

function parse(iso: string | null): { y: number; m: number; d: number } | null {
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return null;
  return { y, m: m - 1, d };
}

export function DateOfBirthField({ value, onChange, months, placeholder, doneLabel, titleLabel }: Props) {
  const [open, setOpen] = useState(false);
  const now = new Date();
  const maxYear = now.getFullYear() - 13; // patients are 13+
  const years = useMemo(() => Array.from({ length: maxYear - 1920 + 1 }, (_, i) => maxYear - i), [maxYear]);

  const parsed = parse(value);
  // Draft selection while the modal is open; seeded from the value or a sensible middle.
  const [draftY, setDraftY] = useState(parsed?.y ?? 1995);
  const [draftM, setDraftM] = useState(parsed?.m ?? 0);
  const [draftD, setDraftD] = useState(parsed?.d ?? 1);

  const openPicker = () => {
    const p = parse(value);
    setDraftY(p?.y ?? 1995);
    setDraftM(p?.m ?? 0);
    setDraftD(p?.d ?? 1);
    setOpen(true);
  };

  const apply = () => {
    const d = Math.min(draftD, daysInMonth(draftY, draftM));
    onChange(`${draftY}-${pad(draftM + 1)}-${pad(d)}`);
    setOpen(false);
  };

  const label = parsed ? `${parsed.d} ${months[parsed.m]} ${parsed.y}` : placeholder;
  const days = Array.from({ length: daysInMonth(draftY, draftM) }, (_, i) => i + 1);

  return (
    <>
      <Pressable
        onPress={openPicker}
        className="h-[58px] flex-row items-center justify-between rounded-2xl border border-[#E5E5E5] px-4"
      >
        <Text className={`text-[16px] ${parsed ? 'text-ink' : 'text-[#BBBBBB]'}`}>{label}</Text>
        <ChevronDown size={18} color="#BBBBBB" strokeWidth={2} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable className="flex-1 justify-end bg-black/40" onPress={() => setOpen(false)}>
          <Pressable className="rounded-t-3xl bg-white px-5 pb-8 pt-5" onPress={() => {}}>
            <Text className="mb-4 text-center text-[16px] font-bold text-ink">{titleLabel}</Text>
            <View className="h-[200px] flex-row">
              <Column items={days.map(String)} selected={String(draftD)} onSelect={(v) => setDraftD(Number(v))} />
              <Column items={months} selected={months[draftM]} onSelect={(v) => setDraftM(months.indexOf(v))} flex={2} />
              <Column items={years.map(String)} selected={String(draftY)} onSelect={(v) => setDraftY(Number(v))} />
            </View>
            <Pressable onPress={apply} className="mt-5 h-[52px] items-center justify-center rounded-full bg-brand">
              <Text className="text-[16px] font-semibold text-white">{doneLabel}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function Column({ items, selected, onSelect, flex = 1 }: { items: string[]; selected: string; onSelect: (v: string) => void; flex?: number }) {
  return (
    <ScrollView style={{ flex }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 8 }}>
      {items.map((it) => {
        const on = it === selected;
        return (
          <Pressable key={it} onPress={() => onSelect(it)} className={`items-center rounded-xl py-2.5 ${on ? 'bg-brand-tint' : ''}`}>
            <Text className={`text-[16px] ${on ? 'font-bold text-brand-dark' : 'text-muted-dark'}`}>{it}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

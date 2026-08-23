import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useTheme } from '@/src/ui/theme-mode';

// A month grid for picking a day.
//
// The strip of the next fourteen days it replaces could only answer "soon". A
// practitioner booking a follow-up thinks in weeks — "the Tuesday after next",
// "early September" — and a horizontal scroll cannot get there.
export function MonthCalendar({
  selected,
  onSelect,
  locale = 'en',
  markedDays,
  minDate,
}: {
  selected: string | null;          // YYYY-MM-DD
  onSelect: (date: string) => void;
  locale?: string;
  /** Days with availability, dotted so a full month is visible at a glance. */
  markedDays?: Set<string>;
  minDate?: Date;
}) {
  const { t: TT } = useTheme();
  const today = useMemo(() => startOfDay(new Date()), []);
  const floor = minDate ? startOfDay(minDate) : today;
  const [cursor, setCursor] = useState(() => (selected ? new Date(`${selected}T00:00:00`) : new Date()));

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // Monday-first, like the practice calendar on the web.
  const lead = (first.getDay() + 6) % 7;

  const cells: (Date | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1)),
  ];

  const monthLabel = first.toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-GB', { month: 'long', year: 'numeric' });
  const weekdays = Array.from({ length: 7 }, (_, i) =>
    new Date(2024, 0, 1 + i).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-GB', { weekday: 'narrow' }),
  );

  return (
    <View style={{ backgroundColor: TT.card, borderRadius: 20, borderWidth: 1, borderColor: TT.line, padding: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
        <Pressable onPress={() => setCursor(new Date(year, month - 1, 1))} hitSlop={10} accessibilityLabel="Previous month">
          <ChevronLeft size={18} color={TT.ink} />
        </Pressable>
        <Text style={{ flex: 1, textAlign: 'center', fontSize: 15, fontWeight: '800', color: TT.ink, textTransform: 'capitalize' }}>{monthLabel}</Text>
        <Pressable onPress={() => setCursor(new Date(year, month + 1, 1))} hitSlop={10} accessibilityLabel="Next month">
          <ChevronRight size={18} color={TT.ink} />
        </Pressable>
      </View>

      <View style={{ flexDirection: 'row' }}>
        {weekdays.map((w, i) => (
          <Text key={i} style={{ flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '700', color: TT.faint }}>{w}</Text>
        ))}
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 }}>
        {cells.map((d, i) => {
          if (!d) return <View key={`b${i}`} style={{ width: `${100 / 7}%`, height: 42 }} />;
          const key = ymd(d);
          const on = key === selected;
          // A day before today cannot be booked, so it is shown but not offered.
          const past = d < floor;
          const marked = markedDays?.has(key);
          return (
            <Pressable
              key={key}
              onPress={past ? undefined : () => onSelect(key)}
              disabled={past}
              style={{ width: `${100 / 7}%`, height: 42, alignItems: 'center', justifyContent: 'center' }}
            >
              <View style={{ height: 34, width: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? TT.accent : 'transparent' }}>
                <Text style={{ fontSize: 14.5, fontWeight: on ? '800' : '500', color: on ? TT.onAccent : past ? TT.line : TT.ink }}>{d.getDate()}</Text>
              </View>
              {marked && !on ? <View style={{ position: 'absolute', bottom: 4, height: 4, width: 4, borderRadius: 2, backgroundColor: TT.accent }} /> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function ymd(d: Date): string {
  return d.toLocaleDateString('en-CA');
}

function startOfDay(d: Date): Date {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

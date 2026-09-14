import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from 'lucide-react-native';
import { useTheme } from '@/src/ui/theme-mode';
import { useI18n } from '@/src/i18n';

// A month grid for picking a day.
//
// The strip of the next fourteen days it replaces could only answer "soon". A
// practitioner booking a follow-up thinks in weeks — "the Tuesday after next",
// "early September" — and a horizontal scroll cannot get there.
//
// A worksheet's date question is the other use, and it asks for more: any day,
// past or future, and often a long way from today (a birthday, the year
// something happened). Month arrows alone would be forty taps to 1986, so with
// `yearPicker` the month title opens a year grid and then a month grid.
const YEARS_BACK = 126;
const YEARS_AHEAD = 30;
const YEAR_ROW = 48;

export function MonthCalendar({
  selected,
  onSelect,
  locale = 'en',
  markedDays,
  minDate,
  anyDate = false,
  yearPicker = false,
  bare = false,
}: {
  selected: string | null;          // YYYY-MM-DD
  onSelect: (date: string) => void;
  locale?: string;
  /** Days with availability, dotted so a full month is visible at a glance. */
  markedDays?: Set<string>;
  minDate?: Date;
  /** Every day can be picked, before today included. Booking cannot; a
   *  worksheet's date question can. */
  anyDate?: boolean;
  /** The month title jumps to a year, then a month. */
  yearPicker?: boolean;
  /** No card of its own, for a sheet that already is one. */
  bare?: boolean;
}) {
  const { t: tt } = useI18n();
  const { t: TT } = useTheme();
  const today = useMemo(() => startOfDay(new Date()), []);
  const floor = anyDate ? null : minDate ? startOfDay(minDate) : today;
  const [cursor, setCursor] = useState(() => (selected ? new Date(`${selected}T00:00:00`) : new Date()));
  const [mode, setMode] = useState<'days' | 'years' | 'months'>('days');
  const yearsRef = useRef<ScrollView>(null);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // Monday-first, like the practice calendar on the web.
  const lead = (first.getDay() + 6) % 7;
  const loc = locale === 'fr' ? 'fr-FR' : 'en-GB';

  const cells: (Date | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1)),
  ];

  const monthLabel = first.toLocaleDateString(loc, { month: 'long', year: 'numeric' });
  const weekdays = Array.from({ length: 7 }, (_, i) =>
    new Date(2024, 0, 1 + i).toLocaleDateString(loc, { weekday: 'narrow' }),
  );
  const thisYear = today.getFullYear();
  const years = useMemo(() => Array.from({ length: YEARS_BACK + YEARS_AHEAD + 1 }, (_, i) => thisYear + YEARS_AHEAD - i), [thisYear]);
  const monthNames = useMemo(() => Array.from({ length: 12 }, (_, i) => new Date(2024, i, 1).toLocaleDateString(loc, { month: 'short' })), [loc]);

  // The year grid opens on the year being looked at, not on the top of a list
  // of a hundred and fifty. Three to a row, so its row is its index over three.
  useEffect(() => {
    if (mode !== 'years') return;
    const row = Math.floor(years.indexOf(year) / 3);
    const id = setTimeout(() => yearsRef.current?.scrollTo({ y: Math.max(0, (row - 2) * YEAR_ROW), animated: false }), 0);
    return () => clearTimeout(id);
  }, [mode, year, years]);

  const titleRow = (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12, minHeight: 32 }}>
      {mode === 'days' ? (
        <Pressable onPress={() => setCursor(new Date(year, month - 1, 1))} hitSlop={10} accessibilityLabel={tt.common.previousMonth} style={{ padding: 4 }}>
          <ChevronLeft size={18} color={TT.ink} />
        </Pressable>
      ) : <View style={{ width: 26 }} />}
      {yearPicker ? (
        <Pressable
          onPress={() => setMode((m) => (m === 'days' ? 'years' : 'days'))}
          accessibilityRole="button"
          accessibilityState={{ expanded: mode !== 'days' }}
          style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 4 }}
        >
          <Text style={{ fontSize: 15, fontWeight: '800', color: TT.ink, textTransform: 'capitalize' }}>{mode === 'months' ? String(year) : monthLabel}</Text>
          {mode === 'days' ? <ChevronDown size={15} color={TT.accent} strokeWidth={2.5} /> : <ChevronUp size={15} color={TT.accent} strokeWidth={2.5} />}
        </Pressable>
      ) : (
        <Text style={{ flex: 1, textAlign: 'center', fontSize: 15, fontWeight: '800', color: TT.ink, textTransform: 'capitalize' }}>{monthLabel}</Text>
      )}
      {mode === 'days' ? (
        <Pressable onPress={() => setCursor(new Date(year, month + 1, 1))} hitSlop={10} accessibilityLabel={tt.common.nextMonth} style={{ padding: 4 }}>
          <ChevronRight size={18} color={TT.ink} />
        </Pressable>
      ) : <View style={{ width: 26 }} />}
    </View>
  );

  const shell = bare ? {} : { backgroundColor: TT.card, borderRadius: 20, borderWidth: 1, borderColor: TT.line, padding: 14 };
  // Six rows of days, so switching views does not make the sheet jump.
  const bodyHeight = 6 * 42 + 20;

  return (
    <View style={shell}>
      {titleRow}

      {mode === 'years' ? (
        <ScrollView ref={yearsRef} style={{ height: bodyHeight }} showsVerticalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {years.map((y) => {
              const on = y === year;
              return (
                <Pressable key={y} onPress={() => { setCursor(new Date(y, month, 1)); setMode('months'); }} style={{ width: '33.333%', height: YEAR_ROW, alignItems: 'center', justifyContent: 'center' }}>
                  <View style={{ paddingHorizontal: 16, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? TT.accent : 'transparent' }}>
                    <Text style={{ fontSize: 15, fontWeight: on ? '800' : '500', color: on ? TT.onAccent : y === thisYear ? TT.accent : TT.ink }}>{y}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      ) : mode === 'months' ? (
        <View style={{ height: bodyHeight, flexDirection: 'row', flexWrap: 'wrap', alignContent: 'center' }}>
          {monthNames.map((name, i) => {
            const on = i === month;
            return (
              <Pressable key={i} onPress={() => { setCursor(new Date(year, i, 1)); setMode('days'); }} style={{ width: '33.333%', height: 62, alignItems: 'center', justifyContent: 'center' }}>
                <View style={{ minWidth: 74, paddingHorizontal: 12, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? TT.accent : 'transparent' }}>
                  <Text style={{ fontSize: 15, fontWeight: on ? '800' : '600', color: on ? TT.onAccent : TT.ink, textTransform: 'capitalize' }}>{name}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <>
          <View style={{ flexDirection: 'row' }}>
            {weekdays.map((w, i) => (
              <Text key={i} style={{ flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '700', color: TT.faint }}>{w}</Text>
            ))}
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 6, minHeight: yearPicker ? 6 * 42 : undefined }}>
            {cells.map((d, i) => {
              if (!d) return <View key={`b${i}`} style={{ width: `${100 / 7}%`, height: 42 }} />;
              const key = ymd(d);
              const on = key === selected;
              // A day before today cannot be booked, so it is shown but not offered.
              const past = floor ? d < floor : false;
              const marked = markedDays?.has(key);
              const isToday = anyDate && d.getTime() === today.getTime();
              return (
                <Pressable
                  key={key}
                  onPress={past ? undefined : () => onSelect(key)}
                  disabled={past}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on, disabled: past }}
                  accessibilityLabel={d.toLocaleDateString(loc, { day: 'numeric', month: 'long', year: 'numeric' })}
                  style={{ width: `${100 / 7}%`, height: 42, alignItems: 'center', justifyContent: 'center' }}
                >
                  <View style={{ height: 34, width: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? TT.accent : 'transparent', borderWidth: isToday && !on ? 1 : 0, borderColor: TT.accent }}>
                    <Text style={{ fontSize: 14.5, fontWeight: on ? '800' : '500', color: on ? TT.onAccent : past ? TT.line : TT.ink }}>{d.getDate()}</Text>
                  </View>
                  {marked && !on ? <View style={{ position: 'absolute', bottom: 4, height: 4, width: 4, borderRadius: 2, backgroundColor: TT.accent }} /> : null}
                </Pressable>
              );
            })}
          </View>
        </>
      )}
    </View>
  );
}

// Built by hand rather than through `toLocaleDateString('en-CA')`: that only
// happens to print YYYY-MM-DD, depends on the platform's Intl data for it, and
// the worksheet stores this string as the answer.
export function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function startOfDay(d: Date): Date {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

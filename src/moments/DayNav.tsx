// Day navigation strip — ported from v1 (components/DayNav.tsx). Localized
// (English / French). Also exports the date helpers the Moments screen +
// timeline share.
import { View, Text, TouchableOpacity } from 'react-native';
import { useI18n, type Locale } from '@/src/i18n';
import { useTheme } from '@/src/ui/theme-mode';

// Localized short weekday + month names (Sun-indexed / Jan-indexed) plus the
// relative-day labels. Kept local so the date math stays intact.
const WEEKDAYS: Record<Locale, string[]> = {
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  fr: ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'],
};
const MONTHS: Record<Locale, string[]> = {
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  fr: ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'],
};
const T = {
  en: { today: 'Today', yesterday: 'Yesterday' },
  fr: { today: "Aujourd'hui", yesterday: 'Hier' },
} as const;

export function getToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function getDateLabel(date: Date, locale: Locale = 'en'): string {
  const today = getToday();
  if (isSameDay(date, today)) return T[locale].today;
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (isSameDay(date, yesterday)) return T[locale].yesterday;
  const weekday = WEEKDAYS[locale][date.getDay()];
  const month = MONTHS[locale][date.getMonth()];
  const day = date.getDate();
  // English reads "Thu, Jul 24"; French reads "jeu. 24 juil.".
  return locale === 'fr' ? `${weekday} ${day} ${month}` : `${weekday}, ${month} ${day}`;
}

export function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function DayNav({ selected, onSelect }: { selected: Date; onSelect: (d: Date) => void }) {
  const { t: TT } = useTheme();
  const { locale } = useI18n();
  const today = getToday();
  const isViewingToday = isSameDay(selected, today);

  const goBack = () => {
    const prev = new Date(selected);
    prev.setDate(prev.getDate() - 1);
    onSelect(prev);
  };
  const goForward = () => {
    if (isViewingToday) return;
    const next = new Date(selected);
    next.setDate(next.getDate() + 1);
    onSelect(next);
  };

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
      <TouchableOpacity
        onPress={goBack}
        activeOpacity={0.6}
        hitSlop={12}
        style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: TT.card, borderWidth: 1, borderColor: TT.line, alignItems: 'center', justifyContent: 'center' }}
      >
        <Text style={{ fontSize: 18, fontWeight: '600', color: TT.inkSoft, marginTop: -1 }}>‹</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={!isViewingToday ? () => onSelect(today) : undefined} activeOpacity={isViewingToday ? 1 : 0.6}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: isViewingToday ? TT.accent : TT.ink, letterSpacing: -0.2 }}>{getDateLabel(selected, locale)}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={goForward}
        activeOpacity={isViewingToday ? 1 : 0.6}
        hitSlop={12}
        style={{
          width: 34, height: 34, borderRadius: 17,
          backgroundColor: TT.card, borderWidth: 1, borderColor: TT.line,
          alignItems: 'center', justifyContent: 'center', opacity: isViewingToday ? 0.4 : 1,
        }}
      >
        <Text style={{ fontSize: 18, fontWeight: '600', color: TT.inkSoft, marginTop: -1 }}>›</Text>
      </TouchableOpacity>
    </View>
  );
}

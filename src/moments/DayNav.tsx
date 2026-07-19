// Day navigation strip — ported from v1 (components/DayNav.tsx). English labels
// (i18n can be layered later). Also exports the date helpers the Moments screen
// + timeline share.
import { View, Text, TouchableOpacity } from 'react-native';

export function getToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function getDateLabel(date: Date): string {
  const today = getToday();
  if (isSameDay(date, today)) return 'Today';
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (isSameDay(date, yesterday)) return 'Yesterday';
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
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
        style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: '#f5f5f5', alignItems: 'center', justifyContent: 'center' }}
      >
        <Text style={{ fontSize: 18, fontWeight: '600', color: '#999', marginTop: -1 }}>‹</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={!isViewingToday ? () => onSelect(today) : undefined} activeOpacity={isViewingToday ? 1 : 0.6}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: '#000', letterSpacing: -0.2 }}>{getDateLabel(selected)}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={goForward}
        activeOpacity={isViewingToday ? 1 : 0.6}
        hitSlop={12}
        style={{
          width: 34, height: 34, borderRadius: 17,
          backgroundColor: isViewingToday ? '#f8f8f8' : '#f5f5f5',
          alignItems: 'center', justifyContent: 'center', opacity: isViewingToday ? 0.4 : 1,
        }}
      >
        <Text style={{ fontSize: 18, fontWeight: '600', color: '#999', marginTop: -1 }}>›</Text>
      </TouchableOpacity>
    </View>
  );
}

import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect, useRouter } from 'expo-router';
import { CalendarPlus, ChevronLeft, ChevronRight, MapPin, Phone, Video } from 'lucide-react-native';
import { EDA, EdHeader, FadeIn } from '@/src/ui/editorial';
import { PractitionerTabBar, PRACTITIONER_TAB_PAD } from '@/src/ui/PractitionerTabBar';
import { ymd } from '@/src/ui/MonthCalendar';
import { useI18n } from '@/src/i18n';
import { fetchDay, type PractitionerSession } from '@/src/api/practitioner';

// The day, as a timeline rather than a list.
//
// A list tells you what is booked; a timeline tells you what the day FEELS like
// — where the gaps are, which sessions are back to back, how much of the
// afternoon is gone. That is the thing the web's week grid gives at a glance and
// a phone list cannot, so the phone gets the same grid one day wide.
const HOUR_HEIGHT = 58;
// The window the grid shows by default. It is a starting point, not a limit: a
// session outside it stretches the grid rather than being clipped. Fixed bounds
// meant an 06:30 session was positioned at a negative offset and a 22:30 one past
// the end — both simply invisible, on the screen whose entire job is showing the
// day. A practitioner would have had no way to know the session existed.
const DEFAULT_START_HOUR = 7;
const DEFAULT_END_HOUR = 22;

const T = {
  en: { kicker: 'CALENDAR', today: 'Today', nothing: 'Nothing booked.', pending: 'Request', join: 'Join' },
  fr: { kicker: 'AGENDA', today: 'Aujourd’hui', nothing: 'Rien de prévu.', pending: 'Demande', join: 'Rejoindre' },
} as const;

const FORMAT_ICON = { video: Video, in_person: MapPin, phone: Phone } as const;

export default function DayCalendar() {
  const router = useRouter();
  const { locale } = useI18n();
  const tr = T[locale] ?? T.en;

  const [date, setDate] = useState(() => new Date());
  const [items, setItems] = useState<PractitionerSession[]>([]);
  const [tz, setTz] = useState<string | undefined>();
  const [loaded, setLoaded] = useState(false);

  const key = ymd(date);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      setLoaded(false);
      void fetchDay(key).then((d) => {
        if (!alive) return;
        setItems(d?.items ?? []);
        setTz(d?.timezone);
        setLoaded(true);
      });
      return () => { alive = false; };
    }, [key]),
  );

  const zone = tz ? { timeZone: tz } : {};

  // Wall-clock hour and minute in the practitioner's own timezone.
  const hourMinute = useCallback((iso: string): [number, number] => {
    const parts = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', ...zone }).format(new Date(iso));
    const [h, m] = parts.split(':').map(Number);
    return [h, m];
  }, [tz]); // eslint-disable-line react-hooks/exhaustive-deps -- `zone` is derived from tz

  // Widen the window until every session fits, then keep whole hours so the
  // gutter still reads as a clock.
  const [startHour, endHour] = useMemo(() => {
    let lo = DEFAULT_START_HOUR;
    let hi = DEFAULT_END_HOUR;
    for (const s of items) {
      const [h, m] = hourMinute(s.scheduledAt);
      lo = Math.min(lo, h);
      // The END of the session has to fit too, or a late one is half off the grid.
      hi = Math.max(hi, Math.ceil((h * 60 + m + s.durationMinutes) / 60));
    }
    return [Math.max(0, lo), Math.min(24, Math.max(hi, lo + 1))];
  }, [items, hourMinute]);

  const hours = useMemo(
    () => Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i),
    [startHour, endHour],
  );

  // Minutes from the top of the grid.
  const minutesInto = useCallback((iso: string) => {
    const [h, m] = hourMinute(iso);
    return (h - startHour) * 60 + m;
  }, [hourMinute, startHour]);

  const step = (days: number) => {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    setDate(next);
  };

  const heading = date.toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long', ...zone });
  const isToday = key === ymd(new Date());

  return (
    <View style={{ flex: 1, backgroundColor: EDA.canvas }}>
      <StatusBar style="dark" />
      <EdHeader kicker={tr.kicker} title={isToday ? tr.today : heading} rightIcon={CalendarPlus} onRight={() => router.navigate('/(practitioner)/book' as never)} />

      {/* Day stepper — the whole point of a day view is moving between days. */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 22, paddingTop: 14 }}>
        <Pressable onPress={() => step(-1)} hitSlop={10} style={circle} accessibilityLabel="Previous day">
          <ChevronLeft size={17} color={EDA.ink} />
        </Pressable>
        <Pressable onPress={() => setDate(new Date())} style={{ borderRadius: 18, borderWidth: 1, borderColor: EDA.line, backgroundColor: EDA.card, paddingHorizontal: 14, paddingVertical: 8 }}>
          <Text style={{ fontSize: 13.5, fontWeight: '700', color: EDA.ink }}>{tr.today}</Text>
        </Pressable>
        <Text style={{ flex: 1, fontSize: 13.5, color: EDA.inkSoft, textTransform: 'capitalize' }} numberOfLines={1}>{heading}</Text>
        <Pressable onPress={() => step(1)} hitSlop={10} style={circle} accessibilityLabel="Next day">
          <ChevronRight size={17} color={EDA.ink} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: PRACTITIONER_TAB_PAD, paddingHorizontal: 22, paddingTop: 16 }} showsVerticalScrollIndicator={false}>
        <FadeIn>
          {!loaded && <ActivityIndicator />}
          {loaded && items.length === 0 && (
            <Text style={{ fontSize: 13.5, color: EDA.faint, marginBottom: 12 }}>{tr.nothing}</Text>
          )}

          <View style={{ flexDirection: 'row' }}>
            {/* Hour gutter */}
            <View style={{ width: 46 }}>
              {hours.map((h) => (
                <View key={h} style={{ height: HOUR_HEIGHT }}>
                  <Text style={{ fontSize: 11, color: EDA.faint, marginTop: -6 }}>{String(h).padStart(2, '0')}:00</Text>
                </View>
              ))}
            </View>

            <View style={{ flex: 1, position: 'relative' }}>
              {hours.map((h) => (
                <View key={h} style={{ height: HOUR_HEIGHT, borderTopWidth: 1, borderTopColor: EDA.line }} />
              ))}

              {/* Now line, only on today — a day view without it makes you do the
                  arithmetic yourself. */}
              {isToday && <NowLine minutesInto={minutesInto} spanMinutes={(endHour - startHour) * 60} />}

              {items.map((s) => {
                const top = (minutesInto(s.scheduledAt) / 60) * HOUR_HEIGHT;
                const height = Math.max(30, (s.durationMinutes / 60) * HOUR_HEIGHT - 4);
                const pending = s.status === 'pending';
                const Icon = FORMAT_ICON[s.sessionFormat as keyof typeof FORMAT_ICON] ?? MapPin;
                return (
                  <View
                    key={s.id}
                    style={{
                      position: 'absolute', left: 6, right: 0, top, height,
                      borderRadius: 10, paddingHorizontal: 9, paddingVertical: 6,
                      backgroundColor: pending ? '#FFF7E6' : EDA.greenTint,
                      borderLeftWidth: 3, borderLeftColor: pending ? '#B45309' : EDA.green,
                    }}
                  >
                    <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: '800', color: pending ? '#B45309' : EDA.greenDeep }}>
                      {s.who}{pending ? ` · ${tr.pending}` : ''}
                    </Text>
                    {height > 40 && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 }}>
                        <Icon size={11} color={EDA.inkSoft} />
                        <Text numberOfLines={1} style={{ flex: 1, fontSize: 11.5, color: EDA.inkSoft }}>
                          {s.location || s.sessionFormat.replace('_', ' ')}
                        </Text>
                        {s.meetLink ? (
                          <Pressable onPress={() => { void Linking.openURL(s.meetLink as string); }} hitSlop={6}>
                            <Text style={{ fontSize: 11.5, fontWeight: '800', color: EDA.green }}>{tr.join}</Text>
                          </Pressable>
                        ) : null}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        </FadeIn>
      </ScrollView>

      <PractitionerTabBar active="calendar" />
    </View>
  );
}

function NowLine({ minutesInto, spanMinutes }: { minutesInto: (iso: string) => number; spanMinutes: number }) {
  const mins = minutesInto(new Date().toISOString());
  // Outside the drawn window there is no honest place to put it, so it is not drawn.
  if (mins < 0 || mins > spanMinutes) return null;
  return (
    <View style={{ position: 'absolute', left: 0, right: 0, top: (mins / 60) * HOUR_HEIGHT, flexDirection: 'row', alignItems: 'center' }}>
      <View style={{ height: 7, width: 7, borderRadius: 4, backgroundColor: '#C0392B' }} />
      <View style={{ flex: 1, height: 1, backgroundColor: '#C0392B' }} />
    </View>
  );
}

const circle = { height: 34, width: 34, borderRadius: 17, alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: EDA.card, borderWidth: 1, borderColor: EDA.line };

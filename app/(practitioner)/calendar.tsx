import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect, useRouter } from 'expo-router';
import { CalendarPlus, ChevronLeft, ChevronRight, MapPin, Phone, Video } from 'lucide-react-native';
import { EDA, EdHeader, FadeIn } from '@/src/ui/editorial';
import { PractitionerTabBar, PRACTITIONER_TAB_PAD } from '@/src/ui/PractitionerTabBar';
import { ymd } from '@/src/ui/MonthCalendar';
import { SessionSheet } from '@/src/practitioner/SessionSheet';
import { useI18n } from '@/src/i18n';
import { fetchDay, fetchBookingOptions, type CloseReasonGroup, type PractitionerSession, type SessionTypeOption } from '@/src/api/practitioner';

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

// Tapping an empty stretch books there. Rounding to the quarter hour is the
// difference between "book at 10:15" and "book at 10:13" — a tap is a coarse
// instrument and nobody means 10:13.
const SNAP_MINUTES = 15;

const T = {
  en: { kicker: 'CALENDAR', today: 'Today', nothing: 'Nothing booked.', pending: 'Request' },
  fr: { kicker: 'AGENDA', today: 'Aujourd’hui', nothing: 'Rien de prévu.', pending: 'Demande' },
} as const;

const FORMAT_ICON = { video: Video, in_person: MapPin, phone: Phone } as const;

// A session that is no longer going to happen still belongs on the day it was
// on — but it should not compete with the ones that are.
const OFF = new Set(['cancelled', 'no_show']);

export default function DayCalendar() {
  const router = useRouter();
  const { locale } = useI18n();
  const tr = T[locale] ?? T.en;

  const [date, setDate] = useState(() => new Date());
  const [items, setItems] = useState<PractitionerSession[]>([]);
  const [tz, setTz] = useState<string | undefined>();
  const [currency, setCurrency] = useState('EUR');
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState<PractitionerSession | null>(null);
  // The sheet needs two things the day itself does not carry: the no-show
  // reasons, and which session types have a pay link. Both belong to the
  // practice rather than the day, so they are fetched once and reused.
  const [types, setTypes] = useState<SessionTypeOption[]>([]);
  const [closeReasons, setCloseReasons] = useState<CloseReasonGroup[]>([]);

  const key = ymd(date);

  const load = useCallback(() => {
    let alive = true;
    setLoaded(false);
    void fetchDay(key).then((d) => {
      if (!alive) return;
      setItems(d?.items ?? []);
      setTz(d?.timezone);
      if (d?.currency) setCurrency(d.currency);
      setLoaded(true);
    });
    return () => { alive = false; };
  }, [key]);

  useFocusEffect(load);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      void fetchBookingOptions().then((o) => {
        if (!alive || !o) return;
        setTypes(o.sessionTypes ?? []);
        setCloseReasons(o.closeReasons ?? []);
      });
      return () => { alive = false; };
    }, []),
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

  // Wall-clock HH:MM in the practitioner's timezone, for the block's time range.
  const hhmm = useCallback((iso: string) => {
    const [h, m] = hourMinute(iso);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }, [hourMinute]);
  const endOf = (s: PractitionerSession) =>
    new Date(new Date(s.scheduledAt).getTime() + s.durationMinutes * 60_000).toISOString();

  const step = (days: number) => {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    setDate(next);
  };

  // Tap a gap in the day → book there. The tap gives a DAY and a TIME, never an
  // instant: the free slots still come from the server, so a tap can only ever
  // preselect a starting point, not conjure availability that isn't there.
  //
  // The time comes from WHICH band was tapped rather than from the tap's y
  // coordinate. Coordinates looked simpler and were wrong: react-native-web
  // does not populate `locationY` on a press, so every tap on the web build
  // produced NaN and booked "NaN:NaN". Bands also give each half hour a real
  // touch target, which a screen reader can reach and a coordinate cannot.
  const bookAt = (h: number, m: number) => {
    if (h >= 24) return;
    router.navigate({
      pathname: '/(practitioner)/book',
      params: { initialDate: key, initialTime: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}` },
    } as never);
  };

  // Which of THIS session's type has a pay link — the sheet needs it to decide
  // whether "remind for payment" has anything to send.
  const hasPaymentLink = Boolean(open && types.find((t) => t.id === open.sessionType)?.hasPaymentLink);

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

            {/* The grid itself is the "book here" target. Each half hour is its
                own band, and the bands sit UNDER the session blocks — so a tap
                on a session opens that session and a tap on a gap starts a
                booking. No mode to switch, no long-press to discover. */}
            <View style={{ flex: 1, position: 'relative' }}>
              {hours.map((h) => (
                <View key={h} style={{ height: HOUR_HEIGHT, borderTopWidth: 1, borderTopColor: EDA.line }}>
                  {[0, SNAP_MINUTES * 2].map((m) => (
                    <Pressable
                      key={m}
                      onPress={() => bookAt(h, m)}
                      style={{ height: HOUR_HEIGHT / 2 }}
                      accessibilityRole="button"
                      accessibilityLabel={`Book at ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`}
                    />
                  ))}
                </View>
              ))}

              {/* Now line, only on today — a day view without it makes you do the
                  arithmetic yourself. */}
              {isToday && <NowLine minutesInto={minutesInto} spanMinutes={(endHour - startHour) * 60} />}

              {items.map((s) => (
                <SessionBlock
                  key={s.id}
                  session={s}
                  top={(minutesInto(s.scheduledAt) / 60) * HOUR_HEIGHT}
                  timeLabel={`${hhmm(s.scheduledAt)}–${hhmm(endOf(s))}`}
                  pendingLabel={tr.pending}
                  onPress={() => setOpen(s)}
                />
              ))}
            </View>
          </View>
        </FadeIn>
      </ScrollView>

      <SessionSheet
        session={open}
        timezone={tz}
        currency={currency}
        closeReasons={closeReasons}
        hasPaymentLink={hasPaymentLink}
        onClose={() => setOpen(null)}
        onChanged={load}
      />

      <PractitionerTabBar active="calendar" />
    </View>
  );
}

/**
 * One session on the grid.
 *
 * A block is read at a glance, between other things, so it earns its space by
 * answering "who, when, how" in that order — the time RANGE included, because
 * position on the grid gives the start and nothing about the end, and "is this
 * the hour one or the half hour one" is exactly what you squint at.
 *
 * White with a coloured rail rather than a wash of colour: on a day with five
 * sessions, five tinted rectangles compete with each other and with the grid.
 * The rail carries the state, so the text stays black on white and legible.
 *
 * What it shows degrades with its height, which is set by the session's real
 * duration. A 30-minute block cannot hold three lines, so it holds the one that
 * matters.
 */
function SessionBlock({ session: s, top, timeLabel, pendingLabel, onPress }: {
  session: PractitionerSession; top: number; timeLabel: string; pendingLabel: string; onPress: () => void;
}) {
  const height = Math.max(28, (s.durationMinutes / 60) * HOUR_HEIGHT - 4);
  const pending = s.status === 'pending';
  const off = OFF.has(s.status ?? '');
  const Icon = FORMAT_ICON[s.sessionFormat as keyof typeof FORMAT_ICON] ?? MapPin;
  const rail = pending ? '#D97706' : off ? '#C9C7BF' : EDA.green;
  // 36px is where the second line stops being cramped. A 45-minute session
  // lands at ~40px and a 30-minute one at ~25, which is the split we want:
  // three quarters of an hour still says when it is, half an hour does not.
  const roomy = height >= 36;
  const meta = s.location || s.sessionFormat.replace('_', ' ');

  return (
    <Pressable
      onPress={onPress}
      style={{
        position: 'absolute', left: 4, right: 0, top, height,
        flexDirection: 'row', overflow: 'hidden',
        borderRadius: 9,
        backgroundColor: off ? '#F3F2EE' : EDA.card,
        borderWidth: 1, borderColor: off ? '#E6E4DE' : EDA.line,
      }}
    >
      {/* The rail carries the state, so the card itself can stay white. */}
      <View style={{ width: 3, backgroundColor: rail }} />

      <View style={{ flex: 1, minWidth: 0, paddingHorizontal: 8, paddingVertical: roomy ? 5 : 3, justifyContent: roomy ? 'flex-start' : 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text
            numberOfLines={1}
            style={{
              flexShrink: 1, fontSize: 13, fontWeight: '700', letterSpacing: -0.1,
              color: off ? EDA.faint : EDA.ink,
              // A cancelled session reads as a booked one at a glance otherwise,
              // and the glance is the whole point of a day grid.
              textDecorationLine: off ? 'line-through' : 'none',
            }}
          >
            {s.who}
          </Text>
          {pending && (
            <View style={{ borderRadius: 8, backgroundColor: '#FEF3C7', paddingHorizontal: 6, paddingVertical: 1 }}>
              <Text style={{ fontSize: 9.5, fontWeight: '800', letterSpacing: 0.3, color: '#B45309' }}>{pendingLabel.toUpperCase()}</Text>
            </View>
          )}
        </View>

        {roomy && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 }}>
            <Text style={{ fontSize: 11, fontWeight: '600', color: EDA.inkSoft, fontVariant: ['tabular-nums'] }}>{timeLabel}</Text>
            <View style={{ height: 2.5, width: 2.5, borderRadius: 2, backgroundColor: EDA.faint }} />
            <Icon size={10.5} color={EDA.faint} />
            <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 11, color: EDA.faint }}>{meta}</Text>
          </View>
        )}
      </View>
    </Pressable>
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

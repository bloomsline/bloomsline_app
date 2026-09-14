// A worksheet's date question.
//
// It was a text box asking for DD/MM/YYYY, which is three problems in one: a
// keyboard that is mostly the wrong keys for a date, a format the patient has to
// remember, and an answer the server quietly dropped when it was typed any other
// way ("14 sept", "14/9/26"). A calendar cannot produce a date that does not
// exist, and the field shows the day in words, in the patient's language, so
// what they picked is what they read.
//
// The stored value is unchanged: `YYYY-MM-DD`, which the server keeps as it is.
// Answers typed into the old field (`DD/MM/YYYY`) still read and show correctly;
// they are only rewritten if the patient picks another day.
import { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CalendarDays, X } from 'lucide-react-native';
import { useI18n } from '@/src/i18n';
import { useCare } from '@/src/care/theme';
import { MonthCalendar, ymd } from '@/src/ui/MonthCalendar';
import { isoOf, readDate, type DateParts } from '@/src/resources/answers';

const COPY = {
  en: { choose: 'Choose a date', title: 'Pick a date', clear: 'Clear date', today: 'Today', close: 'Close', none: 'No date.', change: 'Change date' },
  fr: { choose: 'Choisir une date', title: 'Choisir une date', clear: 'Effacer la date', today: 'Aujourd’hui', close: 'Fermer', none: 'Aucune date.', change: 'Changer la date' },
} as const;

/** "14 September 2026" / "14 septembre 2026". */
export function formatDateParts(p: DateParts, locale: 'en' | 'fr'): string {
  try {
    // Noon, so no timezone can move it onto the day before.
    return new Date(p.y, p.m - 1, p.d, 12).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return `${String(p.d).padStart(2, '0')}/${String(p.m).padStart(2, '0')}/${p.y}`;
  }
}

export function DateField({ value, onChange, readOnly }: { value: unknown; onChange: (v: unknown) => void; readOnly?: boolean }) {
  const C = useCare();
  const { locale } = useI18n();
  const c = COPY[locale] ?? COPY.en;
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);

  const parts = readDate(value);
  // Something stored that is not a date (free text from an old build's local
  // copy). Shown as written rather than hidden, so nothing the patient wrote
  // silently disappears; picking a day replaces it.
  const raw = !parts && typeof value === 'string' ? value.trim() : '';
  const shown = parts ? formatDateParts(parts, locale) : raw;

  if (readOnly) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: C.border, borderRadius: 14, backgroundColor: C.card, paddingHorizontal: 14, paddingVertical: 13 }}>
        <CalendarDays size={17} color={shown ? C.teal : C.muted} strokeWidth={2} />
        <Text style={{ flex: 1, fontSize: 15, color: shown ? C.ink : C.muted }}>{shown || c.none}</Text>
      </View>
    );
  }

  const pick = (iso: string) => {
    onChange(iso);
    setOpen(false);
  };

  return (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: C.border, borderRadius: 14, backgroundColor: C.card }}>
        <Pressable
          onPress={() => setOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={shown ? `${c.change}, ${shown}` : c.choose}
          style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 13 }}
        >
          <CalendarDays size={17} color={C.teal} strokeWidth={2} />
          <Text style={{ flex: 1, fontSize: 15, color: shown ? C.ink : C.muted, fontWeight: shown ? '600' : '400' }}>{shown || c.choose}</Text>
        </Pressable>
        {shown ? (
          <Pressable onPress={() => onChange(undefined)} hitSlop={8} accessibilityRole="button" accessibilityLabel={c.clear} style={{ paddingHorizontal: 14, paddingVertical: 13 }}>
            <X size={17} color={C.muted} />
          </Pressable>
        ) : null}
      </View>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)} statusBarTranslucent>
        <Pressable style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: C.scrim }} onPress={() => setOpen(false)}>
          {/* The sheet swallows its own taps, so a tap on a day does not also
              land on the scrim and close it before the day is kept. */}
          <Pressable
            onPress={() => {}}
            style={{ backgroundColor: C.sheet, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 18, paddingTop: 16, paddingBottom: Math.max(28, insets.bottom + 16), width: '100%', maxWidth: 520, alignSelf: 'center' }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ flex: 1, fontSize: 17, fontWeight: '800', color: C.ink }}>{c.title}</Text>
              <Pressable onPress={() => setOpen(false)} hitSlop={10} accessibilityRole="button" accessibilityLabel={c.close}>
                <X size={20} color={C.muted} />
              </Pressable>
            </View>
            <MonthCalendar selected={parts ? isoOf(parts) : null} onSelect={pick} locale={locale} anyDate yearPicker bare />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
              <Pressable onPress={() => pick(ymd(new Date()))} accessibilityRole="button" style={{ flex: 1, height: 46, borderRadius: 23, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 14.5, fontWeight: '700', color: C.ink }}>{c.today}</Text>
              </Pressable>
              {shown ? (
                <Pressable onPress={() => { onChange(undefined); setOpen(false); }} accessibilityRole="button" style={{ flex: 1, height: 46, borderRadius: 23, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 14.5, fontWeight: '700', color: C.ink }}>{c.clear}</Text>
                </Pressable>
              ) : null}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

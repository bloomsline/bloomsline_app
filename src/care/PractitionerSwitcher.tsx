// Switching practitioner: the sheet that lists them, and the line that says it
// happened.
//
// One component for the three places it opens from (My Care, the practitioner
// profile, Settings), so a patient meets the same list with the same faces
// wherever they look for it. OptionSheet is the model, and not reused, because
// a practitioner is a person: a face beside the name is how a patient tells
// "Anna Martin" from "Anna Moreau" at a glance.
//
// The confirmation matters more than it looks. Choosing someone reloads the
// whole of My Care; without a word about it, the screen just flickers and
// shows different sessions, which reads as a glitch rather than as the thing
// that was asked for.
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check } from 'lucide-react-native';
import { PractitionerAvatar } from '@/src/care/PractitionerAvatar';
import { useSelectedPractitioner } from '@/src/care/selected-practitioner';
import { useI18n, fmt } from '@/src/i18n';
import { useTheme } from '@/src/ui/theme-mode';

/** How long "Now showing Anna" stays up. Long enough to read, short enough not
 *  to sit over the sessions it is announcing. */
const TOAST_MS = 2400;

export function PractitionerSwitchSheet({
  visible,
  onClose,
  onSwitched,
}: {
  visible: boolean;
  onClose: () => void;
  /** Fired with the new practitioner's name once the switch has been made. */
  onSwitched?: (name: string) => void;
}) {
  const { t: TT } = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const { practitioners, selectedId, select } = useSelectedPractitioner();

  const choose = (id: string, name: string) => {
    onClose();
    // Choosing the one already selected is a way of closing the sheet, not a
    // switch: no reload, and no "Now showing" for what was already showing.
    if (id === selectedId) return;
    select(id);
    onSwitched?.(name);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: TT.scrim }} onPress={onClose}>
        <Pressable style={{ borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: TT.sheet, paddingBottom: Math.max(34, insets.bottom + 16) }} onPress={() => {}}>
          <View style={{ alignItems: 'center', paddingTop: 12 }}>
            <View style={{ height: 4, width: 40, borderRadius: 2, backgroundColor: TT.line }} />
          </View>

          <Text style={{ fontSize: 17, fontWeight: '800', color: TT.ink, letterSpacing: -0.2, paddingHorizontal: 24, paddingTop: 18 }}>
            {t.care.yourPractitioners}
          </Text>
          <Text style={{ fontSize: 13, color: TT.faint, lineHeight: 18, paddingHorizontal: 24, paddingTop: 4, paddingBottom: 8 }}>
            {t.care.switchHint}
          </Text>

          {practitioners.map((p, i) => {
            const on = p.id === selectedId;
            return (
              <Pressable
                key={p.id}
                onPress={() => choose(p.id, p.name)}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                accessibilityLabel={p.name}
                style={({ pressed }) => ({
                  flexDirection: 'row', alignItems: 'center', gap: 14,
                  paddingHorizontal: 24, paddingVertical: 12,
                  borderTopWidth: i === 0 ? 0 : 1, borderTopColor: TT.line,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                {/* photoUrl passed explicitly (null included), so the avatar
                    draws this row's person and never the cached selected face. */}
                <PractitionerAvatar size={40} name={p.name} photoUrl={p.photoUrl} />
                <Text numberOfLines={1} style={{ flex: 1, fontSize: 16, fontWeight: on ? '700' : '500', color: TT.ink }}>{p.name}</Text>
                {on ? <Check size={19} color={TT.accent} strokeWidth={2.6} /> : null}
              </Pressable>
            );
          })}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** "Now showing Anna", faded in over the top of the screen and gone again. */
function SwitchedToast({ shown, onDone }: { shown: { name: string; at: number } | null; onDone: () => void }) {
  const name = shown?.name ?? null;
  const { t: TT } = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const opacity = useRef(new Animated.Value(0)).current;
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    if (!name) return;
    const text = fmt(t.care.nowShowing, { name });
    // Said aloud too: a screen reader user hears the page change under them
    // otherwise, with nothing to say why.
    AccessibilityInfo.announceForAccessibility?.(text);
    opacity.setValue(0);
    const anim = Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.delay(TOAST_MS),
      Animated.timing(opacity, { toValue: 0, duration: 260, useNativeDriver: true }),
    ]);
    anim.start(({ finished }) => { if (finished) doneRef.current(); });
    return () => anim.stop();
    // `at`, not only the name: switching away and straight back names the same
    // person twice, and the second switch deserves its line too.
  }, [name, shown?.at, opacity, t]);

  if (!name) return null;
  return (
    <Animated.View
      pointerEvents="none"
      style={{ position: 'absolute', top: insets.top + 10, left: 16, right: 16, alignItems: 'center', opacity, zIndex: 50 }}
    >
      <View style={{ backgroundColor: TT.ctaBg, borderRadius: 999, paddingVertical: 10, paddingHorizontal: 18, maxWidth: '100%' }}>
        <Text numberOfLines={1} style={{ color: TT.ctaFg, fontSize: 13.5, fontWeight: '700' }}>{fmt(t.care.nowShowing, { name })}</Text>
      </View>
    </Animated.View>
  );
}

/**
 * The switcher for a screen: a function to open it, and the sheet and toast to
 * render once, anywhere in the screen's tree (last, so the toast paints above).
 *
 * `canSwitch` is false with fewer than two practitioners, and callers draw no
 * affordance at all then. A single-practitioner patient sees nothing new.
 */
export function usePractitionerSwitcher(): { open: () => void; canSwitch: boolean; element: ReactNode } {
  const { canSwitch } = useSelectedPractitioner();
  const [visible, setVisible] = useState(false);
  const [toast, setToast] = useState<{ name: string; at: number } | null>(null);
  const open = useCallback(() => setVisible(true), []);
  const element = (
    <>
      <PractitionerSwitchSheet visible={visible} onClose={() => setVisible(false)} onSwitched={(name) => setToast({ name, at: Date.now() })} />
      <SwitchedToast shown={toast} onDone={() => setToast(null)} />
    </>
  );
  return { open, canSwitch, element };
}

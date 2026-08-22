// A small menu that hangs off the control that opened it.
//
// React Native's Modal positions against the WINDOW, not against the button —
// on the web build, where the app sits in a centred phone-width frame, a menu
// placed from the window corner lands outside the phone entirely. So the caller
// hands over the trigger's measured rectangle and the menu is placed from that,
// which is also the right behaviour on a tablet.
import { useCallback, useRef, useState } from 'react';
import { Modal, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { useTheme } from '@/src/ui/theme-mode';

export interface Anchor { x: number; y: number; w: number; h: number }

/** Wires a trigger to its measured rectangle. Give the ref to the trigger and
 *  call `open()` from its onPress. */
export function useAnchoredMenu() {
  const ref = useRef<View>(null);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const [open, setOpen] = useState(false);

  const show = useCallback(() => {
    ref.current?.measureInWindow((x, y, w, h) => setAnchor({ x, y, w, h }));
    setOpen(true);
  }, []);

  return { ref, anchor, open, show, hide: useCallback(() => setOpen(false), []) };
}

export interface MenuAction {
  key: string;
  label: string;
  color?: string;
  Icon?: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  disabled?: boolean;
  onPress: () => void;
}

export function AnchoredMenu({
  open, anchor, onClose, width = 210, note, actions, align = 'right',
}: {
  open: boolean;
  anchor: Anchor | null;
  onClose: () => void;
  width?: number;
  /** One line of context above the actions. Omit when there is nothing to say. */
  note?: string;
  actions: MenuAction[];
  align?: 'left' | 'right';
}) {
  const { t: TT } = useTheme();
  const { width: screenW, height: screenH } = useWindowDimensions();

  const rawLeft = anchor ? (align === 'right' ? anchor.x + anchor.w - width : anchor.x) : screenW - width - 18;
  const left = Math.max(8, Math.min(rawLeft, screenW - width - 8));

  // Flip above the trigger when there is no room below, so a menu on the last
  // block of a long page is not half off the screen.
  const estimated = (note ? 38 : 0) + actions.length * 45 + 2;
  const below = anchor ? anchor.y + anchor.h + 8 : 92;
  const top = anchor && below + estimated > screenH - 12 ? Math.max(12, anchor.y - estimated - 8) : below;

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(22,24,20,0.2)' }} />
      <View style={{ position: 'absolute', top, left, width, backgroundColor: '#fff', borderWidth: 1, borderColor: TT.line, borderRadius: 16, overflow: 'hidden' }}>
        {note ? (
          <Text style={{ paddingHorizontal: 14, paddingTop: 12, paddingBottom: 10, fontSize: 11.5, color: TT.faint, borderBottomWidth: 1, borderBottomColor: '#F1EFEA' }}>
            {note}
          </Text>
        ) : null}
        {actions.map((a) => (
          <Pressable
            key={a.key}
            disabled={a.disabled}
            onPress={() => { onClose(); a.onPress(); }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 14, paddingVertical: 13, opacity: a.disabled ? 0.35 : 1 }}
          >
            {a.Icon ? <a.Icon size={15} color={a.color ?? TT.ink} strokeWidth={1.9} /> : null}
            <Text style={{ flex: 1, fontSize: 13.5, fontWeight: '700', color: a.color ?? TT.ink }}>{a.label}</Text>
          </Pressable>
        ))}
      </View>
    </Modal>
  );
}

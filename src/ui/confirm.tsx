// App-wide THEMED confirmation dialog. Replaces the OS/browser defaults
// (Alert.alert / window.confirm) with one on-brand popup. Imperative API via a
// promise-returning hook so call sites stay tiny:
//   const confirm = useConfirm();
//   if (await confirm({ title, message, confirmLabel, destructive })) doThing();
//
// WHERE IT RENDERS is the interesting part. A Modal is right when the caller is
// an ordinary screen, and wrong when the caller is itself inside a Modal: two
// SIBLING Modals do not stack on Android — the second opens behind the first,
// so confirming from a bottom sheet put the dialog underneath the sheet and you
// had to dismiss the sheet to reach it.
//
// So a sheet hosts the dialog itself. It drops a <ConfirmLayer /> inside its own
// Modal; the provider then renders into the innermost layer instead of at the
// root, which keeps it to one Modal deep however the sheets are nested.
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '@/src/ui/theme-mode';

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

interface ConfirmValue {
  confirm: (o: ConfirmOptions) => Promise<boolean>;
  /** The dialog itself, or null. Rendered by whichever layer is innermost. */
  dialog: ReactNode;
  claim: (id: number) => void;
  release: (id: number) => void;
  /** The layer allowed to render right now; null means the root. */
  top: number | null;
}

const noop = async () => false;
const ConfirmContext = createContext<ConfirmValue>({ confirm: noop, dialog: null, claim: () => {}, release: () => {}, top: null });

let nextLayerId = 1;

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const { t: TT } = useTheme();
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const [layers, setLayers] = useState<number[]>([]);
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback(
    (o: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        resolver.current = resolve;
        setOpts(o);
      }),
    [],
  );

  const close = (v: boolean) => {
    setOpts(null);
    resolver.current?.(v);
    resolver.current = null;
  };

  const claim = useCallback((id: number) => setLayers((l) => [...l, id]), []);
  const release = useCallback((id: number) => setLayers((l) => l.filter((x) => x !== id)), []);
  const top = layers.length > 0 ? layers[layers.length - 1] : null;

  const dialog = opts ? (
    <Pressable onPress={() => close(false)} style={{ flex: 1, backgroundColor: TT.scrim, alignItems: 'center', justifyContent: 'center', padding: 26 }}>
      <Pressable onPress={() => {}} style={{ width: '100%', maxWidth: 360, backgroundColor: TT.sheet, borderRadius: 26, padding: 22, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 8 }}>
        <Text style={{ fontSize: 17.5, fontWeight: '800', color: TT.ink, letterSpacing: -0.2, marginBottom: opts.message ? 8 : 18 }}>{opts.title}</Text>
        {opts.message ? <Text style={{ fontSize: 14.5, lineHeight: 22, color: TT.inkSoft, marginBottom: 20 }}>{opts.message}</Text> : null}
        <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'flex-end' }}>
          <TouchableOpacity onPress={() => close(false)} activeOpacity={0.8} style={{ paddingHorizontal: 16, paddingVertical: 11, borderRadius: 22, borderWidth: 1, borderColor: TT.line, backgroundColor: TT.bg }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: TT.ink }}>{opts.cancelLabel ?? 'Cancel'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => close(true)} activeOpacity={0.85} style={{ paddingHorizontal: 18, paddingVertical: 11, borderRadius: 22, backgroundColor: opts.destructive ? TT.danger : TT.accent }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: opts.destructive ? TT.onDanger : TT.onAccent }}>{opts.confirmLabel ?? 'Confirm'}</Text>
          </TouchableOpacity>
        </View>
      </Pressable>
    </Pressable>
  ) : null;

  // Not memoised: `dialog` is JSX and is a new value every render anyway, so a
  // useMemo here buys nothing and only misleads. The provider itself re-renders
  // just twice per confirmation (open, close) and when a sheet claims a layer.
  const value: ConfirmValue = { confirm, dialog, claim, release, top };

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      {/* The root layer, for callers that are ordinary screens. Suppressed while
          a sheet has claimed the dialog, so it is never rendered twice.
          On web the Modal is swapped for a fixed overlay — a leftover from an
          earlier stacking attempt. It does not actually win against a Modal
          there either (RNW gives every Modal its own fixed root under <body>,
          which this cannot climb out of), but web sheets now host their own
          layer, so that path no longer has to. */}
      {top === null
        ? Platform.OS === 'web'
          ? opts && <View style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 2147483000 } as never}>{dialog}</View>
          : <Modal visible={!!opts} transparent animationType="fade" onRequestClose={() => close(false)}>{dialog}</Modal>
        : null}
    </ConfirmContext.Provider>
  );
}

/**
 * Drop this inside a Modal-based sheet, as its LAST child, and confirmations
 * raised from that sheet will render above it instead of behind it.
 *
 * Claiming is by mount order, so the innermost open sheet wins and a sheet that
 * closes hands the dialog back to whatever is underneath.
 */
export function ConfirmLayer() {
  const { dialog, claim, release, top } = useContext(ConfirmContext);
  const id = useRef(nextLayerId++).current;

  useEffect(() => {
    claim(id);
    return () => release(id);
  }, [claim, release, id]);

  if (top !== id || !dialog) return null;
  return <View style={StyleSheet.absoluteFill}>{dialog}</View>;
}

export function useConfirm() {
  return useContext(ConfirmContext).confirm;
}

// App-wide THEMED confirmation dialog. Replaces the OS/browser defaults
// (Alert.alert / window.confirm) with one on-brand popup. Imperative API via a
// promise-returning hook so call sites stay tiny:
//   const confirm = useConfirm();
//   if (await confirm({ title, message, confirmLabel, destructive })) doThing();
import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { Modal, Platform, Pressable, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '@/src/ui/theme-mode';

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

const ConfirmContext = createContext<(o: ConfirmOptions) => Promise<boolean>>(async () => false);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const { t: TT } = useTheme();
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
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

  const overlay = opts ? (
    <Pressable onPress={() => close(false)} style={{ flex: 1, backgroundColor: 'rgba(20,20,18,0.45)', alignItems: 'center', justifyContent: 'center', padding: 26 }}>
      <Pressable onPress={() => {}} style={{ width: '100%', maxWidth: 360, backgroundColor: TT.card, borderRadius: 26, padding: 22, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 8 }}>
        <Text style={{ fontSize: 17.5, fontWeight: '800', color: TT.ink, letterSpacing: -0.2, marginBottom: opts.message ? 8 : 18 }}>{opts.title}</Text>
        {opts.message ? <Text style={{ fontSize: 14.5, lineHeight: 22, color: TT.inkSoft, marginBottom: 20 }}>{opts.message}</Text> : null}
        <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'flex-end' }}>
          <TouchableOpacity onPress={() => close(false)} activeOpacity={0.8} style={{ paddingHorizontal: 16, paddingVertical: 11, borderRadius: 22, borderWidth: 1, borderColor: TT.line, backgroundColor: TT.bg }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: TT.ink }}>{opts.cancelLabel ?? 'Cancel'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => close(true)} activeOpacity={0.85} style={{ paddingHorizontal: 18, paddingVertical: 11, borderRadius: 22, backgroundColor: opts.destructive ? '#DC2626' : TT.accent }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff' }}>{opts.confirmLabel ?? 'Confirm'}</Text>
          </TouchableOpacity>
        </View>
      </Pressable>
    </Pressable>
  ) : null;

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {/* On web, a react-native-web Modal stacks below other later-opened Modals
          (e.g. the MomentDetail bottom sheet), so the confirm renders BEHIND
          them. Use a fixed overlay with a very high z-index there; native Modals
          stack by present order, so keep Modal on native. */}
      {Platform.OS === 'web'
        ? opts && <View style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 2147483000 } as never}>{overlay}</View>
        : (
          <Modal visible={!!opts} transparent animationType="fade" onRequestClose={() => close(false)}>{overlay}</Modal>
        )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  return useContext(ConfirmContext);
}

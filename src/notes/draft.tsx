import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { PenLine, X } from 'lucide-react-native';
import { EDA } from '@/src/ui/editorial';
import type { NoteRange } from '@/src/api/practitioner';

// A note being written, held above the screen that is writing it.
//
// The care app lets a session note be MINIMISED: it collapses to a pill and you
// carry on, then pick it up where you left it. That only works if the draft
// outlives the screen, so it lives here rather than in the editor's state — the
// editor is a view onto this, not the owner of it.
export interface NoteDraft {
  appointmentId: string;
  memberId: string;
  who: string;
  when: string;
  title: string;
  text: string;
  ranges: NoteRange[];
  noteType: string;
}

interface DraftContext {
  draft: NoteDraft | null;
  minimized: boolean;
  open: (d: NoteDraft) => void;
  update: (patch: Partial<NoteDraft>) => void;
  minimize: () => void;
  restore: () => void;
  discard: () => void;
}

const Ctx = createContext<DraftContext | null>(null);

export function NoteDraftProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<NoteDraft | null>(null);
  const [minimized, setMinimized] = useState(false);

  const open = useCallback((d: NoteDraft) => { setDraft(d); setMinimized(false); }, []);
  const update = useCallback((patch: Partial<NoteDraft>) => setDraft((cur) => (cur ? { ...cur, ...patch } : cur)), []);
  const minimize = useCallback(() => setMinimized(true), []);
  const restore = useCallback(() => setMinimized(false), []);
  const discard = useCallback(() => { setDraft(null); setMinimized(false); }, []);

  const value = useMemo(
    () => ({ draft, minimized, open, update, minimize, restore, discard }),
    [draft, minimized, open, update, minimize, restore, discard],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      <MinimizedNote />
    </Ctx.Provider>
  );
}

export function useNoteDraft(): DraftContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useNoteDraft must be used inside NoteDraftProvider');
  return ctx;
}

/** The minimised note: a pill that sits above the tab bar until it is picked up
 *  again. Deliberately small and always reachable — a draft you cannot see is a
 *  draft you will lose. */
function MinimizedNote() {
  const router = useRouter();
  const ctx = useContext(Ctx);
  if (!ctx?.draft || !ctx.minimized) return null;
  const { draft, restore, discard } = ctx;
  const preview = draft.title.trim() || draft.text.trim().split('\n')[0] || draft.who;

  return (
    <View style={{ position: 'absolute', left: 22, right: 22, bottom: 104 }}>
      <Pressable
        onPress={() => { restore(); router.navigate('/(practitioner)/note' as never); }}
        style={{
          flexDirection: 'row', alignItems: 'center', gap: 10,
          backgroundColor: EDA.slot, borderRadius: 26, paddingVertical: 12, paddingHorizontal: 16,
          shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 16, shadowOffset: { width: 0, height: 4 }, elevation: 8,
        }}
      >
        <PenLine size={16} color="#fff" strokeWidth={2.2} />
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={{ fontSize: 13.5, fontWeight: '700', color: '#fff' }}>{preview}</Text>
          <Text style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.7)' }}>{draft.who}</Text>
        </View>
        <Pressable onPress={discard} hitSlop={10} accessibilityLabel="Discard draft">
          <X size={16} color="rgba(255,255,255,0.7)" />
        </Pressable>
      </Pressable>
    </View>
  );
}

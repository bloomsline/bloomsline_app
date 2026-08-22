import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { PenLine, X } from 'lucide-react-native';
import { saveNoteDraft, discardNoteDraft, type NoteRange } from '@/src/api/practitioner';
import { useTheme } from '@/src/ui/theme-mode';

// A note being written, held above the screen that is writing it.
//
// The care app lets a session note be MINIMISED: it collapses to a pill and you
// carry on, then pick it up where you left it. That only works if the draft
// outlives the screen, so it lives here rather than in the editor's state — the
// editor is a view onto this, not the owner of it.
//
// It is also KEPT ON THE SERVER, debounced, in the same `note_draft` table the
// care app writes to. In-memory alone survived navigation and nothing else: a
// backgrounded app that iOS reclaims takes the note with it, and a practitioner
// reported losing twenty minutes of intake writing to exactly that class of
// loss. Sharing the table also means a note begun on a laptop and finished on a
// phone is one piece of writing rather than two that fork.
//
// Saving the real note deletes the draft server-side, so `settle()` stops this
// from writing it back afterwards.
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

export type DraftStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

interface DraftContext {
  draft: NoteDraft | null;
  minimized: boolean;
  status: DraftStatus;
  /** When the draft was last kept, ISO. Null when nothing is stored. */
  savedAt: string | null;
  open: (d: NoteDraft) => void;
  update: (patch: Partial<NoteDraft>) => void;
  minimize: () => void;
  restore: () => void;
  /** Write anything outstanding now. False means it did not land. */
  flush: () => Promise<boolean>;
  /** The real note is saved; stop writing the draft. */
  settle: () => void;
  /** Throw the unfinished note away, here and on the server. */
  discard: () => Promise<void>;
}

const DEBOUNCE_MS = 1500;

const Ctx = createContext<DraftContext | null>(null);

export function NoteDraftProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<NoteDraft | null>(null);
  const [minimized, setMinimized] = useState(false);
  const [status, setStatus] = useState<DraftStatus>('idle');
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<{ appointmentId: string; text: string } | null>(null);
  // A slow write must not report state after a newer one has landed.
  const seq = useRef(0);
  // Set once the note itself is saved; late writes must not recreate the draft
  // the server has just deleted.
  const settled = useRef(false);

  const write = useCallback(async (appointmentId: string, text: string) => {
    if (settled.current) return true;
    const mine = ++seq.current;
    setStatus('saving');
    const res = await saveNoteDraft(appointmentId, text);
    if (mine !== seq.current || settled.current) return res.ok;
    if (!res.ok) { setStatus('error'); return false; }
    setSavedAt(res.savedAt ?? null);
    setStatus('saved');
    return true;
  }, []);

  const schedule = useCallback((appointmentId: string, text: string) => {
    if (settled.current) return;
    pending.current = { appointmentId, text };
    setStatus('dirty');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      const p = pending.current;
      pending.current = null;
      if (p) void write(p.appointmentId, p.text);
    }, DEBOUNCE_MS);
  }, [write]);

  const flush = useCallback(async (): Promise<boolean> => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    const p = pending.current;
    pending.current = null;
    if (!p || settled.current) return true;
    return write(p.appointmentId, p.text);
  }, [write]);

  const open = useCallback((d: NoteDraft) => {
    settled.current = false;
    seq.current++;
    pending.current = null;
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    setSavedAt(null);
    setStatus('idle');
    setDraft(d);
    setMinimized(false);
  }, []);

  const update = useCallback((patch: Partial<NoteDraft>) => {
    setDraft((cur) => {
      if (!cur) return cur;
      const next = { ...cur, ...patch };
      // Only the writing is kept; retitling or retagging is not worth a request.
      if (patch.text !== undefined && patch.text !== cur.text) schedule(next.appointmentId, next.text);
      return next;
    });
  }, [schedule]);

  const minimize = useCallback(() => { setMinimized(true); void flush(); }, [flush]);
  const restore = useCallback(() => setMinimized(false), []);

  const settle = useCallback(() => {
    settled.current = true;
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    pending.current = null;
    setDraft(null);
    setMinimized(false);
    setSavedAt(null);
    setStatus('idle');
  }, []);

  const discard = useCallback(async () => {
    settled.current = true;
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    pending.current = null;
    const id = draft?.appointmentId;
    setDraft(null);
    setMinimized(false);
    setSavedAt(null);
    setStatus('idle');
    if (id) await discardNoteDraft(id);
  }, [draft]);

  // Backgrounding is the phone's version of closing the window, and the point
  // at which the OS may reclaim the app without warning. Write before that.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'active') void flush();
    });
    return () => sub.remove();
  }, [flush]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const value = useMemo(
    () => ({ draft, minimized, status, savedAt, open, update, minimize, restore, flush, settle, discard }),
    [draft, minimized, status, savedAt, open, update, minimize, restore, flush, settle, discard],
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
  const { t: TT } = useTheme();
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
          backgroundColor: TT.ctaBg, borderRadius: 26, paddingVertical: 12, paddingHorizontal: 16,
          shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 16, shadowOffset: { width: 0, height: 4 }, elevation: 8,
        }}
      >
        <PenLine size={16} color={TT.ctaFg} strokeWidth={2.2} />
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

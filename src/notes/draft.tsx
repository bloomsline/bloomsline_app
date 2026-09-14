import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { PenLine, X } from 'lucide-react-native';
import { saveNoteDraft, discardNoteDraft, fetchNoteDraft, type NoteRange } from '@/src/api/practitioner';
import { useConfirm } from '@/src/ui/confirm';
import { notify } from '@/src/ui/alert';
import { useI18n } from '@/src/i18n';
import { useTheme } from '@/src/ui/theme-mode';
import { onCta } from '@/src/ui/tokens';
import { clearUnsent, readUnsent, saveUnsent } from '@/src/unsent';

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
  /**
   * The note has formatting only the web can write (headings, numbered lists,
   * links). The phone then ADDS to it instead of rewriting it: `html` is the note
   * as stored, shown as it is, `updatedAt` when it was written, and `text` /
   * `ranges` are only what is being added. Rewriting it here flattened that
   * formatting for good.
   */
  appendTo?: { html: string; updatedAt: string | null };
  /** A web-formatted note opened for full editing (a server too old to send the
   *  note as stored): the editor warns that saving a change simplifies it. */
  simplified?: boolean;
}

export type DraftStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'local' | 'error';

/** Why a session's note could not be opened. */
export type OpenFailure = 'unsaved' | 'load';

interface DraftContext {
  draft: NoteDraft | null;
  minimized: boolean;
  status: DraftStatus;
  /** When the draft was last kept, ISO. Null when nothing is stored. */
  savedAt: string | null;
  /**
   * Open the note for a session WITH what it already has — the saved note or a
   * newer draft. The only way in: opening with an empty text and saving was how
   * a session's existing note got replaced by one line.
   */
  openForSession: (base: Omit<NoteDraft, 'title' | 'text' | 'ranges' | 'appendTo' | 'simplified'>) => Promise<{ ok: true } | { ok: false; reason: OpenFailure }>;
  /**
   * The session was closed with a comment, which the server added to the note
   * and to its draft. The note in hand gets it too: otherwise its next autosave
   * writes the draft back without it, and saving that replaces the note.
   */
  appendText: (appointmentId: string, text: string) => void;
  update: (patch: Partial<NoteDraft>) => void;
  minimize: () => void;
  restore: () => void;
  /** Write anything outstanding now. False means it did not land. */
  flush: () => Promise<boolean>;
  /** The real note is saved; stop writing the draft. */
  settle: () => void;
  /** Throw the unfinished note away, here and on the server. False: the server
   *  still has it. */
  discard: () => Promise<boolean>;
}

const DEBOUNCE_MS = 1500;
/** A draft that did not land is tried again on its own after this long. */
const RETRY_MS = 8000;

type Snapshot = { appointmentId: string; text: string; title: string; ranges: NoteRange[]; append?: boolean };

const Ctx = createContext<DraftContext | null>(null);

export function NoteDraftProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<NoteDraft | null>(null);
  const [minimized, setMinimized] = useState(false);
  const [status, setStatus] = useState<DraftStatus>('idle');
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const draftRef = useRef<NoteDraft | null>(null);
  useEffect(() => { draftRef.current = draft; }, [draft]);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /**
   * The newest writing not yet on the server. It stays here UNTIL a write of it
   * succeeds. It used to be cleared the moment a write started, so a write that
   * failed left nothing pending: Close then "flushed" nothing, reported success
   * and left, and the words existed only in memory.
   */
  const pending = useRef<Snapshot | null>(null);
  // Writes run one after another; a flush waits for the one in flight.
  const chain = useRef<Promise<boolean>>(Promise.resolve(true));
  // A slow write must not report state after a newer one has landed.
  const seq = useRef(0);
  // Set once the note itself is saved; late writes must not recreate the draft
  // the server has just deleted.
  const settled = useRef(false);
  // The retry timer calls the queue through this, so the write does not have to
  // close over a function declared after it.
  const runRef = useRef<() => Promise<boolean>>(() => Promise.resolve(true));

  const clearTimers = () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    if (retryTimer.current) { clearTimeout(retryTimer.current); retryTimer.current = null; }
  };

  const writePending = useCallback(async (): Promise<boolean> => {
    const snap = pending.current;
    if (!snap || settled.current) return true;
    const mine = ++seq.current;
    setStatus('saving');
    // A copy on the phone first, so a note survives the app being killed before
    // the server has it (see src/unsent). Removed once nothing newer is waiting.
    await saveUnsent('note', snap.appointmentId, snap);
    // An addition to a web-formatted note is kept on this phone only. The shared
    // draft holds a WHOLE note, and an addition stored there would open on the web
    // as the entire note, and replace it when saved.
    if (snap.append) {
      if (pending.current === snap) pending.current = null;
      if (mine === seq.current) setStatus('local');
      return true;
    }
    const res = await saveNoteDraft(snap.appointmentId, snap);
    if (settled.current) return res.ok;
    if (res.ok) {
      if (pending.current === snap) { pending.current = null; void clearUnsent('note', snap.appointmentId); }
      if (mine === seq.current) {
        setSavedAt(res.savedAt ?? null);
        setStatus(pending.current ? 'dirty' : 'saved');
      }
      return true;
    }
    if (mine === seq.current) setStatus('error');
    if (!retryTimer.current) {
      retryTimer.current = setTimeout(() => { retryTimer.current = null; void runRef.current(); }, RETRY_MS);
    }
    return false;
  }, []);

  const run = useCallback((): Promise<boolean> => {
    const next = chain.current.then(writePending, writePending);
    chain.current = next;
    return next;
  }, [writePending]);
  runRef.current = run;

  const schedule = useCallback((snap: Snapshot) => {
    if (settled.current) return;
    pending.current = snap;
    setStatus('dirty');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { timer.current = null; void run(); }, DEBOUNCE_MS);
  }, [run]);

  const flush = useCallback(async (): Promise<boolean> => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    if (settled.current) return true;
    return run();
  }, [run]);

  const open = useCallback((d: NoteDraft) => {
    settled.current = false;
    seq.current++;
    pending.current = null;
    clearTimers();
    setSavedAt(null);
    setStatus('idle');
    setDraft(d);
    draftRef.current = d;
    setMinimized(false);
  }, []);

  const openForSession = useCallback<DraftContext['openForSession']>(async (base) => {
    const cur = draftRef.current;
    // Already the note in hand (open, or minimised to the pill): what is in
    // memory is newer than anything the server has.
    if (cur && cur.appointmentId === base.appointmentId) {
      setMinimized(false);
      return { ok: true };
    }
    // Another session's note is in progress. It is written first, and if that
    // cannot happen it is not replaced: opening a second note used to throw away
    // the last second and a half of the first.
    if (cur && !settled.current && !(await flush())) return { ok: false, reason: 'unsaved' };
    const [kept, existing] = await Promise.all([readUnsent<Snapshot>('note', base.appointmentId), fetchNoteDraft(base.appointmentId)]);
    // Writing kept on this phone that never reached the server opens, and is sent
    // again, when it is newer than what the server has. It used to win whatever
    // its age, so a copy stranded for a week replaced the note written on the web
    // since. Offline, with nothing to compare, it is the only writing there is.
    // A web-formatted note opens as an addition, with any addition kept here.
    if (existing?.simplified && existing.html !== undefined && !(kept?.payload && !kept.payload.append && existing.updatedAt && kept.savedAt > existing.updatedAt)) {
      const addition = kept?.payload?.append ? { text: kept.payload.text ?? '', ranges: kept.payload.ranges ?? [] } : { text: '', ranges: [] };
      if (kept && !kept.payload?.append) void clearUnsent('note', base.appointmentId);
      open({ ...base, title: '', text: addition.text, ranges: addition.ranges, appendTo: { html: existing.html, updatedAt: existing.updatedAt } });
      if (addition.text) setStatus('local');
      return { ok: true };
    }
    if (kept?.payload?.append) {
      // An addition kept here, but the note it adds to could not be read: it
      // stays on the phone, and the note does not open blank.
      if (!existing) return { ok: false, reason: 'load' };
      void clearUnsent('note', base.appointmentId);
    }
    if (kept?.payload && !kept.payload.append && (!existing || !existing.updatedAt || kept.savedAt > existing.updatedAt)) {
      const payload = withTitleInText(kept.payload);
      open({ ...base, title: '', text: payload.text, ranges: payload.ranges });
      schedule({ appointmentId: base.appointmentId, text: payload.text, title: '', ranges: payload.ranges });
      return { ok: true };
    }
    if (kept) void clearUnsent('note', base.appointmentId);
    // Not knowing what the note says is not the same as it being empty. Opening
    // blank here and saving would replace the real note.
    if (!existing) return { ok: false, reason: 'load' };
    open({ ...base, title: '', text: existing.content, ranges: existing.ranges, simplified: existing.simplified });
    if (existing.draftAt) { setSavedAt(existing.draftAt); setStatus('saved'); }
    return { ok: true };
  }, [flush, open, schedule]);

  const update = useCallback((patch: Partial<NoteDraft>) => {
    setDraft((cur) => {
      if (!cur) return cur;
      const next = { ...cur, ...patch };
      // The title and the marks are part of the note, so they are kept too — a
      // tag laid on a sentence is work, and it was lost with every restore.
      const changed =
        (patch.text !== undefined && patch.text !== cur.text) ||
        (patch.title !== undefined && patch.title !== cur.title) ||
        (patch.ranges !== undefined && patch.ranges !== cur.ranges);
      if (changed) schedule({ appointmentId: next.appointmentId, text: next.text, title: next.title, ranges: next.ranges, append: !!next.appendTo });
      draftRef.current = next;
      return next;
    });
  }, [schedule]);

  const appendText = useCallback((appointmentId: string, extra: string) => {
    const cur = draftRef.current;
    const add = extra.trim();
    if (!cur || cur.appointmentId !== appointmentId || !add || settled.current) return;
    // Adding to a web-formatted note: the comment is already in the stored note,
    // so the note shown is refreshed rather than the addition changed.
    if (cur.appendTo) {
      void fetchNoteDraft(appointmentId).then((fresh) => {
        const now = draftRef.current;
        if (!fresh || fresh.html === undefined || !now || now.appointmentId !== appointmentId || !now.appendTo) return;
        const next = { ...now, appendTo: { html: fresh.html, updatedAt: fresh.updatedAt } };
        draftRef.current = next;
        setDraft(next);
      });
      return;
    }
    const kept = cur.text.replace(/\s+$/, '');
    // Appended after the end, so no mark moves; marks reaching into the trimmed
    // trailing space are clipped to the text.
    update({
      text: kept ? `${kept}\n\n${add}` : add,
      ranges: cur.ranges.map((r) => ({ ...r, end: Math.min(r.end, kept.length) })).filter((r) => r.end > r.start),
    });
  }, [update]);

  const minimize = useCallback(() => { setMinimized(true); void flush(); }, [flush]);
  const restore = useCallback(() => setMinimized(false), []);

  const settle = useCallback(() => {
    settled.current = true;
    const saved = draftRef.current?.appointmentId;
    if (saved) void clearUnsent('note', saved);
    clearTimers();
    pending.current = null;
    setDraft(null);
    draftRef.current = null;
    setMinimized(false);
    setSavedAt(null);
    setStatus('idle');
  }, []);

  const discard = useCallback(async (): Promise<boolean> => {
    settled.current = true;
    clearTimers();
    pending.current = null;
    const id = draftRef.current?.appointmentId;
    const localOnly = !!draftRef.current?.appendTo;
    setDraft(null);
    draftRef.current = null;
    setMinimized(false);
    setSavedAt(null);
    setStatus('idle');
    if (!id) return true;
    void clearUnsent('note', id);
    // An addition was never on the server; the draft there (if any) is the web's.
    if (localOnly) return true;
    return (await discardNoteDraft(id)).ok;
  }, []);

  // Backgrounding is the phone's version of closing the window, and the point
  // at which the OS may reclaim the app without warning. Write before that.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'active') void flush();
    });
    return () => sub.remove();
  }, [flush]);

  useEffect(() => () => clearTimers(), []);

  const value = useMemo(
    () => ({ draft, minimized, status, savedAt, openForSession, appendText, update, minimize, restore, flush, settle, discard }),
    [draft, minimized, status, savedAt, openForSession, appendText, update, minimize, restore, flush, settle, discard],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      <MinimizedNote />
    </Ctx.Provider>
  );
}

/**
 * The session note has no title: the web never had one, and a title typed here
 * came back as a bold first line with the field empty. The field is gone; a copy
 * kept from a build that had it puts the title where the note shows it.
 */
function withTitleInText(p: Partial<Snapshot>): { text: string; ranges: NoteRange[] } {
  const text = p.text ?? '';
  const ranges = p.ranges ?? [];
  const title = (p.title ?? '').trim();
  if (!title) return { text, ranges };
  const shift = title.length + 2;
  return {
    text: text ? `${title}\n\n${text}` : title,
    ranges: [{ start: 0, end: title.length, type: 'bold' }, ...ranges.map((r) => ({ ...r, start: r.start + shift, end: r.end + shift }))],
  };
}

export function useNoteDraft(): DraftContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useNoteDraft must be used inside NoteDraftProvider');
  return ctx;
}

const PILL_T = {
  en: { discard: 'Discard draft', title: 'Discard this draft?', body: 'What you have written here will be deleted. This cannot be undone.', yes: 'Discard', no: 'Keep it', failed: 'Could not delete the draft. Check your connection.' },
  fr: { discard: 'Supprimer le brouillon', title: 'Supprimer ce brouillon ?', body: 'Ce que vous avez écrit ici sera supprimé. Cette action est irréversible.', yes: 'Supprimer', no: 'Le conserver', failed: 'Impossible de supprimer le brouillon. Vérifiez votre connexion.' },
} as const;

/** The minimised note: a pill that sits above the tab bar until it is picked up
 *  again. Deliberately small and always reachable — a draft you cannot see is a
 *  draft you will lose. */
function MinimizedNote() {
  const { t: TT, mode } = useTheme();
  const router = useRouter();
  const confirm = useConfirm();
  const { locale } = useI18n();
  const tr = PILL_T[locale] ?? PILL_T.en;
  const ctx = useContext(Ctx);
  if (!ctx?.draft || !ctx.minimized) return null;
  const { draft, restore, discard } = ctx;
  const preview = draft.text.trim().split('\n')[0] || draft.who;

  // The X sits inside the pill with a generous hit area, so a tap meant for the
  // pill can land on it. Deleting writing is the one thing here that asks.
  const askDiscard = async () => {
    const yes = await confirm({ title: tr.title, message: tr.body, confirmLabel: tr.yes, cancelLabel: tr.no, destructive: true });
    if (!yes) return;
    if (!(await discard())) notify(tr.discard, tr.failed);
  };

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
          <Text numberOfLines={1} style={{ fontSize: 13.5, fontWeight: '700', color: TT.ctaFg }}>{preview}</Text>
          <Text style={{ fontSize: 11.5, color: onCta(mode, 0.7) }}>{draft.who}</Text>
        </View>
        <Pressable onPress={() => { void askDiscard(); }} hitSlop={10} accessibilityLabel={tr.discard}>
          <X size={16} color={onCta(mode, 0.7)} />
        </Pressable>
      </Pressable>
    </View>
  );
}

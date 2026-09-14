// Which of their practitioners a patient is looking at.
//
// A patient can be linked to more than one practitioner, and switching between
// them works like switching profiles: My Care, booking, past sessions, to-dos,
// documents, the library, articles and sharing are all about the one selected.
// The server does the scoping (it reads `x-bl-practitioner`, see
// current-practitioner); this provider decides what that header says, remembers
// the choice on the phone, and gives screens a `selectionKey` to reload on.
//
// With one practitioner nothing here is visible and no header is sent: the
// server's own fallback is the first link, which is that one practitioner, so
// naming them adds a request header and nothing else.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useAuth } from '@/src/auth/auth-context';
import { fetchMe, type LinkedPractitioner } from '@/src/api/me';
import { storageGet, storageSet } from '@/src/storage';
import { clearPractitionerFace } from '@/src/care/practitioner-face';
import { SELECTED_PRACTITIONER_KEY, clearSelectedPractitioner, getCurrentPractitionerId, setCurrentPractitionerId } from '@/src/care/current-practitioner';

export type { LinkedPractitioner };

interface SelectedPractitionerValue {
  /** Everyone linked, in link order. Empty on an older server, or before `/me`. */
  practitioners: LinkedPractitioner[];
  selected: LinkedPractitioner | null;
  selectedId: string | null;
  /** Put it in the deps of anything that loads practitioner-scoped data. '' when
   *  there is nothing to choose between, so a single-link patient never reloads. */
  selectionKey: string;
  /** True when there is a real choice to offer (two or more links). */
  canSwitch: boolean;
  /** Switch now. Every request after this call names the new practitioner. */
  select: (id: string) => void;
  /** The list has been asked for at least once this session (answered or not). */
  ready: boolean;
  /** Ask `/me` again, e.g. after something that may have added a link. */
  refresh: () => Promise<void>;
}

const Ctx = createContext<SelectedPractitionerValue | null>(null);

/** What is written on the device: the id, and whose choice it was. The account
 *  check is belt and braces: sign-out already clears this key, but a choice
 *  must never be carried from one person's links to another's. */
interface Stored { id: string; account: string | null }

function parseStored(raw: string | null): Stored | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<Stored>;
    return typeof v?.id === 'string' ? { id: v.id, account: typeof v.account === 'string' ? v.account : null } : null;
  } catch {
    return null;
  }
}

/** The header only matters when there is a choice. See the note at the top. */
const headerFor = (list: LinkedPractitioner[], id: string | null): string | null => (list.length > 1 ? id : null);

export function SelectedPractitionerProvider({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const [practitioners, setPractitioners] = useState<LinkedPractitioner[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  // Mirrors for the async paths below, which must see the latest values rather
  // than whatever the closure was created with.
  const selectedRef = useRef<string | null>(null);
  const accountRef = useRef<string | null>(null);
  const storedRef = useRef<Stored | null>(null);
  const patient = status === 'authed' || status === 'onboarding';

  /** Apply a selection everywhere, header first. */
  const apply = useCallback((list: LinkedPractitioner[], id: string | null) => {
    const header = headerFor(list, id);
    // Compared by header, not by id: the first `/me` of a launch confirming the
    // remembered choice changes nothing the server sees, and must not make
    // every avatar on screen fetch again.
    const changed = getCurrentPractitionerId() !== header;
    setCurrentPractitionerId(header);
    selectedRef.current = id;
    // The cached face belongs to whoever was selected. Cleared before the
    // state change, so no avatar redraws with the old picture under a new name.
    if (changed) clearPractitionerFace(true);
    setPractitioners(list);
    setSelectedId(id);
  }, []);

  const refresh = useCallback(async () => {
    const me = await fetchMe();
    // No answer is not "no practitioners". Keep what we have: a dropped
    // connection on returning to the app must not hide the switcher, or worse,
    // quietly move someone back to their first practitioner.
    if (!me) { setReady(true); return; }
    if (me.role === 'practitioner' || !me.practitioners) {
      // A practitioner account, or a server from before the switcher: nothing
      // to choose, nothing to send.
      apply([], null);
      setReady(true);
      return;
    }
    accountRef.current = me.email;
    const list = me.practitioners;
    const stored = storedRef.current;
    const storedFits = stored && (!stored.account || !me.email || stored.account === me.email);
    // Keep the current choice, else the remembered one, else the first link.
    // Not the server's `selectedPractitionerId` first: that is only an echo of
    // the header we sent, and before hydration we may have sent none.
    const pick = [selectedRef.current, storedFits ? stored.id : null].find((id) => id && list.some((p) => p.id === id))
      ?? list[0]?.id
      ?? null;
    apply(list, pick);
    setReady(true);
  }, [apply]);

  // Read the remembered choice as early as possible, and point the header at
  // it straight away. The first screens fetch as soon as the session resolves;
  // waiting for `/me` here too would send those requests to the server's
  // fallback and then reload every screen a moment later. An id that turns out
  // not to be linked any more is harmless: the server refuses it, falls back,
  // and `refresh` corrects it.
  useEffect(() => {
    let alive = true;
    void storageGet(SELECTED_PRACTITIONER_KEY).then((raw) => {
      if (!alive) return;
      const stored = parseStored(raw);
      storedRef.current = stored;
      if (stored && !selectedRef.current) setCurrentPractitionerId(stored.id);
    });
    return () => { alive = false; };
  }, []);

  // Signed in as a patient (including a fresh sign-in, which passes through
  // `loading`): ask who they are linked to. Signed out: forget it all, so the
  // next account starts from nothing.
  useEffect(() => {
    if (status === 'anon' || status === 'loading') {
      selectedRef.current = null;
      storedRef.current = null;
      accountRef.current = null;
      setPractitioners([]);
      setSelectedId(null);
      setReady(false);
      if (status === 'anon') void clearSelectedPractitioner();
      return;
    }
    if (!patient) { setReady(true); return; }
    // A fresh sign-in cleared the key (forget-account) before we got here, so
    // read it again rather than trusting what the mount read.
    void storageGet(SELECTED_PRACTITIONER_KEY).then((raw) => {
      storedRef.current = parseStored(raw);
      return refresh();
    });
  }, [status, patient, refresh]);

  // Back to the foreground: a practitioner may have linked this patient while
  // the app sat in the background, and they should appear without a relaunch.
  useEffect(() => {
    if (!patient) return;
    const sub = AppState.addEventListener('change', (st) => { if (st === 'active') void refresh(); });
    return () => sub.remove();
  }, [patient, refresh]);

  const select = useCallback((id: string) => {
    if (!practitioners.some((p) => p.id === id) || id === selectedRef.current) return;
    apply(practitioners, id);
    const stored: Stored = { id, account: accountRef.current };
    storedRef.current = stored;
    void storageSet(SELECTED_PRACTITIONER_KEY, JSON.stringify(stored));
  }, [practitioners, apply]);

  const value = useMemo<SelectedPractitionerValue>(() => {
    const selected = practitioners.find((p) => p.id === selectedId) ?? null;
    const canSwitch = practitioners.length > 1;
    return {
      practitioners,
      selected,
      selectedId,
      selectionKey: canSwitch && selectedId ? selectedId : '',
      canSwitch,
      select,
      ready,
      refresh,
    };
  }, [practitioners, selectedId, select, ready, refresh]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

const NONE: SelectedPractitionerValue = {
  practitioners: [],
  selected: null,
  selectedId: null,
  selectionKey: '',
  canSwitch: false,
  select: () => {},
  ready: true,
  refresh: async () => {},
};

/**
 * For a screen that shows practitioner-scoped data: `reset` runs (in render,
 * before anything is drawn) when the selection changes, and the key comes back
 * to put in the deps of the screen's load.
 *
 * Reset and not only reload, because every one of these screens keeps what it
 * has when a refetch fails, which is right for a weak connection and wrong for
 * a switch: a failed read after switching left the previous practitioner's
 * documents on screen under the new one. Emptying first shows the loading
 * state instead, then the new practitioner's list.
 */
export function useSelectionReset(reset: () => void): string {
  const { selectionKey } = useSelectedPractitioner();
  const [seen, setSeen] = useState(selectionKey);
  if (seen !== selectionKey) {
    setSeen(selectionKey);
    reset();
  }
  return selectionKey;
}

/**
 * The selection. Outside the provider (the practitioner app's screens, a test
 * route) it answers "one practitioner, nothing to switch" rather than throwing:
 * shared components such as the avatar read it, and they are drawn in places
 * that have no patient at all.
 */
export function useSelectedPractitioner(): SelectedPractitionerValue {
  return useContext(Ctx) ?? NONE;
}

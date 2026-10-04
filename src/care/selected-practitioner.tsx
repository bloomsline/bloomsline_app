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
import { SELECTED_PRACTITIONER_KEY, clearSelectedPractitioner, getCurrentPractitionerId, getCurrentLinkId, setCurrentPractitionerId, setCurrentLinkId } from '@/src/care/current-practitioner';
import { profilesFrom, headersFor, shapeOf, type AppShape, type CareProfile } from '@/src/care/shape';
import { takeNextProfile } from '@/src/auth/family-invite';

export type { LinkedPractitioner };

interface SelectedPractitionerValue {
  /** Everyone linked as this person's OWN practitioner, in link order. Empty on
   *  an older server, or before `/me`. Never lists a child's practitioner. */
  practitioners: LinkedPractitioner[];
  /** The practitioner of the profile on screen. */
  selected: LinkedPractitioner | null;
  /** That practitioner's id (share readers compare against it). */
  selectedId: string | null;
  /** Every care profile: this person's own care, then each child's as their
   *  guardian (guardian plan, phase 6). What the switcher lists. */
  profiles: CareProfile[];
  selectedProfile: CareProfile | null;
  /** What the app offers for the profile on screen (see `shape.ts`). */
  shape: AppShape;
  /** Put it in the deps of anything that loads practitioner-scoped data. '' when
   *  there is nothing to choose between, so a single-link patient never reloads. */
  selectionKey: string;
  /** True when there is a real choice to offer (two or more profiles). */
  canSwitch: boolean;
  /** Switch now, by profile key or by practitioner id (the patient's own care
   *  with them). Every request after this call names the new choice. */
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
interface Stored { id: string; account: string | null; /** A child's chart (guardian view). */ link?: boolean }

function parseStored(raw: string | null): Stored | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<Stored>;
    return typeof v?.id === 'string' ? { id: v.id, account: typeof v.account === 'string' ? v.account : null, link: v.link === true } : null;
  } catch {
    return null;
  }
}

/** The patient's own practitioners, as the share code and older screens know them. */
const ownPractitioners = (profiles: CareProfile[]): LinkedPractitioner[] =>
  profiles.filter((p) => p.role === 'patient').map((p) => ({ id: p.practitionerId, name: p.practitionerName ?? '', photoUrl: p.photoUrl }));

export function SelectedPractitionerProvider({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const [practitioners, setPractitioners] = useState<LinkedPractitioner[]>([]);
  const [profiles, setProfiles] = useState<CareProfile[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  // Mirrors for the async paths below, which must see the latest values rather
  // than whatever the closure was created with.
  const selectedRef = useRef<string | null>(null);
  const accountRef = useRef<string | null>(null);
  const storedRef = useRef<Stored | null>(null);
  const patient = status === 'authed' || status === 'onboarding';

  /** Apply a selection everywhere, headers first. */
  const apply = useCallback((list: CareProfile[], key: string | null) => {
    const chosen = list.find((p) => p.key === key) ?? null;
    const { practitionerId, linkId } = headersFor(list, chosen);
    // Compared by headers, not by key: the first `/me` of a launch confirming
    // the remembered choice changes nothing the server sees, and must not make
    // every avatar on screen fetch again.
    const changed = getCurrentPractitionerId() !== practitionerId || getCurrentLinkId() !== linkId;
    setCurrentPractitionerId(practitionerId);
    setCurrentLinkId(linkId);
    selectedRef.current = chosen?.key ?? null;
    // The cached face belongs to whoever was selected. Cleared before the
    // state change, so no avatar redraws with the old picture under a new name.
    if (changed) clearPractitionerFace(true);
    setProfiles(list);
    setPractitioners(ownPractitioners(list));
    setSelectedKey(chosen?.key ?? null);
  }, []);

  const refresh = useCallback(async () => {
    const me = await fetchMe();
    // No answer is not "no practitioners". Keep what we have: a dropped
    // connection on returning to the app must not hide the switcher, or worse,
    // quietly move someone back to their first practitioner.
    if (!me) { setReady(true); return; }
    if (me.role === 'practitioner' || (!me.practitioners && !me.links)) {
      // A practitioner account, or a server from before the switcher: nothing
      // to choose, nothing to send.
      apply([], null);
      setReady(true);
      return;
    }
    accountRef.current = me.email;
    const list = profilesFrom(me);
    const stored = storedRef.current;
    const storedFits = stored && (!stored.account || !me.email || stored.account === me.email);
    // A profile can be named by its key, or (remembered before profiles
    // existed) by a practitioner id meaning the patient's own care with them.
    const find = (id: string | null) => (id ? list.find((p) => p.key === id) ?? list.find((p) => p.role === 'patient' && p.practitionerId === id) : undefined);
    // Keep the current choice, else one just accepted (an invitation), else the
    // remembered one, else the first profile. Not the server's echo first: that
    // only reflects the headers we sent, and before hydration we sent none.
    const pick = (find(selectedRef.current) ?? find(takeNextProfile()) ?? (storedFits ? find(stored.id) : undefined) ?? list[0])?.key ?? null;
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
      // Only a practitioner id can be sent before `/me`: a remembered child's
      // chart waits for `/me` to confirm it is still theirs.
      if (stored && !selectedRef.current && !stored.link) setCurrentPractitionerId(stored.id);
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
      setProfiles([]);
      setSelectedKey(null);
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
    const target = profiles.find((p) => p.key === id) ?? profiles.find((p) => p.role === 'patient' && p.practitionerId === id);
    if (!target || target.key === selectedRef.current) return;
    apply(profiles, target.key);
    const stored: Stored = { id: target.key, account: accountRef.current, link: target.role === 'guardian' };
    storedRef.current = stored;
    void storageSet(SELECTED_PRACTITIONER_KEY, JSON.stringify(stored));
  }, [profiles, apply]);

  const value = useMemo<SelectedPractitionerValue>(() => {
    const selectedProfile = profiles.find((p) => p.key === selectedKey) ?? null;
    const selected: LinkedPractitioner | null = selectedProfile
      ? { id: selectedProfile.practitionerId, name: selectedProfile.practitionerName ?? '', photoUrl: selectedProfile.photoUrl }
      : null;
    const canSwitch = profiles.length > 1;
    return {
      practitioners,
      selected,
      selectedId: selected?.id ?? null,
      profiles,
      selectedProfile,
      shape: shapeOf(selectedProfile),
      selectionKey: canSwitch && selectedKey ? selectedKey : '',
      canSwitch,
      select,
      ready,
      refresh,
    };
  }, [practitioners, profiles, selectedKey, select, ready, refresh]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

const NONE: SelectedPractitionerValue = {
  practitioners: [],
  selected: null,
  selectedId: null,
  profiles: [],
  selectedProfile: null,
  shape: 'none',
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

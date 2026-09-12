// The small app preferences that belong to the PERSON, not to the phone.
//
// Two of them: which tab opens the app, and which tab explainers have been
// dismissed. Both used to live in the Keychain, and both were wrong there —
// a reinstall wipes it, so the explainers came back for someone who had
// dismissed them months ago, and a patient who had chosen to land on Moments
// was quietly returned to My Care. Neither reads as a bug; it reads as the app
// forgetting you. They live on the `user` row now (`app_prefs`), the same
// reasoning that already moved `momentsOnboardedAt` off the device.
//
// THE DEVICE COPY REMAINS, as a cache and nothing more. The landing tab decides
// the FIRST redirect after sign-in, and waiting on a request to answer it would
// show a tab and then move it. So the cache answers immediately, the server
// corrects it a moment later, and the correction is written back. Offline, the
// cache is simply the last thing we knew, which is the right answer anyway.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { storageGet, storageSet } from '../storage';
import { fetchMe, saveProfile } from '../api/me';
import { useAuth } from '../auth/auth-context';

export type LandingTab = 'care' | 'moments';

const LANDING_KEY = 'pref.landingTab';
const INTROS_KEY = 'pref.introsSeen';

/** The route each landing tab opens on. */
export const LANDING_HREF: Record<LandingTab, string> = {
  care: '/(app)/home',
  moments: '/(app)/moments',
};

interface AppPrefsValue {
  /** The landing (home) tab — greets here, plain titles elsewhere. */
  landing: LandingTab;
  /** Persist a new choice, on this device and on the account. */
  setLanding: (tab: LandingTab) => void;
  /** True once the cached preference has been read (avoids a routing flash). */
  ready: boolean;
  /**
   * Has this explainer been dismissed? `null` means WE DO NOT KNOW YET, and it
   * is deliberately a third answer: showing an explainer to someone who put it
   * away last year is the complaint this whole module exists to fix, so the
   * card waits rather than guesses.
   */
  introSeen: (key: string) => boolean | null;
  /** Put one away, for good, on every device. */
  dismissIntro: (key: string) => void;
}

const Ctx = createContext<AppPrefsValue | null>(null);

export function AppPrefsProvider({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const [landing, setLandingState] = useState<LandingTab>('care');
  const [ready, setReady] = useState(false);
  const [seen, setSeen] = useState<string[] | null>(null);
  // Set once the account's own answer has arrived. After that a cache read must
  // not overwrite it — the two requests are racing on a cold start.
  const fromServer = useRef(false);

  // 1. The cache, for a first paint that does not move.
  useEffect(() => {
    let alive = true;
    void Promise.all([storageGet(LANDING_KEY), storageGet(INTROS_KEY)]).then(([tab, intros]) => {
      if (!alive) return;
      if (!fromServer.current && (tab === 'care' || tab === 'moments')) setLandingState(tab);
      if (!fromServer.current && intros) {
        try {
          const parsed: unknown = JSON.parse(intros);
          if (Array.isArray(parsed)) setSeen(parsed.filter((k): k is string => typeof k === 'string'));
        } catch {
          // A cache we cannot read is a cache we do not have.
        }
      }
      setReady(true);
    });
    return () => { alive = false; };
  }, []);

  // 2. The account, which is the truth, and which is what survives a reinstall.
  useEffect(() => {
    if (status !== 'authed' && status !== 'onboarding') return;
    let alive = true;
    void fetchMe().then((me) => {
      if (!alive || !me) return;
      fromServer.current = true;
      if (me.landingTab) {
        setLandingState(me.landingTab);
        void storageSet(LANDING_KEY, me.landingTab);
      }
      const list = Array.isArray(me.introsSeen) ? me.introsSeen : [];
      setSeen(list);
      void storageSet(INTROS_KEY, JSON.stringify(list));
      setReady(true);
    });
    return () => { alive = false; };
  }, [status]);

  const setLanding = useCallback((tab: LandingTab) => {
    setLandingState(tab);
    void storageSet(LANDING_KEY, tab);
    // Best effort. A failed write means the next launch on THIS phone is still
    // right, and the account catches up the next time they choose.
    void saveProfile({ landingTab: tab });
  }, []);

  const introSeen = useCallback((key: string) => (seen === null ? null : seen.includes(key)), [seen]);

  const dismissIntro = useCallback((key: string) => {
    setSeen((prev) => {
      const next = prev && prev.includes(key) ? prev : [...(prev ?? []), key];
      void storageSet(INTROS_KEY, JSON.stringify(next));
      return next;
    });
    // Appended server-side, and only once, so a repeat is harmless.
    void saveProfile({ introSeen: key });
  }, []);

  const value = useMemo<AppPrefsValue>(
    () => ({ landing, setLanding, ready, introSeen, dismissIntro }),
    [landing, setLanding, ready, introSeen, dismissIntro],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

function usePrefs(): AppPrefsValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('app preferences used outside <AppPrefsProvider>');
  return v;
}

/** The landing tab and its setter. Named for what callers care about. */
export function useLanding(): Pick<AppPrefsValue, 'landing' | 'setLanding' | 'ready'> {
  const { landing, setLanding, ready } = usePrefs();
  return { landing, setLanding, ready };
}

/** One tab explainer: whether to show it, and how to put it away. */
export function useTabIntro(key: string): { show: boolean; dismiss: () => void } {
  const { introSeen, dismissIntro } = usePrefs();
  return {
    // `null` (not known yet) shows nothing. See `introSeen`.
    show: introSeen(key) === false,
    dismiss: useCallback(() => dismissIntro(key), [dismissIntro, key]),
  };
}

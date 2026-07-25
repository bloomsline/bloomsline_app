// Which app tab the user lands on — and, mirroring v1, where the time-of-day
// greeting ("Good morning, …") is shown. The landing tab is the "home" tab: it
// greets you; every other tab shows its plain title.
//
// v1 stored this per-member (`nav_order`) on the backend; here it's a simple
// device preference persisted through the shared storage seam (Keychain on
// native, localStorage on web). Default = 'care' (My Care), which is already
// where every authed user lands today — so the greeting simply moves onto it.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { storageGet, storageSet } from '../storage';

export type LandingTab = 'care' | 'moments';
const KEY = 'pref.landingTab';

/** The route each landing tab opens on. */
export const LANDING_HREF: Record<LandingTab, string> = {
  care: '/(app)/home',
  moments: '/(app)/moments',
};

interface LandingValue {
  /** The landing (home) tab — greets here, plain titles elsewhere. */
  landing: LandingTab;
  /** Persist a new choice. */
  setLanding: (tab: LandingTab) => void;
  /** True once the stored preference has been read (avoids a routing flash). */
  ready: boolean;
}

const Ctx = createContext<LandingValue | null>(null);

export function LandingProvider({ children }: { children: React.ReactNode }) {
  const [landing, setLandingState] = useState<LandingTab>('care');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    storageGet(KEY).then((v) => {
      if (!alive) return;
      if (v === 'care' || v === 'moments') setLandingState(v);
      setReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  const setLanding = useCallback((tab: LandingTab) => {
    setLandingState(tab);
    void storageSet(KEY, tab); // best-effort persist
  }, []);

  const value = useMemo<LandingValue>(() => ({ landing, setLanding, ready }), [landing, setLanding, ready]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLanding(): LandingValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useLanding must be used within LandingProvider');
  return v;
}

// Analytics, wired into the app exactly once.
//
// It does four things and nothing else:
//   - reads the stored answer and builds the client (silent until opted in);
//   - asks the question, once, and only once someone is actually in the app —
//     not on the sign-in screens, and not during onboarding;
//   - keeps `role` and `locale` on every event so the numbers can be split
//     without describing anyone;
//   - sends screen views, by name, from the router's own path.
//
// The consent state lives in module storage (`consent.ts`), so anything can ask
// whether it may send — including code far from React, like the sign-out path.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { usePathname } from 'expo-router';
import { useAuth } from '@/src/auth/auth-context';
import { useI18n } from '@/src/i18n';
import { analyticsConfigured, applyConsent, flushAnalytics, setSuperProperties, startAnalytics, track, trackScreen } from './client';
import { analyticsAllowed, loadConsent, setConsent, shouldAskConsent, type ConsentState } from './consent';
import { ConsentSheet } from './consent-sheet';

interface AnalyticsValue {
  /** What this device has answered. `unset` until the sheet is answered. */
  consent: ConsentState;
  /** Change the answer — used by the Settings row, and by the sheet. */
  setAnalyticsConsent: (granted: boolean) => void;
  /** Whether analytics exists in this build at all; Settings hides its row
   *  otherwise, rather than offering a switch that does nothing. */
  available: boolean;
}

const Ctx = createContext<AnalyticsValue | null>(null);

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const { locale } = useI18n();
  const [consent, setConsentState] = useState<ConsentState>('unset');
  const [ready, setReady] = useState(false);
  // NOT during onboarding: someone who has just been invited into their
  // therapist's app is reading about privacy and typing their name, and a
  // statistics question there is an interruption at the worst moment. The
  // events from those minutes are not lost — they wait in memory until this is
  // answered (see client.ts).
  const signedIn = status === 'authed' || status === 'practitioner';

  // Read the stored answer, then build the client. In that order: the client
  // decides at construction whether it is opted in, and building it first would
  // leave a window where a granted device is silent.
  useEffect(() => {
    let alive = true;
    void loadConsent().then((state) => {
      if (!alive) return;
      setConsentState(state);
      startAnalytics();
      setReady(true);
    });
    return () => { alive = false; };
  }, []);

  // Who this is, in the only two senses analytics is allowed to know: which
  // side of the app they are using, and which language they read it in.
  useEffect(() => {
    setSuperProperties({ role: status === 'practitioner' ? 'practitioner' : 'patient', locale });
  }, [status, locale]);

  // Screen views. `usePathname` gives the router's path, which `screenName`
  // strips of ids and invite tokens before it is sent.
  const pathname = usePathname();
  useEffect(() => {
    if (!ready || !analyticsAllowed()) return;
    trackScreen(pathname);
  }, [pathname, ready, consent]);

  const answer = useCallback((granted: boolean) => {
    setConsentState(granted ? 'granted' : 'refused');
    void setConsent(granted ? 'granted' : 'refused');
    applyConsent(granted);
    if (granted) {
      // Recorded on the way in only. A refusal cannot be recorded, because a
      // refusal means nothing is sent.
      track('analytics_consent_granted');
      flushAnalytics();
    }
  }, []);

  const value = useMemo<AnalyticsValue>(
    () => ({ consent, setAnalyticsConsent: answer, available: analyticsConfigured() }),
    [consent, answer],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      <ConsentSheet
        visible={ready && signedIn && analyticsConfigured() && shouldAskConsent() && consent === 'unset'}
        onAnswer={answer}
      />
    </Ctx.Provider>
  );
}

export function useAnalytics(): AnalyticsValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAnalytics must be used within AnalyticsProvider');
  return v;
}

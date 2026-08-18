// App-wide auth/session state + operations. One sign-in, then the account's
// ROLE decides the app:
//   anon         — no tokens; show welcome/sign-up
//   practitioner — a practitioner account; show the practitioner app
//   onboarding   — a patient who hasn't finished the first-run signup flow
//   authed       — an onboarded patient; show the patient app
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getRefreshToken, clearTokens, saveTokens } from './token-store';
import { apiFetch, postJson, setOnSignOut } from './api';
import { storageGet, storageSet, storageDelete } from '../storage';
import { saveProfile, fetchMe } from '../api/me';
import { MOCK_AUTH, MOCK_ROLE } from '../config';

const mockPair = () => ({ accessToken: 'mock-access', refreshToken: `mock-refresh-${Date.now()}`, expiresIn: 900 });

type Status = 'loading' | 'anon' | 'practitioner' | 'onboarding' | 'authed';
const ONBOARDED_KEY = 'bl_onboarded';

interface AuthValue {
  status: Status;
  /** Email a sign-in link. Returns the link in dev (DEV_AUTH) so it can be opened; null otherwise. */
  startEmailSignIn: (email: string, locale?: 'en' | 'fr') => Promise<string | null>;
  /**
   * Exchange a token from an emailed sign-in link for a session. On failure the
   * server's own message comes back, because "expired link" and "you're on the
   * waitlist" are different things to be told and only the server knows which.
   */
  signInWithLink: (token: string) => Promise<{ ok: true } | { ok: false; message?: string }>;
  signInWithGoogleIdToken: (idToken: string) => Promise<boolean>;
  signInWithMicrosoftIdToken: (idToken: string) => Promise<boolean>;
  /** Dev-only mock sign-in (EXPO_PUBLIC_MOCK_AUTH) → enters onboarding, no backend. */
  devSignIn: () => Promise<void>;
  /** Mark the first-run signup flow complete → move to the app. */
  completeOnboarding: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');

  const signOut = useCallback(async () => {
    const refreshToken = await getRefreshToken();
    if (refreshToken) postJson('/api/mobile/auth/logout', { refreshToken }).catch(() => {});
    await Promise.all([clearTokens(), storageDelete(ONBOARDED_KEY)]);
    setStatus('anon');
  }, []);

  useEffect(() => {
    setOnSignOut(() => setStatus('anon'));
    return () => setOnSignOut(null);
  }, []);

  // Resolve which app to show after we have a token: fetch the account's role +
  // onboarding state (or use the mock in dev). Practitioner → practitioner app;
  // patient → onboarding or the patient app.
  const resolveSession = useCallback(async () => {
    const onboardedLocal = await storageGet(ONBOARDED_KEY);
    if (MOCK_AUTH) {
      if (MOCK_ROLE === 'practitioner') return setStatus('practitioner');
      return setStatus(onboardedLocal ? 'authed' : 'onboarding');
    }
    const me = await fetchMe();
    if (!me) return setStatus(onboardedLocal ? 'authed' : 'onboarding'); // /me not available yet
    if (me.role === 'practitioner') return setStatus('practitioner');
    return setStatus(me.onboardedAt || onboardedLocal ? 'authed' : 'onboarding');
  }, []);

  // After an EXPLICIT sign-in, drop any onboarding flag left in this browser by a
  // previous account. localStorage outlives the server data (and a DB wipe), so a
  // stale `bl_onboarded` would otherwise skip a brand-new patient straight past
  // onboarding. Cold-start (app reopened as the same user) keeps its flag — only
  // a fresh sign-in resets it, so the SERVER's onboardedAt decides for the new user.
  const afterSignIn = useCallback(async () => {
    await storageDelete(ONBOARDED_KEY);
    await resolveSession();
  }, [resolveSession]);

  // On launch: token present → resolve which app; else anon.
  useEffect(() => {
    (async () => {
      const token = await getRefreshToken();
      if (!token) return setStatus('anon');
      await resolveSession();
    })();
  }, [resolveSession]);

  const startEmailSignIn = useCallback(async (email: string, locale: 'en' | 'fr' = 'en') => {
    if (MOCK_AUTH) return null; // pretend the link was sent
    const res = await postJson('/api/mobile/auth/magic-link/start', { email, locale });
    const data = await res.json().catch(() => ({}));
    return typeof data?.devUrl === 'string' ? data.devUrl : null; // dev-only
  }, []);

  const devSignIn = useCallback(async () => {
    await saveTokens(mockPair());
    await afterSignIn();
  }, [afterSignIn]);

  const signInWithLink = useCallback(async (token: string): Promise<{ ok: true } | { ok: false; message?: string }> => {
    if (MOCK_AUTH) { await saveTokens(mockPair()); await afterSignIn(); return { ok: true }; } // any token
    const res = await postJson('/api/mobile/auth/magic-link/verify', { token });
    if (!res.ok) {
      // 403 carries the waitlist / suspended explanation. Swallowing it and
      // saying "expired" would send someone off to request link after link for
      // an account that is not waiting on a link at all.
      const data = await res.json().catch(() => ({}));
      return { ok: false, message: typeof data?.error === 'string' ? data.error : undefined };
    }
    await saveTokens(await res.json());
    await afterSignIn();
    return { ok: true };
  }, [afterSignIn]);

  const exchangeIdToken = useCallback(async (path: string, idToken: string) => {
    if (MOCK_AUTH) { await saveTokens(mockPair()); await afterSignIn(); return true; }
    const res = await postJson(path, { idToken });
    if (!res.ok) return false;
    await saveTokens(await res.json());
    await afterSignIn();
    return true;
  }, [afterSignIn]);

  const signInWithGoogleIdToken = useCallback((idToken: string) => exchangeIdToken('/api/mobile/auth/google', idToken), [exchangeIdToken]);
  const signInWithMicrosoftIdToken = useCallback((idToken: string) => exchangeIdToken('/api/mobile/auth/microsoft', idToken), [exchangeIdToken]);

  const completeOnboarding = useCallback(async () => {
    await saveProfile({ onboarded: true }).catch(() => {}); // record server-side (best-effort)
    await storageSet(ONBOARDED_KEY, '1');
    setStatus('authed');
  }, []);

  const value = useMemo<AuthValue>(
    () => ({ status, startEmailSignIn, signInWithLink, signInWithGoogleIdToken, signInWithMicrosoftIdToken, devSignIn, completeOnboarding, signOut }),
    [status, startEmailSignIn, signInWithLink, signInWithGoogleIdToken, signInWithMicrosoftIdToken, devSignIn, completeOnboarding, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}

export { apiFetch };

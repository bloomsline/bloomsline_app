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
  /** Request an email code. Returns the code in dev (DEV_AUTH) so it can be shown; null otherwise. */
  startEmailSignIn: (email: string, locale?: 'en' | 'fr') => Promise<string | null>;
  verifyEmailCode: (email: string, code: string) => Promise<boolean>;
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

  // On launch: token present → resolve which app; else anon.
  useEffect(() => {
    (async () => {
      const token = await getRefreshToken();
      if (!token) return setStatus('anon');
      await resolveSession();
    })();
  }, [resolveSession]);

  const startEmailSignIn = useCallback(async (email: string, locale: 'en' | 'fr' = 'en') => {
    if (MOCK_AUTH) return null; // pretend the code was sent
    const res = await postJson('/api/mobile/auth/magic-link/start', { email, locale });
    const data = await res.json().catch(() => ({}));
    return typeof data?.devCode === 'string' ? data.devCode : null; // dev-only
  }, []);

  const devSignIn = useCallback(async () => {
    await saveTokens(mockPair());
    await resolveSession();
  }, [resolveSession]);

  const verifyEmailCode = useCallback(async (email: string, code: string) => {
    if (MOCK_AUTH) { await saveTokens(mockPair()); await resolveSession(); return true; } // any code
    const res = await postJson('/api/mobile/auth/magic-link/verify', { email, code });
    if (!res.ok) return false;
    await saveTokens(await res.json());
    await resolveSession();
    return true;
  }, [resolveSession]);

  const exchangeIdToken = useCallback(async (path: string, idToken: string) => {
    if (MOCK_AUTH) { await saveTokens(mockPair()); await resolveSession(); return true; }
    const res = await postJson(path, { idToken });
    if (!res.ok) return false;
    await saveTokens(await res.json());
    await resolveSession();
    return true;
  }, [resolveSession]);

  const signInWithGoogleIdToken = useCallback((idToken: string) => exchangeIdToken('/api/mobile/auth/google', idToken), [exchangeIdToken]);
  const signInWithMicrosoftIdToken = useCallback((idToken: string) => exchangeIdToken('/api/mobile/auth/microsoft', idToken), [exchangeIdToken]);

  const completeOnboarding = useCallback(async () => {
    await saveProfile({ onboarded: true }).catch(() => {}); // record server-side (best-effort)
    await storageSet(ONBOARDED_KEY, '1');
    setStatus('authed');
  }, []);

  const value = useMemo<AuthValue>(
    () => ({ status, startEmailSignIn, verifyEmailCode, signInWithGoogleIdToken, signInWithMicrosoftIdToken, devSignIn, completeOnboarding, signOut }),
    [status, startEmailSignIn, verifyEmailCode, signInWithGoogleIdToken, signInWithMicrosoftIdToken, devSignIn, completeOnboarding, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}

export { apiFetch };

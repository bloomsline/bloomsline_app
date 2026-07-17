// App-wide auth/session state + operations. Three phases:
//   anon       — no tokens; show welcome/sign-up
//   onboarding — signed in but hasn't finished the first-run signup flow
//   authed     — signed in and onboarded; show the app
// Bootstraps from the securely stored refresh token + a local "onboarded" flag.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getRefreshToken, clearTokens, saveTokens } from './token-store';
import { apiFetch, postJson, setOnSignOut } from './api';
import { storageGet, storageSet, storageDelete } from '../storage';

type Status = 'loading' | 'anon' | 'onboarding' | 'authed';
const ONBOARDED_KEY = 'bl_onboarded';

interface AuthValue {
  status: Status;
  startEmailSignIn: (email: string, locale?: 'en' | 'fr') => Promise<void>;
  verifyEmailCode: (email: string, code: string) => Promise<boolean>;
  signInWithGoogleIdToken: (idToken: string) => Promise<boolean>;
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

  // On launch: token present → onboarded ? app : resume onboarding; else anon.
  useEffect(() => {
    (async () => {
      const [token, onboarded] = await Promise.all([getRefreshToken(), storageGet(ONBOARDED_KEY)]);
      setStatus(token ? (onboarded ? 'authed' : 'onboarding') : 'anon');
    })();
  }, []);

  const startEmailSignIn = useCallback(async (email: string, locale: 'en' | 'fr' = 'en') => {
    await postJson('/api/mobile/auth/magic-link/start', { email, locale });
  }, []);

  // A fresh sign-in always enters the onboarding flow (it's short; a returning
  // user simply taps through). Production refinement: skip when the server
  // reports an onboardedAt (see src/api/me.ts).
  const afterAuth = useCallback(() => setStatus('onboarding'), []);

  const verifyEmailCode = useCallback(async (email: string, code: string) => {
    const res = await postJson('/api/mobile/auth/magic-link/verify', { email, code });
    if (!res.ok) return false;
    await saveTokens(await res.json());
    afterAuth();
    return true;
  }, [afterAuth]);

  const signInWithGoogleIdToken = useCallback(async (idToken: string) => {
    const res = await postJson('/api/mobile/auth/google', { idToken });
    if (!res.ok) return false;
    await saveTokens(await res.json());
    afterAuth();
    return true;
  }, [afterAuth]);

  const completeOnboarding = useCallback(async () => {
    await storageSet(ONBOARDED_KEY, '1');
    setStatus('authed');
  }, []);

  const value = useMemo<AuthValue>(
    () => ({ status, startEmailSignIn, verifyEmailCode, signInWithGoogleIdToken, completeOnboarding, signOut }),
    [status, startEmailSignIn, verifyEmailCode, signInWithGoogleIdToken, completeOnboarding, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}

export { apiFetch };

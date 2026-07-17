// App-wide auth state + operations. Bootstraps the session from the securely
// stored refresh token, and exposes the three sign-in paths (email OTP + Google)
// and sign-out, all talking to the backend's /api/mobile/auth/* endpoints.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getRefreshToken, clearTokens, saveTokens } from './token-store';
import { apiFetch, postJson, setOnSignOut } from './api';

type Status = 'loading' | 'authed' | 'anon';

interface AuthValue {
  status: Status;
  /** Email OTP — step 1: request a code. Always resolves (never reveals existence). */
  startEmailSignIn: (email: string, locale?: 'en' | 'fr') => Promise<void>;
  /** Email OTP — step 2: verify the code → signed in. Returns false on a bad code. */
  verifyEmailCode: (email: string, code: string) => Promise<boolean>;
  /** Exchange a Google id_token (from the native flow) → signed in. */
  signInWithGoogleIdToken: (idToken: string) => Promise<boolean>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');

  const signOut = useCallback(async () => {
    const refreshToken = await getRefreshToken();
    if (refreshToken) {
      // best-effort server-side revoke; ignore failures
      postJson('/api/mobile/auth/logout', { refreshToken }).catch(() => {});
    }
    await clearTokens();
    setStatus('anon');
  }, []);

  // A hard 401 (refresh failed) inside the API client flips us to signed-out.
  useEffect(() => {
    setOnSignOut(() => setStatus('anon'));
    return () => setOnSignOut(null);
  }, []);

  // On launch: a stored refresh token means we can (optimistically) resume;
  // the first authed request will rotate it or sign us out if it's dead.
  useEffect(() => {
    getRefreshToken().then((t) => setStatus(t ? 'authed' : 'anon'));
  }, []);

  const startEmailSignIn = useCallback(async (email: string, locale: 'en' | 'fr' = 'en') => {
    await postJson('/api/mobile/auth/magic-link/start', { email, locale });
  }, []);

  const verifyEmailCode = useCallback(async (email: string, code: string) => {
    const res = await postJson('/api/mobile/auth/magic-link/verify', { email, code });
    if (!res.ok) return false;
    await saveTokens(await res.json());
    setStatus('authed');
    return true;
  }, []);

  const signInWithGoogleIdToken = useCallback(async (idToken: string) => {
    const res = await postJson('/api/mobile/auth/google', { idToken });
    if (!res.ok) return false;
    await saveTokens(await res.json());
    setStatus('authed');
    return true;
  }, []);

  const value = useMemo<AuthValue>(
    () => ({ status, startEmailSignIn, verifyEmailCode, signInWithGoogleIdToken, signOut }),
    [status, startEmailSignIn, verifyEmailCode, signInWithGoogleIdToken, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}

// Re-export the client so screens can make authenticated calls.
export { apiFetch };

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
import { forgetAccount } from '@/src/auth/forget-account';
import { saveProfile, fetchMe } from '../api/me';
import { MOCK_AUTH, MOCK_ROLE } from '../config';

const mockPair = () => ({ accessToken: 'mock-access', refreshToken: `mock-refresh-${Date.now()}`, expiresIn: 900 });

type Status = 'loading' | 'anon' | 'practitioner' | 'onboarding' | 'authed';
const ONBOARDED_KEY = 'bl_onboarded';
/**
 * The last status the SERVER actually confirmed, cached across launches.
 *
 * `/me` is how we learn who someone is, and it can fail for reasons that say
 * nothing about them: no signal, a timeout, a 502 while the API redeploys.
 * Without a memory of the last real answer, an unreachable `/me` was read as an
 * answer — and an onboarded patient opening the app on a bad connection was
 * shown the signup form. Anything the server has confirmed is written here, and
 * an unreachable `/me` falls back to it instead of guessing downwards.
 */
const SESSION_KEY = 'bl_session';
type CachedStatus = 'practitioner' | 'authed' | 'onboarding';
/** Storage is a string bucket; only these three mean anything as a status. */
const isCachedStatus = (v: string | null): v is CachedStatus =>
  v === 'practitioner' || v === 'authed' || v === 'onboarding';

/** A sign-in that can be refused for a reason the person should read
 *  (waitlisted, suspended), which only the server knows. */
export type SignInResult = { ok: true } | { ok: false; message?: string; code?: string };

export interface AppleSignInPayload {
  identityToken: string;
  /** The RAW nonce. Apple was handed its SHA-256; the server checks the match. */
  nonce: string;
  authorizationCode: string | null;
  /** Sent by Apple on the first authorisation only. */
  givenName: string | null;
  familyName: string | null;
}

interface AuthValue {
  status: Status;
  /**
   * Email a sign-in link. `devUrl` is the link itself in dev (DEV_AUTH), null
   * otherwise. `code` is true for the ONE store-review address, which signs in
   * with a fixed code because the reviewer cannot open our inbox.
   */
  startEmailSignIn: (email: string, locale?: 'en' | 'fr') => Promise<{ devUrl: string | null; code: boolean }>;
  /** The store-review account's code sign-in. Refused for any other address. */
  signInWithReviewCode: (email: string, code: string) => Promise<SignInResult>;
  /** Sign in with Apple: the identity token plus what only the device knows. */
  signInWithApple: (a: AppleSignInPayload) => Promise<SignInResult>;
  /**
   * Exchange a token from an emailed sign-in link for a session. On failure the
   * server's own message comes back, because "expired link" and "you're on the
   * waitlist" are different things to be told and only the server knows which.
   */
  signInWithLink: (token: string) => Promise<SignInResult>;
  signInWithGoogleIdToken: (idToken: string) => Promise<SignInResult>;
  signInWithMicrosoftIdToken: (idToken: string) => Promise<SignInResult>;
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
    // `forgetAccount` and not two more storageDelete calls here: what a
    // sign-out has to forget grew past this line and nobody noticed, because
    // none of it is reachable from the sign-in screen. See that file.
    await Promise.all([clearTokens(), storageDelete(ONBOARDED_KEY), storageDelete(SESSION_KEY), forgetAccount()]);
    setStatus('anon');
  }, []);

  useEffect(() => {
    // A token that cannot be refreshed ends the session too, and it has exactly
    // the same forgetting to do as pressing Sign out — this path used to flip
    // the status and leave the last person's name in a module variable.
    // The cached status goes too: left behind, a launch that could not reach
    // `/me` read it back and opened the app for a session that had ended.
    setOnSignOut(() => {
      void Promise.all([forgetAccount(), storageDelete(ONBOARDED_KEY), storageDelete(SESSION_KEY)]);
      setStatus('anon');
    });
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
    // A launch is the one moment a blip is most likely (cold radio, resumed
    // app) and most expensive to get wrong, so give it more than one chance.
    let me = await fetchMe();
    for (let i = 0; !me && i < 2; i++) {
      await new Promise((r) => setTimeout(r, 400 * (i + 1)));
      me = await fetchMe();
    }

    if (me) {
      const next: CachedStatus =
        me.role === 'practitioner' ? 'practitioner' : me.onboardedAt || onboardedLocal ? 'authed' : 'onboarding';
      // Remember what the server said, so the next launch survives a bad
      // connection. `onboardedAt` is the server's own record; mirroring it into
      // the local flag is what was missing — completeOnboarding() was the only
      // writer, so a user who onboarded on another device (or before a
      // reinstall) never had one.
      await storageSet(SESSION_KEY, next);
      if (next === 'authed') await storageSet(ONBOARDED_KEY, '1');
      // Finished on THIS phone but the server never heard (the save at the end of
      // onboarding is best-effort): tell it now. Otherwise a reinstall, a second
      // device or a sign-out sent the patient through onboarding again.
      if (next === 'authed' && !me.onboardedAt && onboardedLocal) void saveProfile({ onboarded: true }).catch(() => {});
      return setStatus(next);
    }

    // `/me` is unreachable. Trust the last confirmed answer rather than demote
    // someone to signup — but only while there is still a session to trust. A
    // refresh the server REJECTED (expired after 60 days, revoked, account
    // suspended) clears the tokens while these retries run, and restoring the
    // cached status then opened an app in which every request failed, with no
    // way back to sign-in short of killing it.
    if (!(await getRefreshToken())) return setStatus('anon');
    const cached = await storageGet(SESSION_KEY);
    if (isCachedStatus(cached)) return setStatus(cached);
    return setStatus(onboardedLocal ? 'authed' : 'onboarding');
  }, []);

  // After an EXPLICIT sign-in, drop any onboarding flag left in this browser by a
  // previous account. localStorage outlives the server data (and a DB wipe), so a
  // stale `bl_onboarded` would otherwise skip a brand-new patient straight past
  // onboarding. Cold-start (app reopened as the same user) keeps its flag — only
  // a fresh sign-in resets it, so the SERVER's onboardedAt decides for the new user.
  //
  // A sign-in is also the END of whoever was signed in before, and it forgets
  // them the way Sign out does. It used to clear two flags only: open a sign-in
  // link for another account while signed in, or sign in as someone new on a
  // shared phone before the app was killed, and the new person saw the last
  // one's name, photo, practitioner and home tab — and onboarding pre-filled the
  // last person's name and date of birth into the new account.
  //
  // Passing through `loading` is what makes every provider that fetched for the
  // previous account fetch again for this one: they key on the status, and
  // authed → authed was no change at all.
  const afterSignIn = useCallback(async () => {
    setStatus('loading');
    await Promise.all([storageDelete(ONBOARDED_KEY), storageDelete(SESSION_KEY), forgetAccount()]);
    await resolveSession();
  }, [resolveSession]);

  /** Keep a new session, ending the one it replaces on the server too — the old
   *  refresh token otherwise stayed valid for its full 60 days. */
  const keepNewSession = useCallback(async (pair: Parameters<typeof saveTokens>[0]) => {
    const previous = await getRefreshToken();
    if (previous && previous !== pair.refreshToken) postJson('/api/mobile/auth/logout', { refreshToken: previous }).catch(() => {});
    await saveTokens(pair);
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
    if (MOCK_AUTH) return { devUrl: null, code: false }; // pretend the link was sent
    const res = await postJson('/api/mobile/auth/magic-link/start', { email, locale });
    // Throwing on a refusal is what the screen's "could not send" relies on.
    if (!res.ok) throw new Error(`start ${res.status}`);
    const data = await res.json().catch(() => ({}));
    return {
      devUrl: typeof data?.devUrl === 'string' ? data.devUrl : null, // dev-only
      code: data?.code === true,
    };
  }, []);

  /** POST a sign-in, keep the pair on success, and hand back the server's reason on refusal. */
  const signInVia = useCallback(async (path: string, body: unknown): Promise<SignInResult> => {
    const res = await postJson(path, body);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { ok: false, message: typeof data?.error === 'string' ? data.error : undefined, code: typeof data?.code === 'string' ? data.code : undefined };
    }
    await keepNewSession(await res.json());
    await afterSignIn();
    return { ok: true };
  }, [afterSignIn, keepNewSession]);

  const signInWithReviewCode = useCallback(
    (email: string, code: string) => signInVia('/api/mobile/auth/review', { email, code }),
    [signInVia],
  );
  const signInWithApple = useCallback(
    (a: AppleSignInPayload) => signInVia('/api/mobile/auth/apple', { ...a, device: 'iOS' }),
    [signInVia],
  );

  const devSignIn = useCallback(async () => {
    await saveTokens(mockPair());
    await afterSignIn();
  }, [afterSignIn]);

  const signInWithLink = useCallback(async (token: string): Promise<SignInResult> => {
    if (MOCK_AUTH) { await saveTokens(mockPair()); await afterSignIn(); return { ok: true }; } // any token
    const res = await postJson('/api/mobile/auth/magic-link/verify', { token });
    if (!res.ok) {
      // 403 carries the waitlist / suspended explanation. Swallowing it and
      // saying "expired" would send someone off to request link after link for
      // an account that is not waiting on a link at all.
      const data = await res.json().catch(() => ({}));
      return { ok: false, message: typeof data?.error === 'string' ? data.error : undefined, code: typeof data?.code === 'string' ? data.code : undefined };
    }
    await keepNewSession(await res.json());
    await afterSignIn();
    return { ok: true };
  }, [afterSignIn, keepNewSession]);

  // The refusal's reason comes back, as for Apple and email. It was dropped here,
  // so a waitlisted or suspended person signing in with Google or Microsoft was
  // told only "rejected, try again" — and tried again, indefinitely.
  const exchangeIdToken = useCallback(async (path: string, idToken: string): Promise<SignInResult> => {
    if (MOCK_AUTH) { await saveTokens(mockPair()); await afterSignIn(); return { ok: true }; }
    const res = await postJson(path, { idToken });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { ok: false, message: typeof data?.error === 'string' ? data.error : undefined, code: typeof data?.code === 'string' ? data.code : undefined };
    }
    await keepNewSession(await res.json());
    await afterSignIn();
    return { ok: true };
  }, [afterSignIn, keepNewSession]);

  const signInWithGoogleIdToken = useCallback((idToken: string) => exchangeIdToken('/api/mobile/auth/google', idToken), [exchangeIdToken]);
  const signInWithMicrosoftIdToken = useCallback((idToken: string) => exchangeIdToken('/api/mobile/auth/microsoft', idToken), [exchangeIdToken]);

  const completeOnboarding = useCallback(async () => {
    await saveProfile({ onboarded: true }).catch(() => {}); // record server-side (best-effort)
    await Promise.all([storageSet(ONBOARDED_KEY, '1'), storageSet(SESSION_KEY, 'authed')]);
    setStatus('authed');
  }, []);

  const value = useMemo<AuthValue>(
    () => ({ status, startEmailSignIn, signInWithLink, signInWithReviewCode, signInWithApple, signInWithGoogleIdToken, signInWithMicrosoftIdToken, devSignIn, completeOnboarding, signOut }),
    [status, startEmailSignIn, signInWithLink, signInWithReviewCode, signInWithApple, signInWithGoogleIdToken, signInWithMicrosoftIdToken, devSignIn, completeOnboarding, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}

export { apiFetch };

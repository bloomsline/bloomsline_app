// The single HTTP client for the app. It attaches the access token, and on a
// 401 it transparently ROTATES the refresh token (single-flight, so a burst of
// requests triggers exactly one refresh) and retries once. If refresh fails the
// session is cleared and the registered sign-out handler fires.
import { API_URL } from '../config';
import { clearTokens, getAccessToken, getRefreshToken, saveTokens } from './token-store';

let refreshing: Promise<boolean> | null = null;
let onSignOut: (() => void) | null = null;

/** The auth context registers here so a hard 401 can flip the UI to signed-out. */
export function setOnSignOut(cb: (() => void) | null): void {
  onSignOut = cb;
}

async function doRefresh(): Promise<boolean> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) return false;
  try {
    const res = await fetch(`${API_URL}/api/mobile/auth/refresh`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) {
      await clearTokens();
      return false;
    }
    await saveTokens(await res.json());
    return true;
  } catch {
    return false; // network blip — keep tokens, let the caller surface the error
  }
}

function refreshOnce(): Promise<boolean> {
  if (!refreshing) {
    refreshing = doRefresh().finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
}

/** fetch() against the backend with auth handling. `path` starts with '/'. */
export async function apiFetch(path: string, init: RequestInit = {}, allowRetry = true): Promise<Response> {
  const access = await getAccessToken();
  const headers = new Headers(init.headers);
  if (!headers.has('content-type') && init.body) headers.set('content-type', 'application/json');
  if (access) headers.set('authorization', `Bearer ${access}`);

  const res = await fetch(`${API_URL}${path}`, { ...init, headers });

  if (res.status === 401 && allowRetry && (await getRefreshToken())) {
    const ok = await refreshOnce();
    if (ok) return apiFetch(path, init, false);
    onSignOut?.(); // refresh genuinely failed → signed out
  }
  return res;
}

/** Convenience: POST json to an unauthenticated auth endpoint. */
export async function postJson(path: string, body: unknown): Promise<Response> {
  return fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

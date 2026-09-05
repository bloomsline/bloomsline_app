// The single HTTP client for the app. It attaches the access token, and on a
// 401 it transparently ROTATES the refresh token (single-flight, so a burst of
// requests triggers exactly one refresh) and retries once. If refresh fails the
// session is cleared and the registered sign-out handler fires.
import { API_URL } from '../config';
import { clearTokens, getAccessToken, getRefreshToken, saveTokens } from './token-store';

/**
 * Why three outcomes and not a boolean: a refresh that is REJECTED means the
 * session is over, but a refresh that could not be SENT means nothing at all.
 * Collapsing the two signed people out on a dropped connection.
 */
type RefreshResult = 'ok' | 'rejected' | 'unreachable';

let refreshing: Promise<RefreshResult> | null = null;
let onSignOut: (() => void) | null = null;

/** The auth context registers here so a hard 401 can flip the UI to signed-out. */
export function setOnSignOut(cb: (() => void) | null): void {
  onSignOut = cb;
}

async function doRefresh(): Promise<RefreshResult> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) return 'rejected';
  try {
    const res = await fetch(`${API_URL}/api/mobile/auth/refresh`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    // 5xx is the SERVER having a moment, not a verdict on this token. Clearing
    // tokens there signs everyone out for the length of a bad deploy.
    if (res.status >= 500) return 'unreachable';
    if (!res.ok) {
      await clearTokens();
      return 'rejected';
    }
    await saveTokens(await res.json());
    return 'ok';
  } catch {
    return 'unreachable'; // network blip — keep tokens, let the caller surface the error
  }
}

function refreshOnce(): Promise<RefreshResult> {
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
    const result = await refreshOnce();
    if (result === 'ok') return apiFetch(path, init, false);
    // Only a REJECTED refresh means signed out. An unreachable one leaves the
    // session intact and lets the caller handle the failed request.
    if (result === 'rejected') onSignOut?.();
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

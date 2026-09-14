// The single HTTP client for the app. It attaches the access token, and on a
// 401 it transparently ROTATES the refresh token (single-flight, so a burst of
// requests triggers exactly one refresh) and retries once. If refresh fails the
// session is cleared and the registered sign-out handler fires.
import { API_URL } from '../config';
import { getCurrentPractitionerId } from '../care/current-practitioner';
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
    // Nor is 429: the refresh limit is per IP, and a clinic's wifi or a carrier's
    // shared address can hit it for many people at once. Treated as a rejection,
    // it signed them out and wiped their preferences.
    if (res.status >= 500 || res.status === 429) return 'unreachable';
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

/** How long a request may take before it counts as not having arrived. */
const REQUEST_TIMEOUT_MS = 45_000;

/**
 * What a request that never reached the server looks like to its caller: a
 * response like any failed one, marked so a screen can say "offline".
 *
 * `fetch` REJECTS when there is no connection, and a large part of the app did
 * not expect that: Book, Confirm, Cancel, Submit and more awaited a helper that
 * threw, the line that stops the spinner never ran, and the button spun until
 * the app was killed. Every one of them already handles a failed response, so
 * turning "no answer" into one fixes them all in one place.
 */
function offlineResponse(): Response {
  return new Response(JSON.stringify({ reason: 'offline' }), {
    status: 503,
    headers: { 'content-type': 'application/json', 'x-bl-offline': '1' },
  });
}

/** True for a response that stands in for no answer at all (see offlineResponse). */
export const isOffline = (res: Response): boolean => res.headers.get('x-bl-offline') === '1';

/** `fetch` that answers every time: a real response, or offlineResponse(). A
 *  request with no answer after REQUEST_TIMEOUT_MS is abandoned, because a
 *  connection that hangs is the same to a patient as one that is down, and it
 *  used to leave a spinner going for as long as the OS let the socket live. */
async function fetchOrOffline(url: string, init: RequestInit): Promise<Response> {
  const controller = init.signal ? null : new AbortController();
  const timer = controller ? setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS) : null;
  try {
    return await fetch(url, controller ? { ...init, signal: controller.signal } : init);
  } catch {
    return offlineResponse();
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** fetch() against the backend with auth handling. `path` starts with '/'. Never
 *  rejects: no connection comes back as a 503 that `isOffline` recognises. */
export async function apiFetch(path: string, init: RequestInit = {}, allowRetry = true): Promise<Response> {
  const access = await getAccessToken();
  const headers = new Headers(init.headers);
  if (!headers.has('content-type') && init.body) headers.set('content-type', 'application/json');
  if (access) headers.set('authorization', `Bearer ${access}`);
  // Which practitioner this request is about, for a patient linked to several.
  // Read per request rather than captured, so a retry after a refresh carries
  // the choice as it is now. The server checks it is really linked and falls
  // back to the first link otherwise, so a stale id can never widen access.
  const practitionerId = getCurrentPractitionerId();
  if (practitionerId && !headers.has('x-bl-practitioner')) headers.set('x-bl-practitioner', practitionerId);

  const res = await fetchOrOffline(`${API_URL}${path}`, { ...init, headers });

  if (res.status === 401 && allowRetry && (await getRefreshToken())) {
    const result = await refreshOnce();
    if (result === 'ok') return apiFetch(path, init, false);
    // Only a REJECTED refresh means signed out. An unreachable one leaves the
    // session intact and lets the caller handle the failed request.
    if (result === 'rejected') onSignOut?.();
  }
  return res;
}

/** Convenience: POST json to an unauthenticated auth endpoint. Never rejects,
 *  like apiFetch: a sign-in with no connection used to leave its button spinning. */
export async function postJson(path: string, body: unknown): Promise<Response> {
  return fetchOrOffline(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

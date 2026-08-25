// Patient profile seam. Drives the Flow A (has a practitioner) vs Flow B (solo)
// branch, and persists the name/consent collected during onboarding.
//
// GET/PATCH `/api/mobile/me` exist and work (care repo, `src/app/api/mobile/me`).
// Both calls still fail SOFT by design: fetchMe() returns null on any error
// (→ solo/Flow B default) and saveProfile() reports false, so onboarding carries
// on rather than dead-ending someone on a network blip.
import { apiFetch } from '../auth/api';

export interface MeProfile {
  role: string; // 'member' (patient) | 'practitioner'
  firstName: string | null;
  lastName: string | null;
  hasPractitioner: boolean;
  practitionerName: string | null;
  onboardedAt: string | null;
  locale: 'en' | 'fr';
  dateOfBirth: string | null; // 'YYYY-MM-DD'
  /** Their sign-in address. Shown, never edited: changing it is an auth flow
   *  with a verification step, not a profile edit. */
  email: string | null;
  /** Their own picture, already signed and loadable. Null when unset. */
  avatarUrl: string | null;
  deletionRequestedAt: string | null; // ISO — set while a deletion is counting down
}

export async function fetchMe(): Promise<MeProfile | null> {
  try {
    const res = await apiFetch('/api/mobile/me');
    if (!res.ok) return null;
    return (await res.json()) as MeProfile;
  } catch {
    return null;
  }
}

export async function saveProfile(input: {
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string | null;
  agreedToTerms?: boolean;
  onboarded?: boolean;
  locale?: 'en' | 'fr';
  /** An object key from `presignAvatar`, or null to remove the picture. The
   *  server re-checks it belongs to the caller before storing it. */
  avatarKey?: string | null;
}): Promise<boolean> {
  try {
    const res = await apiFetch('/api/mobile/me', { method: 'PATCH', body: JSON.stringify(input) });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Ask for the account to be deleted.
 *
 * Starts a 30-day countdown server-side and revokes every refresh token, so the
 * app must sign out straight after. Signing in again inside the window cancels
 * it — there is no separate undo call, and no screen needs to offer one.
 *
 * Unlike the rest of this module this does NOT fail soft. Telling someone their
 * account is being deleted when the request never landed is the one wrong
 * answer here, so the caller gets the failure and says so.
 */
export async function requestAccountDeletion(): Promise<{ purgeAfter: string; graceDays: number } | null> {
  try {
    const res = await apiFetch('/api/mobile/me/delete', { method: 'POST' });
    if (!res.ok) return null;
    return (await res.json()) as { purgeAfter: string; graceDays: number };
  } catch {
    return null;
  }
}

/**
 * Presign a PUT for the patient's own picture.
 *
 * The KEY comes back from the server, derived from the session — the client
 * never chooses where its own avatar lands. Upload the bytes to `url`, then
 * send the key on `saveProfile({ avatarKey })`.
 */
export async function presignAvatar(contentType: string, sizeBytes: number): Promise<{ key: string; url: string; headers: Record<string, string> } | null> {
  try {
    const res = await apiFetch('/api/mobile/me/avatar', { method: 'POST', body: JSON.stringify({ contentType, sizeBytes }) });
    if (!res.ok) return null;
    return (await res.json()) as { key: string; url: string; headers: Record<string, string> };
  } catch {
    return null;
  }
}

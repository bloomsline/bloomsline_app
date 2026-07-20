import { API_URL } from '../config';

// Patient invite lookup. Deliberately a PLAIN fetch, not apiFetch: the invitee
// has no account yet, so there is no token to attach and a 401-refresh cycle
// would be meaningless here.

export interface PatientInvite {
  email: string;
  practitionerName: string | null;
}

/**
 * Resolve an invite token into the address the person was invited as.
 *
 * Returns null for anything unusable — bad token, expired, network down. The
 * caller falls back to the ordinary welcome rather than dead-ending someone
 * who came from a real email: a stale link should cost them a pre-filled
 * field, not the ability to sign up.
 */
export async function fetchInvite(token: string): Promise<PatientInvite | null> {
  try {
    const res = await fetch(`${API_URL}/api/mobile/invite/${encodeURIComponent(token)}`);
    if (!res.ok) return null;
    const data = (await res.json()) as Partial<PatientInvite>;
    return typeof data.email === 'string' && data.email
      ? { email: data.email, practitionerName: data.practitionerName ?? null }
      : null;
  } catch {
    return null;
  }
}

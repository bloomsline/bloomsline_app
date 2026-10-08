import { API_URL } from '../config';

// Patient invite lookup. Deliberately a PLAIN fetch, not apiFetch: the invitee
// has no account yet, so there is no token to attach and a 401-refresh cycle
// would be meaningless here.

export interface PatientInvite {
  email: string;
  practitionerName: string | null;
  locale: 'en' | 'fr'; // the language the invite was sent in → the app opens in it
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
      ? { email: data.email, practitionerName: data.practitionerName ?? null, locale: data.locale === 'fr' ? 'fr' : 'en' }
      : null;
  } catch {
    return null;
  }
}

/** A guardian's or a child's invitation (guardian plan, phase 6). */
export interface FamilyInvite {
  email: string | null;
  /** The child it is about: for a guardian, whose care; for the child, their own name. */
  childFirstName: string | null;
  practitionerName: string | null;
  locale: 'en' | 'fr';
}

export async function fetchFamilyInvite(kind: 'guardian' | 'child', token: string): Promise<FamilyInvite | null> {
  const got = await lookupFamilyInvite(kind, token);
  return 'invite' in got ? got.invite : null;
}

/**
 * As fetchFamilyInvite, saying why there is none: 'gone' when the server
 * answered that the invitation is not there (used, expired, never existed),
 * 'unreachable' for no answer or a server error. The landing treated the two
 * alike, so an offline phone was told its invitation had expired.
 */
export async function lookupFamilyInvite(kind: 'guardian' | 'child', token: string): Promise<{ invite: FamilyInvite } | { failed: 'gone' | 'unreachable' }> {
  try {
    const res = await fetch(`${API_URL}/api/mobile/${kind}-invite/${encodeURIComponent(token)}`);
    if (!res.ok) return { failed: res.status >= 400 && res.status < 500 ? 'gone' : 'unreachable' };
    const data = (await res.json()) as { email?: string | null; childFirstName?: string | null; firstName?: string | null; practitionerName?: string | null; locale?: string };
    return { invite: {
      email: typeof data.email === 'string' ? data.email : null,
      childFirstName: (kind === 'guardian' ? data.childFirstName : data.firstName) ?? null,
      practitionerName: data.practitionerName ?? null,
      locale: data.locale === 'fr' ? 'fr' : 'en',
    } };
  } catch {
    return { failed: 'unreachable' };
  }
}

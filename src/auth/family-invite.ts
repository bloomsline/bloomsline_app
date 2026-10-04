// A guardian's or a child's invitation, carried across sign-in (guardian plan,
// phase 6).
//
// The link in the email opens `/guardian/<token>` or `/child/<token>`. The
// person may then sign in any way they like, and on the web the Apple and
// Google flows leave the page entirely, so the token is kept in storage, not in
// memory. It goes with every sign-in request as `familyInvite` (the server
// admits an address that would otherwise be waitlisted, including an Apple
// relay address). Once signed in, the person is brought back to the
// invitation screen and accepts it THERE, by a tap on a screen that names the
// child: never silently, because the server binds whoever accepts, and a
// device can be shared. Then it is forgotten.
//
// NOT on the forget-account list (a sign-in forgets the previous account, and
// this is what the sign-in is for); cleared on sign-out, on "Not now", on any
// answer from the server, and after two hours.
import { apiFetch } from './api';
import { storageDelete, storageGet, storageSet } from '../storage';

export type FamilyInviteKind = 'guardian' | 'child';
const KEY = 'pending.familyInvite';
/** Long enough to sign in (an emailed sign-in link included), short enough that
 *  a link opened on a shared device and walked away from does not wait for the
 *  next person. */
const MAX_AGE_MS = 2 * 3_600_000;

interface Pending { token: string; kind: FamilyInviteKind; at: number }

export async function rememberFamilyInvite(token: string, kind: FamilyInviteKind): Promise<void> {
  if (!token || token.length > 512) return;
  await storageSet(KEY, JSON.stringify({ token, kind, at: Date.now() } satisfies Pending));
}

export async function pendingFamilyInvite(): Promise<Pending | null> {
  const raw = await storageGet(KEY);
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<Pending>;
    if (typeof v.token !== 'string' || (v.kind !== 'guardian' && v.kind !== 'child') || typeof v.at !== 'number') return null;
    if (Date.now() - v.at > MAX_AGE_MS) { await storageDelete(KEY); return null; }
    return { token: v.token, kind: v.kind, at: v.at };
  } catch {
    return null;
  }
}

/** The token for a sign-in request body, or undefined (the field is then left out). */
export async function familyInviteForSignIn(): Promise<string | undefined> {
  return (await pendingFamilyInvite())?.token;
}

/** Restart the clock at sign-in: the two hours are for confirming once signed
 *  in, not a race between opening the link and finishing a sign-in. */
export async function touchFamilyInvite(): Promise<void> {
  const p = await pendingFamilyInvite();
  if (p) await storageSet(KEY, JSON.stringify({ ...p, at: Date.now() } satisfies Pending));
}

/** Forget the pending invitation: sign-out, "Not now". */
export async function clearFamilyInvite(): Promise<void> {
  await storageDelete(KEY).catch(() => {});
}

export type AcceptOutcome =
  | { ok: true; linkId: string | null }
  | { ok: false; code: string; message: string | null }
  | null; // nothing pending, or no answer (offline): try again from the screen

/** The profile to open on after an acceptance (the child's chart, for a guardian). */
let nextProfile: string | null = null;
export function takeNextProfile(): string | null {
  const k = nextProfile;
  nextProfile = null;
  return k;
}

/**
 * Accept the pending invitation as the signed-in account. Called ONLY from the
 * invitation screen, on the person's tap. Forgets it on any definite answer
 * (accepted, or refused); keeps it on a dropped connection, so the tap can be
 * tried again.
 */
export async function acceptPendingFamilyInvite(): Promise<AcceptOutcome> {
  const pending = await pendingFamilyInvite();
  if (!pending) return null;
  const res = await apiFetch(`/api/mobile/${pending.kind}-invite/${encodeURIComponent(pending.token)}/accept`, { method: 'POST' });
  if (res.status >= 500 || res.status === 429) return null;
  const data = (await res.json().catch(() => ({}))) as { code?: string; error?: string; linkId?: string };
  await storageDelete(KEY);
  if (res.ok) {
    // A guardian opens on the child's care; a child on their own (the default).
    nextProfile = pending.kind === 'guardian' && typeof data.linkId === 'string' ? data.linkId : null;
    return { ok: true, linkId: nextProfile };
  }
  return { ok: false, code: typeof data.code === 'string' ? data.code : 'invalid', message: typeof data.error === 'string' ? data.error : null };
}

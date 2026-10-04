// A guardian's or a child's invitation, carried across sign-in (guardian plan,
// phase 6).
//
// The link in the email opens `/guardian/<token>` or `/child/<token>`. The
// person may then sign in any way they like, and on the web the Apple and
// Google flows leave the page entirely, so the token is kept in storage, not in
// memory. It goes with every sign-in request as `familyInvite` (the server
// admits an address that would otherwise be waitlisted, including an Apple
// relay address) and, once signed in, is accepted at the one endpoint that
// binds it. Then it is forgotten.
//
// NOT on the forget-account list: a sign-in forgets the previous account, and
// this is the very thing the sign-in is for. It expires on its own instead.
import { apiFetch } from './api';
import { storageDelete, storageGet, storageSet } from '../storage';

export type FamilyInviteKind = 'guardian' | 'child';
const KEY = 'pending.familyInvite';
/** An invitation link lives seven days on the server; a little longer here is harmless. */
const MAX_AGE_MS = 8 * 86_400_000;

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

export type AcceptOutcome =
  | { ok: true; linkId: string | null }
  | { ok: false; code: string; message: string | null }
  | null; // nothing pending

/** What the last acceptance said, for the screen that comes next to show once. */
let lastOutcome: AcceptOutcome = null;
export function takeAcceptOutcome(): AcceptOutcome {
  const o = lastOutcome;
  lastOutcome = null;
  return o;
}

/** The profile to open on after an acceptance (the child's chart, for a guardian). */
let nextProfile: string | null = null;
export function takeNextProfile(): string | null {
  const k = nextProfile;
  nextProfile = null;
  return k;
}

/**
 * Accept the pending invitation as the signed-in account. Forgets it on any
 * definite answer (accepted, or refused for good); keeps it on a dropped
 * connection, so the next launch tries again.
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
    lastOutcome = { ok: true, linkId: nextProfile };
  } else {
    lastOutcome = { ok: false, code: typeof data.code === 'string' ? data.code : 'invalid', message: typeof data.error === 'string' ? data.error : null };
  }
  return lastOutcome;
}

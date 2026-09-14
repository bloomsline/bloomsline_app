// The practitioner's face and name, fetched once and kept for the session.
//
// The journal's share chip wants to show WHO can read a page — a face and four
// words carry that better than the word "shared" does. Nothing else about the
// care payload is wanted here, and fetching it again on every screen that shows
// an avatar would be a lot of network for one small picture.
//
// It is the face of the SELECTED practitioner. A patient with several switches
// between them, so the cache is keyed by who was selected when it was filled,
// and everyone showing it is subscribed: a switch clears it, tells them, and
// they ask again. Before, it was filled once per session and the session sheet
// kept showing the first practitioner's photo after a switch.
import { useEffect, useState } from 'react';
import { fetchCare, type PatientCare } from '@/src/api/care';
import { getCurrentPractitionerId } from '@/src/care/current-practitioner';

export interface PractitionerFace {
  name: string | null;
  photoUrl: string | null;
}

let cached: PractitionerFace | null = null;
/** The selection `cached` was filled for. A face for anyone else is a miss. */
let cachedFor: string | null = null;
let inflight: Promise<PractitionerFace | null> | null = null;
/** Bumped by every clear, so a request started before a switch cannot land in
 *  the cache after it. */
let generation = 0;

/** Everyone currently showing the face (see me-face, which does the same). */
const listeners = new Set<(f: PractitionerFace | null, reload: boolean) => void>();

const faceOf = (care: PatientCare): PractitionerFace => ({
  name: care.practitioner?.name ?? care.practitionerName,
  photoUrl: care.practitioner?.photoUrl ?? null,
});

const current = (): PractitionerFace | null => (cached && cachedFor === getCurrentPractitionerId() ? cached : null);

function fill(face: PractitionerFace, forId: string | null): void {
  cached = face;
  cachedFor = forId;
  listeners.forEach((l) => l(face, false));
}

async function load(): Promise<PractitionerFace | null> {
  const hit = current();
  if (hit) return hit;
  // A second caller while the first is in the air waits on the same request
  // rather than starting another.
  if (!inflight) {
    const gen = generation;
    const forId = getCurrentPractitionerId();
    inflight = fetchCare()
      .then((care) => {
        if (!care || gen !== generation) return null;
        fill(faceOf(care), forId);
        return cached;
      })
      .catch(() => null)
      .finally(() => { if (gen === generation) inflight = null; });
  }
  return inflight;
}

/** Hand the shared cache a care payload the screen already fetched. My Care
 *  loads it on open; without this the session sheet would ask for it again the
 *  moment it needs the same avatar.
 *
 *  Only when the payload is about who is selected now: My Care's request can
 *  still be in the air when the patient switches, and its answer is the
 *  previous practitioner's. */
export function primePractitionerFace(care: PatientCare | null): void {
  if (!care || current()) return;
  const forId = getCurrentPractitionerId();
  const aboutId = care.practitioner?.practitionerId;
  // An older server does not say whose payload it is; trust it as before.
  if (aboutId && forId && aboutId !== forId) return;
  fill(faceOf(care), forId);
}

/** The face, or null while it is unknown. Never throws: an avatar is a nicety,
 *  and a screen that cannot get one falls back to an initial.
 *
 *  `enabled` is for callers that already hold the care payload — My Care fetched
 *  it to draw the whole screen, and should not ask for it a second time just to
 *  colour in one 44px circle. */
export function usePractitionerFace(enabled = true): PractitionerFace | null {
  const [face, setFace] = useState<PractitionerFace | null>(current);
  useEffect(() => {
    if (!enabled) return;
    // Cleared: drop the old face. After a switch, ask for the new one; after a
    // sign-out, do NOT — the tokens are still being cleared, and a request sent
    // now would fill the cache with the last account's practitioner.
    const onChange = (f: PractitionerFace | null, reload: boolean) => {
      setFace(f);
      if (!f && reload) void load();
    };
    listeners.add(onChange);
    const hit = current();
    if (hit) setFace(hit);
    else void load();
    return () => { listeners.delete(onChange); };
  }, [enabled]);
  return face;
}

/** The letter to fall back to. "Dr." is stripped: it is a title, not a name. */
export function initialOf(name: string | null | undefined): string {
  return (name ?? '').replace(/^dr\.?\s*/i, '').trim().charAt(0).toUpperCase() || 'M';
}

/** Forget the face. On sign-out (see `clearMeFace`), and with `reload` on a
 *  switch, which also has everyone showing it fetch the new one. */
export function clearPractitionerFace(reload = false): void {
  cached = null;
  cachedFor = null;
  inflight = null;
  generation += 1;
  listeners.forEach((l) => l(null, reload));
}

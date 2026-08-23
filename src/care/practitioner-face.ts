// The practitioner's face and name, fetched once and kept for the session.
//
// The journal's share chip wants to show WHO can read a page — a face and four
// words carry that better than the word "shared" does. Nothing else about the
// care payload is wanted here, and fetching it again on every screen that shows
// an avatar would be a lot of network for one small picture.
import { useEffect, useState } from 'react';
import { fetchCare, type PatientCare } from '@/src/api/care';

export interface PractitionerFace {
  name: string | null;
  photoUrl: string | null;
}

let cached: PractitionerFace | null = null;
let inflight: Promise<PractitionerFace | null> | null = null;

async function load(): Promise<PractitionerFace | null> {
  if (cached) return cached;
  // A second caller while the first is in the air waits on the same request
  // rather than starting another.
  inflight ??= fetchCare()
    .then((care) => {
      if (!care) return null;
      cached = { name: care.practitioner?.name ?? care.practitionerName, photoUrl: care.practitioner?.photoUrl ?? null };
      return cached;
    })
    .catch(() => null)
    .finally(() => { inflight = null; });
  return inflight;
}

/** Hand the shared cache a care payload the screen already fetched. My Care
 *  loads it on open; without this the session sheet would ask for it again the
 *  moment it needs the same avatar. */
export function primePractitionerFace(care: PatientCare | null): void {
  if (cached || !care) return;
  cached = { name: care.practitioner?.name ?? care.practitionerName, photoUrl: care.practitioner?.photoUrl ?? null };
}

/** The face, or null while it is unknown. Never throws: an avatar is a nicety,
 *  and a screen that cannot get one falls back to an initial.
 *
 *  `enabled` is for callers that already hold the care payload — My Care fetched
 *  it to draw the whole screen, and should not ask for it a second time just to
 *  colour in one 44px circle. */
export function usePractitionerFace(enabled = true): PractitionerFace | null {
  const [face, setFace] = useState<PractitionerFace | null>(cached);
  useEffect(() => {
    if (cached || !enabled) return;
    let alive = true;
    void load().then((f) => { if (alive && f) setFace(f); });
    return () => { alive = false; };
  }, [enabled]);
  return face;
}

/** The letter to fall back to. "Dr." is stripped: it is a title, not a name. */
export function initialOf(name: string | null | undefined): string {
  return (name ?? '').replace(/^dr\.?\s*/i, '').trim().charAt(0).toUpperCase() || 'M';
}

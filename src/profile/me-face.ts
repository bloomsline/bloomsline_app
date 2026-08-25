// The patient's own face and name, fetched once and shared.
//
// Three screens put it in their top-right corner and Settings shows it on a
// card. Four `/me` requests for one small picture would be four too many, so
// this is the one place that asks.
//
// It also fixes the staleness that made it worth writing: Settings fetched on
// mount and never again, so after changing the photo the old one sat there
// until the screen was left and re-entered. Saving now clears this cache, and
// every screen that shows the face is subscribed to it.
import { useEffect, useState } from 'react';
import { fetchMe } from '@/src/api/me';

export interface MeFace {
  name: string;
  /** A loadable url, or null. Never a storage key. */
  avatarUrl: string | null;
}

let cached: MeFace | null = null;
let inflight: Promise<MeFace | null> | null = null;

/** Everyone currently showing the face, so a change reaches all of them at once
 *  rather than only whichever screen happens to remount. */
const listeners = new Set<(f: MeFace | null) => void>();

async function load(): Promise<MeFace | null> {
  if (cached) return cached;
  inflight ??= fetchMe()
    .then((me) => {
      if (!me) return null;
      cached = {
        name: `${me.firstName ?? ''} ${me.lastName ?? ''}`.trim(),
        avatarUrl: me.avatarUrl,
      };
      listeners.forEach((l) => l(cached));
      return cached;
    })
    .catch(() => null)
    .finally(() => { inflight = null; });
  return inflight;
}

/**
 * Forget what we know and fetch it again, telling everyone.
 *
 * Called after saving the profile. The signed url is minted by the server on
 * read, so the new picture only exists once `/me` has been asked again — which
 * is exactly why the old one used to linger.
 */
export async function refreshMeFace(): Promise<void> {
  cached = null;
  inflight = null;
  await load();
}

/** Optimistic local update, for the moment between choosing a picture and the
 *  server having signed it. The uri is a local file; the next refresh replaces
 *  it with the real one. */
export function setMeFaceLocally(patch: Partial<MeFace>): void {
  cached = { name: cached?.name ?? '', avatarUrl: cached?.avatarUrl ?? null, ...patch };
  listeners.forEach((l) => l(cached));
}

/** The face, or null while it is unknown. Never throws: an avatar is a nicety,
 *  and a screen that cannot get one draws the mark instead. */
export function useMeFace(): MeFace | null {
  const [face, setFace] = useState<MeFace | null>(cached);
  useEffect(() => {
    listeners.add(setFace);
    void load();
    return () => { listeners.delete(setFace); };
  }, []);
  return face;
}

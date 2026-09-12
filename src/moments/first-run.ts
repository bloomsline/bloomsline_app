// Has this patient finished the Moments introduction?
//
// The answer lives ON THE SERVER (`user.moments_onboarded_at`), for two reasons
// that a flag in the Keychain cannot cover: it has to survive a reinstall or a
// second phone, or someone who has been writing for months gets introduced to
// the app again — and it is the only way to answer how many patients actually
// finish, which is a question about people, not about one device.
//
// The device still holds a COPY, and only as a paint cache: `/api/mobile/me` is
// a round trip, and without a local answer the Moments tab would show the
// introduction for a beat to someone who finished it last year. Storage is
// never the authority; when the two disagree, see `reconcile` below.
import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchMe, saveProfile } from '@/src/api/me';
import { storageDelete, storageGet, storageSet } from '@/src/storage';

const KEY = 'moments.firstRun.v1';

export interface FirstRun {
  /** False until we know one way or the other. Gate the introduction on it, or
   *  it flashes onto the screen of everyone who has already finished. */
  ready: boolean;
  /** True once they have been through it. */
  done: boolean;
  /** Called from the last screen. Returns immediately — the patient is not made
   *  to wait on a network call to leave an introduction. */
  complete: () => void;
}

export function useMomentsFirstRun(): FirstRun {
  const [done, setDone] = useState(false);
  const [ready, setReady] = useState(false);
  // Set the moment `complete()` is called, and read inside the fetch's own
  // callback: the profile request can land AFTER someone has pressed through
  // the last screen, and an in-flight `null` from before the write would
  // otherwise put the introduction back on top of their line.
  const finished = useRef(false);

  useEffect(() => {
    let alive = true;

    void storageGet(KEY).then((v) => {
      if (alive && v === '1') setDone(true);
    });

    void fetchMe().then(async (me) => {
      if (!alive) return;
      if (!me) {
        // Unreachable, or an older server without the field. Trust the cache and
        // let them get on with it: showing the introduction to a patient with a
        // full line because their connection dropped is the worse failure.
        setReady(true);
        return;
      }
      // `typeof === 'string'`, not `!== null`. A server that predates the column
      // omits the field entirely, and `undefined !== null` is TRUE — which would
      // mark every patient as finished and hide the introduction from precisely
      // the people it exists for. Absent means not finished.
      const server = typeof me.momentsOnboardedAt === 'string';
      if (server) {
        setDone(true);
        void storageSet(KEY, '1');
      } else if (!finished.current) {
        const cached = (await storageGet(KEY)) === '1';
        if (cached) {
          // The phone says finished and the server does not, which means an
          // earlier write never landed. Say it again rather than replaying the
          // introduction — and the server keeps the first date it is given, so
          // this cannot rewrite a completion that did land.
          void saveProfile({ momentsOnboarded: true });
          if (alive) setDone(true);
        } else if (alive) {
          setDone(false);
        }
      }
      if (alive) setReady(true);
    });

    return () => {
      alive = false;
    };
  }, []);

  const complete = useCallback(() => {
    finished.current = true;
    setDone(true);
    void storageSet(KEY, '1');
    // Fire and forget. If it fails, the cache is already set and the next launch
    // re-sends it (above), so a dropped connection costs the count nothing.
    void saveProfile({ momentsOnboarded: true });
  }, []);

  return { ready, done, complete };
}

/** Forget that THIS account has been through the introduction. Sign-out only. */
export async function clearMomentsFirstRun(): Promise<void> {
  await storageDelete(KEY).catch(() => {});
}

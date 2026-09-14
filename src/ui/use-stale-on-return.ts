// Run `refresh` when the app comes back to the foreground after long enough away
// that what is on screen may have gone out of date.
//
// Media on a screen is reached through signed links that expire after 30
// minutes. Screens reloaded on navigation focus, and returning from the
// background is not a focus change — so a Moments timeline or a journal page left
// open overnight showed black videos, silent voice notes and "missing" photos,
// and "Today" still meant yesterday.
import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';

/** Links are signed for 30 minutes; refresh a little before that. */
export const STALE_AFTER_MS = 25 * 60 * 1000;

export function useStaleOnReturn(refresh: () => void, afterMs = STALE_AFTER_MS): { markFresh: () => void } {
  const freshAt = useRef(Date.now());
  const run = useRef(refresh);
  run.current = refresh;
  useEffect(() => {
    let wentAway = Date.now();
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') { wentAway = Date.now(); return; }
      const now = Date.now();
      const crossedMidnight = new Date(wentAway).toDateString() !== new Date(now).toDateString();
      if (now - freshAt.current > afterMs || crossedMidnight) run.current();
    });
    return () => sub.remove();
  }, [afterMs]);
  const markFresh = useCallback(() => { freshAt.current = Date.now(); }, []);
  return { markFresh };
}

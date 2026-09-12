// Run something AFTER a modal has finished going away.
//
// iOS will not present a view controller from one that is already presenting,
// and it does not queue the request — it drops it. So a sheet that answers a tap
// by opening the camera, the photo library, a document picker or a share sheet
// opens nothing at all: the promise never settles, and whatever spinner was
// switched on stays on. "It says Uploading and nothing happens" is this, and so
// was the journal's delete, and so was Cancel session.
//
// `Modal` has an `onDismiss` callback for exactly this, but only on iOS. So the
// rule lives here: hold the action until the sheet is gone, then run it — on
// iOS when the dismissal actually completes, elsewhere on the next frame, which
// is enough where nothing is being presented natively.
import { useCallback, useRef } from 'react';
import { InteractionManager, Platform } from 'react-native';

export interface AfterDismiss {
  /** Remember what to do, then close the sheet yourself. */
  hold: (run: () => void) => void;
  /** Wire to <Modal onDismiss>. Runs whatever was held. */
  fire: () => void;
}

/** Longer than the sheet's own animation, short enough not to feel like a
 *  hang. Only reached if `onDismiss` never arrives. */
const SAFETY_MS = 700;

/** A `Modal`'s own slide animation, which Android gives no callback for. */
const SHEET_MS = 320;

export function useAfterDismiss(): AfterDismiss {
  const pending = useRef<(() => void) | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fire = useCallback(() => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    const run = pending.current;
    pending.current = null;
    if (run) run();
  }, []);

  const hold = useCallback(
    (run: () => void) => {
      pending.current = run;
      // Android and web have no `onDismiss` and no presentation rule to satisfy,
      // so the action would work whenever it ran. It still waits: on Android
      // `runAfterInteractions` resolves the moment no gesture is pending, which
      // is while the sheet is still sliding away — the camera then opens over a
      // half-dismissed sheet and the two animations fight. A sheet's slide is
      // ~300ms, so the wait is the sheet's own length rather than a frame.
      if (Platform.OS !== 'ios') {
        InteractionManager.runAfterInteractions(() => setTimeout(fire, Platform.OS === 'android' ? SHEET_MS : 0));
        return;
      }
      // And if `onDismiss` never comes, the tap must still do something. A
      // second `fire` is a no-op, so the two cannot both run the action.
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(fire, SAFETY_MS);
    },
    [fire],
  );

  return { hold, fire };
}

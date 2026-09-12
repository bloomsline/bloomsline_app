// Android's back button, for screens that have somewhere of their own to go.
//
// A phone with no back button taught us to put a chevron in the header, and
// that is the only way back through most of this app. On Android the system
// back button is the one people actually use, and by default it pops the whole
// ROUTE — so a screen holding several steps in its own state loses the lot. On
// Capture that is a written note, a photograph and a voice recording, gone with
// one press and no warning. Nothing on the screen suggests that could happen.
//
// So any screen with a step, an open sheet, or anything else it would rather
// close first claims the button while that is true, and hands it back when it
// is not. `false` means "I did nothing with it" — the route pops as usual, and
// no screen has to reimplement leaving.
//
// iOS and web have no such button and no listener to add; the hook is inert
// there, so it can be called unconditionally.
import { useEffect } from 'react';
import { BackHandler, Platform } from 'react-native';

/**
 * @param handler Return true if you handled the press. Return false to let the
 *   screen close the way it normally would.
 * @param enabled Skip the listener entirely — for a screen that is not focused,
 *   or a step where the default is right.
 */
export function useAndroidBack(handler: () => boolean, enabled = true): void {
  useEffect(() => {
    if (Platform.OS !== 'android' || !enabled) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', handler);
    return () => sub.remove();
  }, [handler, enabled]);
}

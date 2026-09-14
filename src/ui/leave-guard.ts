// Stop a screen being left while leaving would lose something.
//
// A screen that keeps writing — a journal page, a worksheet — saved as it went,
// and when a save failed it said so in a corner and let the patient walk away.
// The writing then existed only in a component that was about to unmount. This
// holds EVERY way out — the header chevron, Android's back button, the iOS swipe
// — so the screen gets one chance to finish (save, then leave) or to ask.
//
// `onAttempt` is handed `leave`, which completes exactly the navigation that was
// held. Calling it is always allowed: the navigator does not ask this screen
// twice about the same action.
import { useRef } from 'react';
import { usePreventRemove, useNavigation } from '@react-navigation/native';

export function useLeaveGuard(when: boolean, onAttempt: (leave: () => void) => void | Promise<void>): { release: () => void } {
  const navigation = useNavigation();
  // Some ways out are deliberate and must not be held: deleting the page is one.
  const released = useRef(false);
  usePreventRemove(when, ({ data }) => {
    const leave = () => navigation.dispatch(data.action);
    if (released.current) { leave(); return; }
    void onAttempt(leave);
  });
  return { release: () => { released.current = true; } };
}

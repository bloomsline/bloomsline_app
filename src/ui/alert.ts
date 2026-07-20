import { Alert, Platform } from 'react-native';

// Cross-platform message alert.
//
// `Alert.alert` from react-native is a NO-OP on react-native-web. Every error
// path that used it was therefore silent in the browser: a failed sign-in
// looked like a button that did nothing, which is indistinguishable from a hang
// and impossible for a user to report usefully. It also cost real debugging
// time — a Google sign-in failure presented as "nothing happens".
//
// Destructive confirmations already branch on Platform.OS and use
// window.confirm, so they are not affected; this covers the single-message
// case only.

/** A message with a single dismiss. Native dialog on device, window.alert on web. */
export function notify(title: string, message?: string): void {
  if (Platform.OS === 'web') {
    const text = message ? `${title}\n\n${message}` : title;
    // globalThis.alert rather than window.alert: same call, but does not assume
    // a DOM global exists (SSR/prerender of the web build).
    globalThis.alert?.(text);
    return;
  }
  Alert.alert(title, message);
}

// Sign in with Apple where there is no Apple sheet: the web, and Android.
//
// `expo-apple-authentication` is an iOS-only native dialog, so everywhere else
// this hands off to Apple's OAuth flow in a browser and comes back through the
// same `/auth?token=…` door an emailed sign-in link uses. The server does the
// work (see `api/mobile/auth/apple/web`); this only opens the right window and
// knows where the answer should land.
//
// It is not parity for its own sake. Someone who signs up on an iPhone and picks
// "Hide My Email" has an `@privaterelay.appleid.com` address — so on the web the
// email-link fallback sends to a mailbox they may never read, and without this
// they cannot reach their own account at all.
import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { API_URL } from '@/src/config';

const startUrl = (target: 'web' | 'native') => `${API_URL}/api/mobile/auth/apple/web?target=${target}`;

/**
 * Open Apple's sign-in.
 *
 * On WEB this leaves the page: Apple refuses to render inside an iframe, and a
 * popup would be eaten by every blocker. The app comes back at `/auth?token=…`
 * and finishes there, which is the one screen that already knows how.
 *
 * On ANDROID it opens the system auth browser and waits for the redirect back
 * into `bloomsline://auth`. The caller does nothing with the result: the deep
 * link is what carries the token, and the router takes it from there.
 */
export async function appleWebSignIn(): Promise<void> {
  if (Platform.OS === 'web') {
    globalThis.location?.assign(startUrl('web'));
    return;
  }
  // `openAuthSessionAsync` and not `openBrowserAsync`: it is the one that closes
  // itself when the redirect fires, and on Android it keeps the flow in a Custom
  // Tab where the person can see the appleid.apple.com address bar — which is
  // the whole reason to trust a sign-in page.
  await WebBrowser.openAuthSessionAsync(startUrl('native'), 'bloomsline://auth').catch(() => undefined);
}

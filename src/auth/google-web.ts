// Sign in with Google on ANDROID, through our own server.
//
// Everywhere else the app does the whole thing itself with expo-auth-session:
// PKCE in the system browser, an id_token posted to the backend, no secret on
// the device. That is the better flow and it stays in place on iOS and the web.
//
// Android could not have it. The same code against a properly configured Android
// OAuth client — package name plus the signing certificate's SHA-1, redirecting
// to `com.bloomsline.app:/oauthredirect`, which is Google's own documented shape
// for an installed app — is answered with `Error 400: invalid_request` before
// the consent screen appears at all.
//
// So Android takes the road Apple already uses on that platform: open the server
// in the system browser, let it run the flow against our web client, and come
// back through `bloomsline://auth?token=…`. The router finishes from there, the
// same way it finishes an emailed sign-in link. See `api/mobile/auth/google/web`.
import * as WebBrowser from 'expo-web-browser';
import { API_URL } from '@/src/config';

/**
 * Open Google's sign-in. The caller does nothing with the result: the deep link
 * is what carries the token, and the router takes it from there.
 *
 * `openAuthSessionAsync` and not `openBrowserAsync`: it is the one that closes
 * itself when the redirect fires, and it keeps the flow in a Custom Tab where
 * the person can see the accounts.google.com address bar, which is the whole
 * reason to trust a sign-in page.
 */
export async function googleWebSignIn(): Promise<void> {
  await WebBrowser.openAuthSessionAsync(`${API_URL}/api/mobile/auth/google/web?target=native`, 'bloomsline://auth').catch(() => undefined);
}

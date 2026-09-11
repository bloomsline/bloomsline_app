// Sign in with Apple, iOS only, through the native sheet (expo-apple-authentication).
//
// Required by App Review 4.8 because the app offers Google and Microsoft: any
// app with a third-party login must offer Apple's too. The backend verifies the
// identity token (/api/mobile/auth/apple); we never see Apple's credentials.
//
// The nonce: we keep a random value, hand Apple its SHA-256, and send the raw
// value to our server, which checks the token carries the hash. A token lifted
// from one sign-in therefore cannot be replayed into another.
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { useAuth, type SignInResult } from './auth-context';

export function useAppleSignIn() {
  const { signInWithApple } = useAuth();
  // Apple's sheet exists on iOS 13+ only, and nowhere else. Asked of the
  // device rather than assumed from the platform.
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    AppleAuthentication.isAvailableAsync().then(setAvailable).catch(() => setAvailable(false));
  }, []);

  /** Resolves null when the person cancelled the sheet: nothing to report. */
  const signIn = async (): Promise<SignInResult | null> => {
    const rawNonce = Crypto.randomUUID();
    const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
    let credential: AppleAuthentication.AppleAuthenticationCredential;
    try {
      credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });
    } catch (e) {
      if ((e as { code?: string })?.code === 'ERR_REQUEST_CANCELED') return null;
      return { ok: false };
    }
    if (!credential.identityToken) return { ok: false };
    return signInWithApple({
      identityToken: credential.identityToken,
      nonce: rawNonce,
      authorizationCode: credential.authorizationCode,
      givenName: credential.fullName?.givenName ?? null,
      familyName: credential.fullName?.familyName ?? null,
    });
  };

  return { available, signIn };
}

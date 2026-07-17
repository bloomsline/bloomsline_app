// Native Google sign-in via expo-auth-session. Opens Google in the system
// browser (PKCE), and returns an id_token we hand to the backend
// (/api/mobile/auth/google) — we never see Google's client secret. The backend
// verifies the id_token's signature + audience.
//
// Requires the Google OAuth client ids in config (EXPO_PUBLIC_GOOGLE_*). If they
// are unset, `request` is null and the button should be hidden/disabled.
import { useEffect } from 'react';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { GOOGLE } from '../config';
import { useAuth } from './auth-context';

WebBrowser.maybeCompleteAuthSession();

export function useGoogleSignIn(onError?: (message: string) => void) {
  const { signInWithGoogleIdToken } = useAuth();

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: GOOGLE.webClientId || undefined,
    iosClientId: GOOGLE.iosClientId || undefined,
    androidClientId: GOOGLE.androidClientId || undefined,
  });

  useEffect(() => {
    if (response?.type === 'success') {
      const idToken = response.params?.id_token ?? response.authentication?.idToken;
      if (idToken) {
        signInWithGoogleIdToken(idToken).then((ok) => {
          if (!ok) onError?.('Google sign-in was rejected. Please try again.');
        });
      } else {
        onError?.('Google did not return an identity token.');
      }
    } else if (response?.type === 'error') {
      onError?.('Google sign-in failed.');
    }
  }, [response, signInWithGoogleIdToken, onError]);

  return {
    available: request !== null,
    signIn: () => promptAsync(),
  };
}

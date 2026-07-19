// Native Microsoft (Entra) sign-in via expo-auth-session. Opens Microsoft in the
// system browser (PKCE code flow), exchanges the code for an id_token, and hands
// that to the backend (/api/mobile/auth/microsoft) — we never hold a client
// secret. The backend verifies the token's signature + issuer + audience.
//
// Requires EXPO_PUBLIC_MICROSOFT_CLIENT_ID (+ tenant). If unset, `available` is
// false and the button should be hidden.
import { useEffect } from 'react';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { MICROSOFT } from '../config';
import { useAuth } from './auth-context';

WebBrowser.maybeCompleteAuthSession();

export function useMicrosoftSignIn(onError?: (message: string) => void) {
  const { signInWithMicrosoftIdToken } = useAuth();
  const discovery = AuthSession.useAutoDiscovery(`https://login.microsoftonline.com/${MICROSOFT.tenant}/v2.0`);
  const redirectUri = AuthSession.makeRedirectUri({ scheme: 'bloomsline' });

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: MICROSOFT.clientId || 'unset',
      scopes: ['openid', 'profile', 'email'],
      redirectUri,
      responseType: AuthSession.ResponseType.Code,
      usePKCE: true,
    },
    discovery,
  );

  useEffect(() => {
    if (response?.type !== 'success' || !discovery) {
      if (response?.type === 'error') onError?.('Microsoft sign-in failed.');
      return;
    }
    const code = response.params?.code;
    if (!code) {
      onError?.('Microsoft did not return an authorization code.');
      return;
    }
    AuthSession.exchangeCodeAsync(
      { clientId: MICROSOFT.clientId, code, redirectUri, extraParams: { code_verifier: request?.codeVerifier ?? '' } },
      discovery,
    )
      .then((token) => {
        if (token.idToken) {
          signInWithMicrosoftIdToken(token.idToken).then((ok) => {
            if (!ok) onError?.('Microsoft sign-in was rejected.');
          });
        } else {
          onError?.('Microsoft did not return an identity token.');
        }
      })
      .catch(() => onError?.('Microsoft sign-in failed.'));
  }, [response, discovery, redirectUri, request, signInWithMicrosoftIdToken, onError]);

  return {
    available: request !== null && Boolean(MICROSOFT.clientId),
    signIn: () => promptAsync(),
  };
}

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
import { signInMessage } from './sign-in-message';
import { useI18n } from '@/src/i18n';

WebBrowser.maybeCompleteAuthSession();

export function useMicrosoftSignIn(onError?: (message: string) => void) {
  const { t } = useI18n();
  const { signInWithMicrosoftIdToken } = useAuth();
  const discovery = AuthSession.useAutoDiscovery(`https://login.microsoftonline.com/${MICROSOFT.tenant}/v2.0`);
  // `native` is used ONLY by standalone/bare builds; web falls through to
  // Linking.createURL(''), which stays `https://app.bloomsline.com`.
  //
  // The path is not decoration. Azure refuses to register a bare `bloomsline://`
  // ("Must be a valid URI"), so the native redirect needs a path — and giving it
  // one here, rather than via `path`, keeps the WEB uri unchanged. Passing
  // `path: 'auth'` would have moved web to `https://app.bloomsline.com/auth`,
  // which is the MAGIC-LINK handler (`/auth?token=…`) — pointing the OAuth
  // redirect at it would land two different sign-in flows on one screen.
  //
  // Register in the app registration:
  //   Single-page application     https://app.bloomsline.com
  //   Mobile and desktop apps     bloomsline://auth
  const redirectUri = AuthSession.makeRedirectUri({
    scheme: 'bloomsline',
    native: 'bloomsline://auth',
  });

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
      if (response?.type === 'error') onError?.(t.signUp.providerRejected);
      return;
    }
    const code = response.params?.code;
    if (!code) {
      onError?.(t.signUp.providerRejected);
      return;
    }
    AuthSession.exchangeCodeAsync(
      { clientId: MICROSOFT.clientId, code, redirectUri, extraParams: { code_verifier: request?.codeVerifier ?? '' } },
      discovery,
    )
      .then((token) => {
        if (token.idToken) {
          signInWithMicrosoftIdToken(token.idToken).then((r) => {
            if (!r.ok) onError?.(signInMessage(r, t, t.signUp.providerRejected));
          });
        } else {
          onError?.(t.signUp.providerRejected);
        }
      })
      .catch(() => onError?.(t.signUp.providerRejected));
  }, [response, discovery, redirectUri, request, signInWithMicrosoftIdToken, onError, t]);

  return {
    available: request !== null && Boolean(MICROSOFT.clientId),
    signIn: () => promptAsync(),
  };
}

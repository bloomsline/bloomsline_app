import { Platform } from 'react-native';
// Runtime config. Set these in a `.env` (Expo reads EXPO_PUBLIC_* at build time)
// or via EAS env. Never put secrets here — only the public API base + the Google
// OAuth *client ids* (which are public identifiers, not secrets).

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

// iOS App Transport Security + Android (release) block cleartext HTTP, so a
// non-HTTPS API only fails once you make a native build — confusingly. Warn loudly
// in dev. localhost is exempt (used by the iOS simulator against a local backend).
const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1|10\.0\.2\.2)(:|\/|$)/.test(API_URL);
if (__DEV__ && !API_URL.startsWith('https://') && !isLocal) {
  console.warn(
    `[config] EXPO_PUBLIC_API_URL is not https (${API_URL}). Native iOS/Android release builds block cleartext HTTP — use an https backend (production) or a tunnel for device testing.`,
  );
}

// Google OAuth client ids (from Google Cloud Console). The iOS id differs from
// the web one; the backend must trust it via AUTH_GOOGLE_MOBILE_IDS.
//
// There is no Android id, and that is not an oversight. One was created,
// correctly — package name plus the signing certificate's SHA-1, redirecting to
// `com.bloomsline.app:/oauthredirect`, which is Google's own documented shape
// for an installed app — and Google answered every request with `Error 400:
// invalid_request` before the consent screen was ever drawn. Android goes
// through our server instead (`auth/google-web.ts`), which uses the WEB client.
export const GOOGLE = {
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '',
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '',
};

// Per PLATFORM, not "any id at all". The Google hook throws on a platform
// whose own client id is missing, so a web-only id used to mark Google as
// configured on iOS, where opening the sign-in screen would have crashed on the
// first real device build.
//
// Android asks about the WEB id because that is the client its flow actually
// uses — the server holds the secret and runs the exchange. The app itself needs
// no Google id on Android at all.
export const googleConfigured =
  Platform.OS === 'ios' ? Boolean(GOOGLE.iosClientId) : Boolean(GOOGLE.webClientId);

// Microsoft (Entra ID). `tenant` should be 'common'.
//
// The advice here used to be "pin it — the backend only trusts a pinned tenant",
// and it was followed: .env.production carried our directory GUID. That sends
// the authorize request to our own directory's endpoint, so Microsoft demands
// the user exist THERE and refuses every personal account (hotmail, outlook,
// live) with AADSTS50020 — before any token is issued, so nothing on our side
// ever sees it.
//
// The backend has not needed a pinned tenant for some time: its issuer is
// `common`, and microsoftEmailTrusted() accepts either an `xms_edov` assertion
// or Microsoft's own consumer tenant, read from the signature-verified `tid`.
//
// clientId = the native app registration; the backend must trust it via
// AUTH_MICROSOFT_MOBILE_IDS.
export const MICROSOFT = {
  clientId: process.env.EXPO_PUBLIC_MICROSOFT_CLIENT_ID ?? '',
  tenant: process.env.EXPO_PUBLIC_MICROSOFT_TENANT ?? 'common',
};
export const microsoftConfigured = Boolean(MICROSOFT.clientId);

// Dev-only: EXPO_PUBLIC_MOCK_AUTH=1 makes the sign-in buttons succeed locally
// with no backend, so the full flow can be clicked through for design review.
// Never set this in a production build.
export const MOCK_AUTH = process.env.EXPO_PUBLIC_MOCK_AUTH === '1';

// Dev-only: with MOCK_AUTH, which role to sign in as — 'practitioner' or
// 'member' (default). Lets us preview both apps without a backend.
export const MOCK_ROLE = process.env.EXPO_PUBLIC_MOCK_ROLE === 'practitioner' ? 'practitioner' : 'member';

// Dev-only: preview the connected My Care hub (Flow C) even without a linked
// practitioner. Without it, a solo account sees the "connect a practitioner"
// state instead. For design review only.
export const FORCE_CARE_HUB = process.env.EXPO_PUBLIC_FORCE_CARE_HUB === '1';

// Sign in with Apple on the WEB and on Android, through Apple's OAuth flow
// rather than the iOS sheet. Gated on its own flag because it needs a Services
// ID and a verified domain on the server: a button drawn without them sends
// someone to a 404 at Apple, which is worse than not offering it.
//
// iOS is excluded here even when the flag is on — it has the native sheet, and
// two ways in on one platform is a choice nobody asked to make.
export const appleWebConfigured =
  Platform.OS !== 'ios' && process.env.EXPO_PUBLIC_APPLE_WEB_SIGNIN === '1';

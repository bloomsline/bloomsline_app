// Runtime config. Set these in a `.env` (Expo reads EXPO_PUBLIC_* at build time)
// or via EAS env. Never put secrets here — only the public API base + the Google
// OAuth *client ids* (which are public identifiers, not secrets).

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

// Practitioners run their practice on the web, not this app. The welcome screen
// offers them a quiet link there.
export const PRACTITIONER_WEB_URL = process.env.EXPO_PUBLIC_PRACTITIONER_URL ?? 'https://bloomsline.care';

// iOS App Transport Security + Android (release) block cleartext HTTP, so a
// non-HTTPS API only fails once you make a native build — confusingly. Warn loudly
// in dev. localhost is exempt (used by the iOS simulator against a local backend).
const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1|10\.0\.2\.2)(:|\/|$)/.test(API_URL);
if (__DEV__ && !API_URL.startsWith('https://') && !isLocal) {
  console.warn(
    `[config] EXPO_PUBLIC_API_URL is not https (${API_URL}). Native iOS/Android release builds block cleartext HTTP — use an https backend (production) or a tunnel for device testing.`,
  );
}

// Google OAuth client ids (from Google Cloud Console). The mobile ids differ
// from the web one; the backend must trust them via AUTH_GOOGLE_MOBILE_IDS.
export const GOOGLE = {
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '',
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '',
  androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? '',
};

export const googleConfigured = Boolean(GOOGLE.webClientId || GOOGLE.iosClientId || GOOGLE.androidClientId);

// Dev-only: EXPO_PUBLIC_MOCK_AUTH=1 makes the sign-in buttons succeed locally
// with no backend, so the full flow can be clicked through for design review.
// Never set this in a production build.
export const MOCK_AUTH = process.env.EXPO_PUBLIC_MOCK_AUTH === '1';

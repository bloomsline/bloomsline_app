// Runtime config. Set these in a `.env` (Expo reads EXPO_PUBLIC_* at build time)
// or via EAS env. Never put secrets here — only the public API base + the Google
// OAuth *client ids* (which are public identifiers, not secrets).

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

// Google OAuth client ids (from Google Cloud Console). The mobile ids differ
// from the web one; the backend must trust them via AUTH_GOOGLE_MOBILE_IDS.
export const GOOGLE = {
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '',
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '',
  androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? '',
};

export const googleConfigured = Boolean(GOOGLE.webClientId || GOOGLE.iosClientId || GOOGLE.androidClientId);

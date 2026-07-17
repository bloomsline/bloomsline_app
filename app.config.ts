import type { ConfigContext, ExpoConfig } from 'expo/config';

// Dynamic config layered on top of app.json. Its job is the native bits that
// can't be static:
//
//  1. Google sign-in on iOS REQUIRES the reversed-client-id URL scheme in
//     CFBundleURLTypes, or the OAuth redirect never comes back and sign-in
//     silently hangs in a real build. We derive it from the iOS client id so
//     there's nothing to hand-edit in Info.plist.
//  2. ITSAppUsesNonExemptEncryption=false so TestFlight/App Store builds skip
//     the export-compliance prompt (we only use standard HTTPS).
//
// '<id>.apps.googleusercontent.com' -> URL scheme 'com.googleusercontent.apps.<id>'
function googleIosScheme(): string | null {
  const id = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '';
  const m = id.match(/^(.+)\.apps\.googleusercontent\.com$/);
  return m ? `com.googleusercontent.apps.${m[1]}` : null;
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const gScheme = googleIosScheme();
  const iosUrlTypes = gScheme ? [{ CFBundleURLSchemes: [gScheme] }] : [];

  return {
    ...config,
    name: config.name ?? 'Bloomsline',
    slug: config.slug ?? 'bloomsline-mobile-v2',
    ios: {
      ...config.ios,
      infoPlist: {
        ...(config.ios?.infoPlist ?? {}),
        ITSAppUsesNonExemptEncryption: false,
        ...(iosUrlTypes.length ? { CFBundleURLTypes: iosUrlTypes } : {}),
      },
    },
  };
};

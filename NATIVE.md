# Going native: iOS + Android builds

This app is written in the Expo **managed workflow**, so it compiles to real
native iOS (`.ipa`) and Android (`.aab`) binaries via **EAS Build** — no
ejecting. This checklist is what turns the foundation into store-ready apps.

## What already works in a native build
- **Email-code sign-in** — pure HTTPS, zero native config. Works the moment you
  point `EXPO_PUBLIC_API_URL` at an HTTPS backend.
- `expo-secure-store` (Keychain/Keystore), `expo-router`, the API client with
  token refresh — all config-plugin based, so they build natively as-is.
- New Architecture is on (`newArchEnabled`), which every dependency here supports.

## One-time setup
1. **Install EAS + log in**
   ```bash
   npm i -g eas-cli
   eas login
   eas init            # creates the EAS project + writes the projectId
   ```
2. **Accounts** (needed to submit, not to build):
   - Apple: Apple Developer Program ($99/yr) — deferred until launch per the plan.
   - Google: Play Console ($25 one-time).
3. **Bundle ids are already set**: iOS `com.bloomsline.app`, Android `com.bloomsline.app`.

## Build
```bash
eas build --profile preview     --platform all   # internal test builds
eas build --profile production  --platform all   # store builds (.ipa / .aab)
```
Profiles live in `eas.json`. `production` auto-increments the build number
(`appVersionSource: remote`), so you never hand-bump `buildNumber`/`versionCode`.

## Google sign-in native config (the part that silently breaks)
The web OAuth client is NOT enough for a native app.
1. In Google Cloud Console create **iOS** and **Android** OAuth client ids
   (plus the existing Web one).
   - iOS client: bundle id `com.bloomsline.app`.
   - Android client: package `com.bloomsline.app` + the **SHA-1** of the signing
     key. Get it from EAS: `eas credentials` → Android → keystore → SHA-1.
2. Set the client ids as env (EAS secrets or `.env`):
   `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`,
   `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`.
3. **iOS URL scheme is handled for you**: `app.config.ts` derives the reversed
   client id (`com.googleusercontent.apps.<id>`) from the iOS client id and adds
   it to `CFBundleURLTypes` at build time — no Info.plist editing.
4. On the **backend**, trust the native client ids:
   set `AUTH_GOOGLE_MOBILE_IDS` (comma-separated) to the iOS + Android client ids.

Until these exist, the Google button hides itself (`googleConfigured`) and email
sign-in carries the app.

## HTTPS is mandatory (ATS / cleartext)
iOS App Transport Security and Android release builds **block plaintext HTTP**.
- **Production**: `EXPO_PUBLIC_API_URL` must be `https://…` (Scalingo already is).
- **Device testing against a local backend**: use a tunnel (e.g. an https dev
  URL) — `http://<LAN-ip>` will fail on a real device. The iOS *simulator* can
  use `http://localhost:3000`; the Android *emulator* uses `http://10.0.2.2:3000`.
- `src/config.ts` warns in dev if the URL is non-HTTPS and not localhost.

## Permissions (add WHEN the capture feature ships, not before)
Apple rejects apps that declare unused permissions, so these are intentionally
absent until the Moments capture screens exist. When they do, add to
`app.config.ts` → `ios.infoPlist` / `android.permissions`:
- Camera — `NSCameraUsageDescription` / `android.permission.CAMERA`
- Microphone (voice notes) — `NSMicrophoneUsageDescription` / `RECORD_AUDIO`
- Photo library — `NSPhotoLibraryUsageDescription`
Plus the Expo config plugins for `expo-image-picker` / `expo-av` (or their SDK 55
successors) with the usage strings.

## Assets before store submission
Add real `assets/` (icon 1024², adaptive icon, splash) and reference them in
`app.json`. Placeholder-free assets are a store requirement.

## Submit
```bash
eas submit --profile production --platform ios       # -> App Store Connect / TestFlight
eas submit --profile production --platform android   # -> Play Console
```

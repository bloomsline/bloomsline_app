# Bloomsline Mobile (v2)

The HDS-native patient app (Expo / React Native). It authenticates against the
Bloomsline backend's first-party token endpoints and talks to the Moments REST
API — it holds **no database and no Supabase**; PHI lives on the backend.

## Stack
- Expo SDK 55 · expo-router (file-based) · React 19 / RN 0.83 · TypeScript
- `expo-secure-store` for tokens · `expo-auth-session` for Google · plain
  `StyleSheet` for now (add NativeWind when porting the designed screens)

## What's here (Slice C foundation)
The **auth + API vertical**, ready for the designed screens to plug into:

- `src/auth/token-store.ts` — access/refresh tokens in the Keychain/Keystore.
- `src/auth/api.ts` — `apiFetch()`: attaches the Bearer token and, on a 401,
  single-flight **rotates** the refresh token and retries; hard failure signs out.
- `src/auth/auth-context.tsx` — session state + email-OTP / Google / sign-out.
- `src/auth/google.ts` — Google sign-in (PKCE) → `id_token` → backend.
- `app/` — `sign-in` (email code + Google) → `verify` → protected `(app)/home`,
  which proves the vertical by calling `GET /api/moments` with the token.

The **email code flow works out of the box**. Google needs OAuth client ids
(below).

## Run
```bash
npm install
# Expo pins compatible native versions:
npx expo install --fix
cp .env.example .env   # set EXPO_PUBLIC_API_URL to your backend
npm start
```

## Backend endpoints this app uses
- `POST /api/mobile/auth/magic-link/start` · `/verify`
- `POST /api/mobile/auth/google`
- `POST /api/mobile/auth/refresh` · `/logout`
- `GET  /api/moments` (and the rest of `/api/moments/*`)

## Config
| Env | Purpose |
|-----|---------|
| `EXPO_PUBLIC_API_URL` | Backend base URL (see `.env.example` for sim/emulator/device notes) |
| `EXPO_PUBLIC_GOOGLE_*_CLIENT_ID` | Google OAuth client ids; the backend must trust the mobile ones via `AUTH_GOOGLE_MOBILE_IDS` |

## Next
Port the cloud-design screens (Home / capture wizard / Today's Flow / Your Day)
on top of this foundation; add NativeWind if the designs are Tailwind-based.

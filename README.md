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

## Styling
**NativeWind** (Tailwind for RN). The design tokens from the Claude Design
canvas live in `tailwind.config.js` (`brand`/`ink`/`muted`/`surface`/`mint`/…);
`src/ui/theme.ts` holds the same values for gradients. Shared primitives are in
`src/ui/` (Button, Field, Screen, ProgressBar, SunriseHero).

## Signup flow (implemented from the Claude design)
Two branches, driven by whether the signup email matched a practitioner invite:
- **Flow A — invited:** welcome → sign-up → verify → name → arrival (you're
  connected to your practitioner) → privacy promise → home.
- **Flow B — solo:** welcome → sign-up → verify → arrival (yours alone) →
  privacy promise → first check-in → home.

Auth steps are wired to the backend (`/api/mobile/auth/*`). The A/B branch,
name persistence, and consent use `src/api/me.ts` → `/api/mobile/me`, which is
**not built backend-side yet** — until it is, the flow defaults to solo and the
calls no-op. Set `EXPO_PUBLIC_FORCE_FLOW=a|b` (see `.env.example`) to preview a
branch. State machine: `src/auth/auth-context.tsx` (anon→onboarding→authed) +
`src/onboarding/context.tsx`.

## Next
Wire the `/api/mobile/me` backend endpoint (care repo); build the section flows
(My Care / Moments / Journal / Library) on this foundation.

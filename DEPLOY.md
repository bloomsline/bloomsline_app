# Deploying the patient web app (staging / "test in real")

The patient app runs as a **static web SPA** (`output: single`), pointed at the
production care backend. This gets a real URL to test the full onboarding loop
with **no app store and no Apple account**. (Native builds via EAS/TestFlight are
a separate, later path.)

## What's already prepared
- `.env.production` — prod config: `EXPO_PUBLIC_API_URL=https://bloomsline.osc-fr1.scalingo.io`, OAuth client ids, all dev flags emptied. Loaded automatically on a Vercel/Netlify build (the dev `.env` is gitignored, so it's absent there).
- `vercel.json` — build = `expo export -p web`, output = `dist`, SPA rewrites.

## Deploy (Vercel — free)
1. In Vercel, **Import Project** → the GitHub repo `bloomsline/bloomsline_app` → branch `feat/signup-flow` (or merge to `main` first).
2. Vercel reads `vercel.json`; **no extra settings needed**. Deploy.
3. You get a URL like `https://bloomsline-app.vercel.app`.

(Netlify equivalent: build `npx expo export -p web`, publish dir `dist`, add an SPA redirect `/* /index.html 200`.)

## Two settings on the care backend (Scalingo) so the web app can talk to it
The patient web calls `/api/mobile/*` on the backend **from a browser**, so prod
CORS must allow its origin, and invite emails should link to it:
1. `MOBILE_WEB_ORIGINS = https://bloomsline-app.vercel.app` (the deployed URL) — allows CORS.
2. `PATIENT_APP_URL = https://bloomsline-app.vercel.app` — where invite emails point.

Redeploy/restart the care app after setting these.

## OAuth (optional)
Email sign-in works out of the box. For **Google/Microsoft** sign-in on the web
app, add `https://bloomsline-app.vercel.app` as an authorized redirect URI in the
Google Cloud + Azure app registrations (same as `http://localhost:8081` was for dev).

## Local production build check
    EXPO_PUBLIC_API_URL=https://bloomsline.osc-fr1.scalingo.io npx expo export -p web
    # → dist/ (index.html + _expo/), serve with any static host

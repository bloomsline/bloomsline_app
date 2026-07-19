# Deploying the patient app (Scalingo, production web)

The patient app ships as a **static web SPA** (Expo `output: single`) served on
Scalingo, pointed at the production care backend. Same platform as the backend,
no app store, no Apple account. (Native iOS/Android via EAS is a separate path.)

## What's prepared (in this repo)
- `package.json` → `build: expo export -p web`, `serve:web: serve -s dist -l tcp://0.0.0.0:$PORT`; `serve` is a runtime dependency.
- `Procfile` → `web: npm run serve:web`.
- `scalingo.json` → app name + the required env.
- `.env.production` → `EXPO_PUBLIC_API_URL=https://platform.bloomsline.com` + public OAuth client ids, dev flags emptied. Loaded automatically on the Scalingo build (the gitignored `.env` is absent there).

## Create the Scalingo app
1. **New app** → e.g. `bloomsline-app`, region **osc-fr1** (same as the backend). **No database add-on** — this app is stateless (it just serves static files).
2. **Environment** → set **`NPM_CONFIG_PRODUCTION=false`** ⚠️ *(required — the build tools `expo`/`metro` are devDependencies; without this they won't install and the build fails. The buildpack prunes them from the runtime slug afterwards.)* `EXPO_PUBLIC_API_URL` is already baked from `.env.production`, but you can override it here.
3. **Code** → link GitHub `bloomsline/bloomsline_app`, auto-deploy the branch you want (`main` after merging, or `feat/signup-flow`).
4. **Deploy.** The buildpack runs `npm run build` (→ `dist/`) then `web` serves it. Live at `https://member.bloomsline.com` (custom domain; the default
   `bloomsline-app.osc-fr1.scalingo.io` still works too).

## Then, on the CARE backend app (Scalingo), set two vars + redeploy
The patient web calls `/api/mobile/*` cross-origin, and invites should link to it:
- `MOBILE_WEB_ORIGINS = https://member.bloomsline.com` (CORS allow)
- `PATIENT_APP_URL = https://member.bloomsline.com` (invite link)

## OAuth (optional)
Email sign-in needs nothing extra. For Google/Microsoft on the web app, add
`https://member.bloomsline.com` as an authorized redirect URI in the
Google Cloud + Azure app registrations (as `http://localhost:8081` was in dev).

## Local production-build check
    EXPO_PUBLIC_API_URL=https://platform.bloomsline.com npm run build
    npm run serve:web    # serves dist/ as an SPA

<!-- Definition of Done for the Bloomsline mobile app. Don't delete items; check or strike-through with a reason. -->

## What & why
<!-- One-paragraph summary. Link the design / backend endpoint this touches. -->

## Definition of Done
- [ ] Typecheck + lint clean; `expo config` resolves the native config.
- [ ] No secrets committed — code/env hold only `EXPO_PUBLIC_*` public identifiers; tokens live only in `expo-secure-store`.
- [ ] No PHI in logs; auth/token handling reviewed if changed (Bearer + rotate-on-401 seam intact).
- [ ] Native implications considered — iOS/Android config, new permissions (with usage strings), ATS/HTTPS — see `NATIVE.md`.
- [ ] Backend contract matches (endpoint shapes under `/api/mobile/*` and `/api/moments/*`).
- [ ] CI gate green: typecheck · lint · config + secret-scan · SAST · audit.
- [ ] Dead code from this change removed.

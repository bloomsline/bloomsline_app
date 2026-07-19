# Scalingo Node buildpack. `npm run build` (expo export -p web → dist/) runs
# during the BUILD phase; `web` serves the static SPA on $PORT. The build tools
# (expo/metro) are devDependencies, so the app needs NPM_CONFIG_PRODUCTION=false
# set in its environment for them to install during the build.
web: npm run serve:web

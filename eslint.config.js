// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

// ── No white or black written by hand ────────────────────────────────────────
//
// Three separate bug reports in this app have had one cause: a colour hardcoded
// against an ASSUMED background. Nothing is ever mistyped, so the type system
// cannot see any of it — `#fff` compiles perfectly and then disappears on cream,
// and `rgba(255,255,255,0.12)` is a lift on the ground and a smear on paper.
//
// This is deliberately NARROW. It bans monochrome only: white and black, opaque
// or translucent. Those are the ones that break when the theme flips. A mood's
// hue, an amber warning, a brand green mean the same thing in both themes and
// are none of the rule's business — banning every colour literal flagged 611
// sites and would have been ignored within a week.
//
// It is also scoped to the properties that actually PAINT against a background.
// `shadowColor: '#000'` is fine and extremely common; a shadow has no contrast
// requirement.
//
// When a mark genuinely must not follow the theme, say so by name rather than
// by disabling the rule: `OVER_MEDIA` for things on a photograph, `RECORD` for
// the recording signal, `KNOB` for a switch knob, `slot` for a media
// placeholder. That keeps "deliberately white" and "forgot the theme" visually
// distinct in the code, which is the whole point.
const MONO =
  '/^(?:#(?:[fF]{3,4}|[fF]{6}|[fF]{8}|0{3,4}|0{6}|0{8})|rgba?\\(\\s*(?:255,\\s*255,\\s*255|0,\\s*0,\\s*0)\\s*[,)])/';
const PAINT_PROPS =
  '/^(?:backgroundColor|color|borderColor|borderTopColor|borderBottomColor|borderLeftColor|borderRightColor|tintColor|placeholderTextColor|selectionColor)$/';
const PAINT_ATTRS =
  '/^(?:color|fill|stroke|tintColor|placeholderTextColor|selectionColor)$/';

const MESSAGE =
  'Hardcoded white/black. Use a palette token from useTheme() — or, if this must NOT follow the theme, a named constant (OVER_MEDIA, RECORD, KNOB, slot) so the intent is visible.';

const noMonoLiterals = [
  { selector: `Property[key.name=${PAINT_PROPS}] > Literal[value=${MONO}]`, message: MESSAGE },
  { selector: `JSXAttribute[name.name=${PAINT_ATTRS}] > Literal[value=${MONO}]`, message: MESSAGE },
];

// Surfaces that are fixed by DESIGN, not by oversight. Each one is a place where
// following the palette would be the bug:
//
//   tokens.ts / theme.ts / care/theme.ts  the palettes themselves
//   onboarding + auth                     a photography-led, full-bleed flow with
//                                         its own `ED` palette: white type over
//                                         imagery behind a scrim, in both themes
//   MediaViewer                           a lightbox; always dark, like every one
//   resources/                            renders resource content in the CARE
//                                         palette to match the care web app
const BY_DESIGN = [
  'src/ui/tokens.ts',
  'src/ui/theme.ts',
  'src/care/theme.ts',
  'src/ui/MediaViewer.tsx',
  'src/onboarding/**/*.ts',
  'src/onboarding/**/*.tsx',
  'src/resources/**/*.ts',
  'src/resources/**/*.tsx',
  'app/auth.tsx',
  'app/(auth)/**/*.tsx',
  'app/(onboarding)/**/*.tsx',
];

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', '.expo/*', 'node_modules/*'],
  },
  {
    // Brace patterns like `{ts,tsx}` crash this minimatch build, so the
    // extensions are listed out.
    files: ['app/**/*.ts', 'app/**/*.tsx', 'src/**/*.ts', 'src/**/*.tsx'],
    rules: { 'no-restricted-syntax': ['error', ...noMonoLiterals] },
  },
  {
    files: BY_DESIGN,
    rules: { 'no-restricted-syntax': 'off' },
  },
]);

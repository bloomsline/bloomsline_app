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

// DESCENDANT, not direct child. The first version of this used `>` and quietly
// missed every conditional colour — `backgroundColor: selected ? teal : '#fff'`
// puts the literal inside a ConditionalExpression, so it is a grandchild of the
// property. That is precisely the selected/unselected pattern this class of bug
// lives in: it left white-on-white scale buttons in a worksheet while reporting
// the file clean.
//
// The third selector catches the literal that is HOISTED out of the style. Both
// selectors above look inside a paint property, so
//
//   const fg = variant === 'outline' ? TT.ink : '#fff';
//   ...
//   <Text style={{ color: fg }}>
//
// reported clean for months. By the time the literal reaches `color:` it is a
// variable, and by the time it is a literal it is in a VariableDeclarator that
// mentions no colour property at all. That is exactly how EdPill shipped a
// white label on a `ctaBg` that is pale in dark mode — a blank white pill.
//
// Deliberately the DIRECT init only. As a descendant, `VariableDeclarator
// Literal` matches every literal inside any arrow-function component assigned to
// a const — it swept up `shadowColor: '#000'` and the mode-branched tone maps
// the rule is explicitly not about. Direct-child also means the literal cannot
// be reached through a JSX branch, so `const dialog = open ? (<View .../>) :
// null` stays clean.
//
// A nested ternary hides from this, and that is the accepted edge: the ones in
// the app today all branch on `mode` and carry the contrast reasoning in a
// comment beside them, which is the thing the rule is asking for anyway.
const noMonoLiterals = [
  { selector: `Property[key.name=${PAINT_PROPS}] Literal[value=${MONO}]`, message: MESSAGE },
  { selector: `JSXAttribute[name.name=${PAINT_ATTRS}] Literal[value=${MONO}]`, message: MESSAGE },
  { selector: `VariableDeclarator > Literal[value=${MONO}]`, message: MESSAGE },
  { selector: `VariableDeclarator > ConditionalExpression > Literal[value=${MONO}]`, message: MESSAGE },
  { selector: `VariableDeclarator > LogicalExpression > Literal[value=${MONO}]`, message: MESSAGE },
];

// Surfaces that are fixed by DESIGN, not by oversight. Each one is a place where
// following the palette would be the bug:
//
//   tokens.ts / theme.ts / care/theme.ts  the palettes themselves
//   onboarding + auth                     a photography-led, full-bleed flow with
//                                         its own `ED` palette: white type over
//                                         imagery behind a scrim, in both themes
//   MediaViewer                           a lightbox; always dark, like every one
//
// `resources/` was on this list and should not have been. It renders resource
// and worksheet content in the CARE palette — but INSIDE the patient app, on
// the themed ground, where on dark every heading was near-black on near-black
// and every input a white slab. Exempted by reasoning, not by looking. It is
// enforced now, and its palette is mapped onto the theme.
const BY_DESIGN = [
  'src/ui/tokens.ts',
  'src/ui/theme.ts',
  'src/care/theme.ts',
  'src/ui/MediaViewer.tsx',
  'src/onboarding/**/*.ts',
  'src/onboarding/**/*.tsx',
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

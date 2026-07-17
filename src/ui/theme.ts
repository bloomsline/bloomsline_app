// Raw token values — matched to the v1 Bloomsline mobile app (lib/theme.ts).
// Same palette mirrored in tailwind.config.js for className styling.
export const C = {
  brand: '#4A9A86', // v1 "bloom" teal — the single warm accent (active/confirm/links/avatars)
  brandDeep: '#1A4A3F',
  mint: '#EAF4F1',
  mintBorder: '#D6E7E1',
  ink: '#1A1A1A', // primary text + the black CTA
  black: '#000000',
  muted: '#999999',
  mutedDark: '#8A8A8A',
  faint: '#BBBBBB',
  line: '#EBEBEB',
  lineSoft: '#E5E5E5',
  fill: '#F5F5F5', // chips, icon tiles, neutral surfaces
  surface: '#FFFFFF',
  disabled: '#E5E5E5',
  // sunrise hero (welcome)
  skyTop: '#FDEAD4',
  skyBottom: '#F7DBBF',
  sunGlow: '#FCCB90',
  sunGlow2: '#F3AF73',
  sunDisc: '#F4B078',
  hillBack: '#DCEAE2',
  hillFront: '#C6DDD2',
} as const;

// Vertical teal gradient used on the "arrival" hero (g5).
export const TEAL_GRADIENT = ['#5FAE9A', '#4A9A86', '#2F6E5F'] as const;
export const TEAL_GRADIENT_LOCS = [0, 0.46, 1] as const;

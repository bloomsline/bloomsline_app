// Raw token values from the Claude Design "Bloomsline Signup Flow" canvas — for
// places that can't take a Tailwind class (gradients, SVG-ish layered views).
// The same palette is mirrored in tailwind.config.js for className styling.
export const C = {
  brand: '#009B8E',
  brandDark: '#2F6E5F',
  brandDeep: '#1A4A3F',
  brandBody: '#3E7A6B',
  brandGlow: '#7EC7B5',
  gradTop: '#4E9C8A',
  mint: '#EAF4F1',
  mintBorder: '#D6E7E1',
  ink: '#1A1A1A',
  inkDeep: '#141414',
  muted: '#9A9A9A',
  mutedDark: '#8A8A8A',
  mutedWarm: '#8A857B',
  fine: '#AEAEAE',
  line: '#EBEBEB',
  fill: '#F5F5F5',
  surface: '#FAFAF8',
  white: '#FFFFFF',
  // sunrise hero
  skyTop: '#FDEAD4',
  skyBottom: '#F7DBBF',
  sunGlow: '#FCCB90',
  sunGlow2: '#F3AF73',
  sunDisc: '#F4B078',
  hillBack: '#DCEAE2',
  hillFront: '#C6DDD2',
} as const;

// Vertical teal gradient used on the "arrival" hero (g5).
export const TEAL_GRADIENT = ['#4E9C8A', '#009B8E', '#2F6E5F'] as const;
export const TEAL_GRADIENT_LOCS = [0, 0.46, 1] as const;

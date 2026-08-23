// One token set, two palettes.
//
// Before this, the app had EDA (light) and EDD (dark) as separate objects with
// DIFFERENT KEY NAMES — `canvas` vs `ground`, `ink` vs `text`. That is fine for
// two fixed themes and impossible for a switcher: nothing could ask "what is the
// page colour" without knowing which theme it was in.
//
// So the keys are unified here and each one carries a light and a dark value.
// EDA and EDD still exist at the bottom of this file, now DERIVED from these, so
// the ~35 screens already importing them keep working and cannot drift.
//
// Palette notes:
//   light  — warm cream, never grey. #F5F2EB rather than the old #F6F5F2: seven
//            points less blue, which is the difference between "off-white" and
//            "paper".
//   dark   — the ground the three patient tabs already stand on. Surfaces are
//            translucent white, not opaque grey, because Moments puts photography
//            behind them.
//   accent — deep green on light (4.5:1+ on cream), mint on dark. The same
//            lesson the care app learned: one green cannot do both jobs, because
//            the mint is 1.7:1 on white and the deep green vanishes on #0E1512.

export type Mode = 'light' | 'dark';

export interface Palette {
  /** Page background. */
  bg: string;
  /** Raised surface — cards, rows. */
  card: string;
  /** A sheet or dialog that rises OVER content, and therefore has to HIDE it.
   *
   *  Distinct from `card`, which is a surface lying on the page: on dark `card`
   *  is a 5% white wash, so a panel built from it is see-through and the page
   *  reads straight through the writing.
   *
   *  Fully opaque, and that is the point. This was 0.96 first, on the reasoning
   *  that a sheet is glass over what it covers — but 4% of a bright tab bar is
   *  still legible behind a delete button, which reads as a rendering fault
   *  rather than as depth. Depth comes from the scrim and the radius. */
  sheet: string;
  /** Card border. Hairline on light; a lift on dark, where shadows do nothing. */
  cardLine: string;
  /** Primary text. */
  ink: string;
  /** Secondary text. */
  inkSoft: string;
  /** Tertiary text, captions, timestamps.
   *
   *  The quietest tier that is still TEXT, which is the constraint people
   *  forget: quiet is a tone, not a licence to fall under the contrast floor.
   *  Both values clear 4.5:1 on their own page. */
  faint: string;
  /** Divider. */
  line: string;
  /** The accent: links, active states, the thing that is "ours". */
  accent: string;
  /** A pressed/deeper accent. */
  accentDeep: string;
  /** A wash of the accent, for tinted surfaces. */
  accentTint: string;
  /** Text and glyphs sitting ON the accent — never `#fff`.
   *
   *  This token exists because that mistake was made four separate times: the
   *  journal's new-page button, the shared-with avatar, the practitioner tabs
   *  and the session sheet's actions all drew white on `accent`. It is right on
   *  the deep green and 1.7:1 on the mint, so all four vanished in dark mode.
   *  Naming the relationship is what stops it happening a fifth time. */
  onAccent: string;
  /** The circular affordance — solid fill and the glyph on it. */
  circleBg: string;
  circleFg: string;
  /** A full-width primary CTA and its label. */
  ctaBg: string;
  ctaFg: string;
  /** Warning / attention. Never decorative. */
  amber: string;
  /** Something went wrong. The salmon that reads on the dark ground is 2.4:1 on
   *  cream, so this splits by theme like the accent does. */
  danger: string;
  /** Scrim behind a sheet. */
  scrim: string;
  /** A deliberately dark surface: media placeholders, a poster with no image.
   *  Stays dark in BOTH themes — it stands in for a photograph, and a pale
   *  placeholder reads as an empty box rather than a missing picture. */
  slot: string;
}

export const LIGHT: Palette = {
  bg: '#F5F2EB',
  card: '#FFFFFF',
  sheet: '#FFFFFF',
  cardLine: '#ECE8DF',
  ink: '#141414',
  inkSoft: '#5A5A52',
  // Was #9A9A90 — 2.54:1 on cream, under the floor even for large text, and
  // this is the tier every timestamp, caption and placeholder is written in.
  // #6F6F68 is the LIGHTEST value that clears 4.5:1 on the page (4.53:1; 5.06
  // on a card), chosen that way to keep as much of the intended softness as the
  // bar allows. Still clearly above inkSoft's 6.22:1, so the three tiers hold.
  faint: '#6F6F68',
  line: '#EAE8E2',
  accent: '#128069',
  accentDeep: '#0C5B4B',
  accentTint: '#E7F0EC',
  onAccent: '#FFFFFF',
  circleBg: '#1D1D1D',
  circleFg: '#FFFFFF',
  ctaBg: '#141414',
  ctaFg: '#FFFFFF',
  amber: '#B4750F',
  danger: '#B3261E',
  scrim: 'rgba(20,20,20,0.35)',
  slot: '#101210',
};

export const DARK: Palette = {
  bg: '#0E1512',
  card: 'rgba(255,255,255,0.055)',
  sheet: '#141A17',
  cardLine: 'rgba(255,255,255,0.10)',
  ink: '#FFFFFF',
  inkSoft: 'rgba(255,255,255,0.68)',
  // Raised from 0.40 for the same reason as the light value: 3.82:1 on the
  // ground, 3.75:1 on a card. A floor that only holds in one theme is not a
  // floor. 0.47 is the least that clears 4.5:1 on all three surfaces, and stays
  // well under inkSoft's 8.88:1.
  faint: 'rgba(255,255,255,0.47)',
  line: 'rgba(255,255,255,0.10)',
  accent: '#7FD9C0',
  accentDeep: '#5FC6AA',
  accentTint: 'rgba(127,217,192,0.14)',
  // The mint is a LIGHT colour. What sits on it has to be dark, which is the
  // whole reason this token is not just white.
  onAccent: '#0E1512',
  // Inverted from light on purpose. The point of the circle is that it is the
  // highest-contrast thing on the screen; on a dark ground that is a pale disc,
  // not a darker one.
  circleBg: '#F2F5F3',
  circleFg: '#0E1512',
  ctaBg: '#F2F5F3',
  ctaFg: '#0E1512',
  amber: '#E9C46A',
  danger: '#E5837B',
  scrim: 'rgba(0,0,0,0.55)',
  slot: '#0A0F0D',
};

export const PALETTES: Record<Mode, Palette> = { light: LIGHT, dark: DARK };

/**
 * A translucent wash of INK over whatever is behind it — the fills that are not
 * worth a token each: a pressed pill, a grabber, a chip's resting state.
 *
 * It exists because `rgba(255,255,255,0.12)` is the single most common way this
 * app has broken in light mode. Written literally it says "a faint lift", and it
 * IS one on the dark ground; on cream it is a near-invisible smear, and anything
 * relying on it to be a surface disappears. Same alpha, opposite ink.
 *
 * Not for text or glyphs — those have `ink` / `inkSoft` / `faint`, which are
 * tuned per theme rather than derived from one alpha.
 */
export const veil = (mode: Mode, alpha: number): string =>
  mode === 'dark' ? `rgba(255,255,255,${alpha})` : `rgba(20,20,20,${alpha})`;

/**
 * `veil`'s mirror, for the secondary text ON a `ctaBg` surface.
 *
 * `ctaBg` is the one surface that flips AGAINST the page — dark on cream, pale
 * on the ground — so the ink over it flips against the theme too. Reaching for
 * `veil` here gets it backwards in both themes at once, which is exactly the
 * mistake the library's featured block was making with a plain white literal.
 */
export const onCta = (mode: Mode, alpha: number): string =>
  mode === 'dark' ? `rgba(20,20,20,${alpha})` : `rgba(255,255,255,${alpha})`;

/**
 * Icon tiles — a pale tint carrying a saturated glyph of the same hue.
 *
 * These encode a CATEGORY. Do not reach for them to make a screen colourful: a
 * tile whose colour means nothing is decoration, and pastel decoration reads as
 * childish. If there is no dimension to encode, use `neutral`.
 *
 * On dark the pale tints would glow, so the tint becomes a low-alpha wash of the
 * glyph hue and the glyph itself lightens to stay legible on it.
 */
export interface Tile {
  bg: string;
  fg: string;
}

export const TILES: Record<Mode, Record<string, Tile>> = {
  light: {
    neutral: { bg: '#F1EFE9', fg: '#5A5A52' },
    butter: { bg: '#FEF7BF', fg: '#B07D08' },
    peach: { bg: '#FEE7DD', fg: '#C2582A' },
    lavender: { bg: '#E7E4FD', fg: '#5B45C9' },
    mint: { bg: '#DFF3EC', fg: '#0C5B4B' },
    sky: { bg: '#DEEDFB', fg: '#1D5E93' },
  },
  dark: {
    neutral: { bg: 'rgba(255,255,255,0.07)', fg: 'rgba(255,255,255,0.72)' },
    butter: { bg: 'rgba(233,196,106,0.16)', fg: '#E9C46A' },
    peach: { bg: 'rgba(240,150,110,0.16)', fg: '#F0966E' },
    lavender: { bg: 'rgba(160,142,246,0.18)', fg: '#B4A5F8' },
    mint: { bg: 'rgba(127,217,192,0.16)', fg: '#7FD9C0' },
    sky: { bg: 'rgba(125,180,235,0.16)', fg: '#8FC2EF' },
  },
};

export type TileName = keyof (typeof TILES)['light'];

/** Shared geometry, so a card in one screen matches a card in another. */
export const R = { tile: 14, card: 20, sheet: 28, pill: 999 } as const;

// ── Back-compat ───────────────────────────────────────────────────────────────
// The names ~35 screens already import. Derived, never re-typed, so the light
// palette cannot say two different things. New code should use `useTheme()`.

export const EDA = {
  canvas: LIGHT.bg,
  card: LIGHT.card,
  ink: LIGHT.ink,
  inkSoft: LIGHT.inkSoft,
  faint: LIGHT.faint,
  green: LIGHT.accent,
  greenDeep: LIGHT.accentDeep,
  greenTint: LIGHT.accentTint,
  line: LIGHT.line,
  slot: LIGHT.slot,
};

export const EDD = {
  ground: DARK.bg,
  card: DARK.card,
  cardLine: DARK.cardLine,
  text: DARK.ink,
  textSoft: DARK.inkSoft,
  faint: DARK.faint,
  green: DARK.accent,
  amber: DARK.amber,
};

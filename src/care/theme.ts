// Flow C (My Care) design tokens.
//
// This used to export a fixed LIGHT palette taken from the V2 cloud design —
// cream canvas, near-black ink, white cards. That was fine while resource
// content only ever rendered on the care web app's white page, and wrong the
// moment the same renderer was used INSIDE the patient app, which has a dark
// ground: on dark every heading and question was near-black on near-black and
// every input was a white slab. The exercises were unreadable.
//
// So the names survive and the values come from the theme. Keeping the
// vocabulary rather than rewriting fifty call sites: the names were never the
// problem, the fixed values were.
import { useTheme } from '@/src/ui/theme-mode';

export interface CareTokens {
  teal: string; tealDeep: string; onTeal: string;
  canvas: string; card: string; sheet: string; border: string;
  mint: string; mintInk: string;
  ink: string; sub: string; muted: string; chevron: string;
  danger: string; onDanger: string; scrim: string;
}

export function useCare(): CareTokens {
  const { t: TT } = useTheme();
  return {
    teal: TT.accent,
    tealDeep: TT.accentDeep,
    onTeal: TT.onAccent,
    canvas: TT.bg,
    card: TT.card,
    sheet: TT.sheet,
    border: TT.cardLine,
    mint: TT.accentTint,
    mintInk: TT.accentDeep,
    ink: TT.ink,
    sub: TT.inkSoft,
    muted: TT.faint,
    chevron: TT.faint,
    danger: TT.danger,
    onDanger: TT.onDanger,
    scrim: TT.scrim,
  };
}

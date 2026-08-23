// Editorial typography — Manrope, for everything. Loaded once at the root;
// `text-global` makes it the app-wide default with correct per-weight faces.
//
// IBM Plex Mono used to load here for the kickers. Those became sentence-case
// Manrope on 2026-08-23 (uppercase mono reads as a system stamp, which is the
// wrong voice for an app about putting words to feelings), which left two font
// files downloading on every cold start for nothing. Put it back if a real
// monospace need turns up — a counter, tabular figures — not for labels.
import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from '@expo-google-fonts/manrope';

// Passed to useFonts(); keys become the fontFamily names.
export const FONT_ASSETS = {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
};

/** Map a CSS-ish fontWeight to the matching Manrope face. */
export function manropeFor(weight?: string | number | null): string {
  switch (String(weight ?? '400')) {
    case '800':
    case '900':
      return 'Manrope_800ExtraBold';
    case '700':
    case 'bold':
      return 'Manrope_700Bold';
    case '600':
      return 'Manrope_600SemiBold';
    case '500':
      return 'Manrope_500Medium';
    default:
      return 'Manrope_400Regular';
  }
}

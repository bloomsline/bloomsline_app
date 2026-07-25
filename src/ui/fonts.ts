// Editorial typography — Manrope (display/body) + IBM Plex Mono (kickers,
// counters). Loaded once at the root; `text-global` makes Manrope the app-wide
// default with correct per-weight faces.
import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from '@expo-google-fonts/manrope';
import { IBMPlexMono_400Regular, IBMPlexMono_500Medium } from '@expo-google-fonts/ibm-plex-mono';

// Passed to useFonts(); keys become the fontFamily names.
export const FONT_ASSETS = {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
  IBMPlexMono_400Regular,
  IBMPlexMono_500Medium,
};

export const MONO = 'IBMPlexMono_400Regular';
export const MONO_MEDIUM = 'IBMPlexMono_500Medium';

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

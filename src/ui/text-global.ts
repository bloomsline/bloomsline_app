// Make Manrope the app-wide default font, with the CORRECT face per fontWeight
// (so existing `fontWeight: '700'` etc. get the real Manrope Bold, not a faux
// bold). We patch the base RN Text renderer once: any Text WITHOUT an explicit
// fontFamily gets the matching Manrope face; anything that sets its own
// fontFamily (e.g. the IBM Plex Mono kickers) is left untouched.
//
// Import this ONCE at the root, after fonts are loaded.
import { Text as RNText, StyleSheet } from 'react-native';
import { manropeFor } from './fonts';

const anyText = RNText as unknown as {
  render?: (props: unknown, ref: unknown) => unknown;
  defaultProps?: Record<string, unknown>;
  __manropePatched?: boolean;
};

if (!anyText.__manropePatched) {
  anyText.__manropePatched = true;
  const oldRender = anyText.render;
  if (typeof oldRender === 'function') {
    anyText.render = function (this: unknown, props: Record<string, unknown>, ref: unknown) {
      const flat = (StyleSheet.flatten((props as { style?: unknown }).style) ?? {}) as {
        fontFamily?: string;
        fontWeight?: string | number;
      };
      if (!flat.fontFamily) {
        const family = manropeFor(flat.fontWeight);
        // Append so it wins over the incoming style; neutralize fontWeight so the
        // platform doesn't faux-bold on top of an already-bold face.
        props = { ...props, style: [(props as { style?: unknown }).style, { fontFamily: family, fontWeight: 'normal' }] };
      }
      return (oldRender as (p: unknown, r: unknown) => unknown).call(this, props, ref);
    } as typeof oldRender;
  } else {
    // Fallback for RN builds without Text.render: single default face (weights
    // synthesize). Rare on current Expo SDKs.
    anyText.defaultProps = { ...(anyText.defaultProps ?? {}), style: { fontFamily: 'Manrope_400Regular' } };
  }
}

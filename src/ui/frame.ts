import { Platform, useWindowDimensions } from 'react-native';

/**
 * The phone-width column the WEB build renders inside (see `PhoneFrame` in
 * app/_layout.tsx). Exported so the frame and everything measuring against it
 * cannot drift apart.
 */
export const FRAME_MAX_WIDTH = 420;

/**
 * The width of the surface the app is actually laid out in.
 *
 * `useWindowDimensions()` returns the BROWSER window on web — on a desktop that
 * is ~1400px, while the app is rendered in a 420px column with
 * `overflow: 'hidden'`. Anything sized from the window is therefore built four
 * times too wide and silently clipped: no scrollbar, no overflow, the right-hand
 * side simply is not there. A patient reported text cut off mid-sentence on a
 * resource page, which is what this is.
 *
 * It never showed on a phone, because there the window IS the frame — which is
 * also why `Platform.OS !== 'web'` returns the window unchanged here.
 *
 * Derived rather than measured: the frame is `width: '100%'` with
 * `maxWidth: FRAME_MAX_WIDTH` inside a full-width parent, so its width is
 * exactly that minimum. No `onLayout`, so no first-paint at the wrong size.
 *
 * NOT for anything inside a `Modal`: React Native renders those against the
 * window, outside the frame, so `useWindowDimensions` is correct there — see
 * AnchoredMenu, MediaViewer and MomentDetail, which are deliberately untouched.
 */
export function useFrameWidth(): number {
  const { width } = useWindowDimensions();
  return Platform.OS === 'web' ? Math.min(width, FRAME_MAX_WIDTH) : width;
}

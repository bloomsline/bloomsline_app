/**
 * The stem's slices: where each one starts and how tall it is.
 *
 * The last slice is only as tall as what is left of the line. A full-height
 * last slice hung up to a slice's height below the line, and on the web that
 * overflow counts towards the scroll height: "pin to today" scrolled to the
 * bottom of empty space and the whole line sat above the screen. The Moments
 * tab opened blank right after the first moment (5 Oct 2026). Native sizes
 * the scroll from layout, which ignores absolute children, so it never showed
 * there.
 */
export function stemSlices(total: number, slice: number): { top: number; height: number }[] {
  const out: { top: number; height: number }[] = [];
  for (let top = 0; top < total; top += slice) out.push({ top, height: Math.min(slice, total - top) });
  return out;
}

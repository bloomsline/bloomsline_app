// Keeps the line being written on screen, and puts the cursor where a new block
// is — the two halves of "the writing position follows the writer".
//
// Nothing did either before. Adding a block only added it, so the cursor stayed
// in the block above. And nothing scrolled the page when a field grew, when a
// list item was added, or when the keyboard came up and the page got shorter,
// so the line being typed slid below the fold or behind the keyboard. Each
// platform has a native caret-follow of its own, but it runs BEFORE our fields
// grow (their height is set from JS a frame later) and before the keyboard
// padding lands, so it scrolls to a place that is already out of date.
//
// A caret's position is not something React Native reports, so it is estimated:
// where the finger touched, when a field was tapped; the end of the field when
// the cursor is at the end of its text (typing, a fresh block, a new list item).
// Nothing scrolls unless that line is outside the visible band, so a page that
// is already right is left alone.
import { useCallback, useEffect, useRef } from 'react';
import { Platform, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent, type ScrollView, type TextInput, type View } from 'react-native';

/** Room kept between the line and the edge of the visible band. */
const MARGIN = 28;
/** Roughly one line of the tallest body text, so a line is revealed whole. */
const LINE = 30;
/** A focus this soon after a touch was caused by that touch. */
const TOUCH_MS = 700;

// `unknown`: focused with no touch to place it — a mouse click on desktop web,
// or a keyboard's Tab. The caret could be anywhere in the field, so the page
// only moves if the field is off screen altogether, and then to its top.
type Caret = { kind: 'end' } | { kind: 'at'; y: number } | { kind: 'unknown' };

export function useKeepInView() {
  const scroller = useRef<ScrollView>(null);
  const content = useRef<View>(null);
  const scrollY = useRef(0);
  const viewH = useRef(0);
  const focused = useRef<{ key: string; caret: Caret } | null>(null);
  const lastTouch = useRef<{ y: number; at: number } | null>(null);

  const inputs = useRef(new Map<string, TextInput>());
  const pendingFocus = useRef<string | null>(null);
  // Set while WE focus a field (a block just added): the caret is at its end.
  const focusingProgrammatically = useRef(false);

  const reveal = useCallback((animated: boolean) => {
    const f = focused.current;
    const node = f ? inputs.current.get(f.key) : null;
    const box = content.current;
    if (!f || !node || !box || viewH.current <= 0) return;
    node.measureLayout(
      box as never,
      (_x, y, _w, h) => {
        const band = viewH.current - MARGIN * 2;
        let top: number;
        let bottom: number;
        if (h <= band) {
          // It fits: show the whole field.
          top = y; bottom = y + h;
        } else if (f.caret.kind === 'unknown') {
          // Leave a tall field where it is if any of it is in view: jumping to
          // its end (which this used to do) takes the reader away from the line
          // they clicked on.
          const viewTop = scrollY.current;
          const viewBottom = scrollY.current + viewH.current;
          if (y + h > viewTop && y < viewBottom) return;
          top = y; bottom = y + LINE;
        } else if (f.caret.kind === 'at') {
          top = Math.max(y, f.caret.y - LINE); bottom = Math.min(y + h, f.caret.y + LINE);
        } else {
          top = y + h - LINE; bottom = y + h;
        }
        const from = scrollY.current + MARGIN;
        const to = scrollY.current + viewH.current - MARGIN;
        let next: number | null = null;
        if (bottom > to) next = bottom - viewH.current + MARGIN;
        else if (top < from) next = top - MARGIN;
        if (next === null) return;
        next = Math.max(0, next);
        scrollY.current = next;
        scroller.current?.scrollTo({ y: next, animated });
      },
      () => {},
    );
  }, []);

  /** Props for the ScrollView. Its layout changing is the keyboard arriving or
   *  leaving (the page is padded out of its way), which moves the band. */
  const scrollProps = {
    ref: scroller,
    scrollEventThrottle: 16,
    onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => { scrollY.current = e.nativeEvent.contentOffset.y; },
    onLayout: (e: LayoutChangeEvent) => {
      const h = e.nativeEvent.layout.height;
      if (h === viewH.current) return;
      viewH.current = h;
      reveal(true);
    },
    // Where a finger went down, in page coordinates, so a tap in the middle of
    // a long paragraph keeps THAT line in view and not the paragraph's end.
    onTouchStart: (e: { nativeEvent: { pageY: number } }) => {
      const pageY = e.nativeEvent.pageY;
      const at = Date.now();
      content.current?.measureInWindow((_x, top) => { lastTouch.current = { y: pageY - top, at }; });
    },
  };

  /** Everything one text field needs: registration, focus, growth, caret. */
  const field = useCallback((key: string, value: string) => ({
    ref: (node: TextInput | null) => {
      if (node) inputs.current.set(key, node);
      else inputs.current.delete(key);
    },
    onFocus: () => {
      const t = lastTouch.current;
      lastTouch.current = null;
      const touched = t && Date.now() - t.at < TOUCH_MS;
      focused.current = { key, caret: touched ? { kind: 'at', y: t.y } : focusingProgrammatically.current ? { kind: 'end' } : { kind: 'unknown' } };
      focusingProgrammatically.current = false;
      reveal(true);
    },
    onBlur: () => { if (focused.current?.key === key) focused.current = null; },
    onSelectionChange: (e: NativeSyntheticEvent<{ selection: { start: number; end: number } }>) => {
      // The cursor at the end of the text is where typing makes the field grow,
      // so from here on the end is the line to follow.
      if (focused.current?.key === key && e.nativeEvent.selection.end >= value.length) focused.current.caret = { kind: 'end' };
    },
    // After layout, not on content-size: the height is applied a frame later,
    // and measuring before that measures the field it used to be. INSTANT, as
    // in any editor: a line typed is where the eye already is, and an animated
    // scroll is cancelled by the next keystroke's growth before it arrives.
    onLayout: () => { if (focused.current?.key === key) reveal(false); },
  }), [reveal]);

  /** Give the cursor to a field that is about to exist (a block just added). */
  const focusSoon = useCallback((key: string) => { pendingFocus.current = key; }, []);

  // Runs after every render; cheap when nothing is pending. The field has to be
  // mounted before it can take focus, which is why this cannot happen inside
  // the tap that added it.
  useEffect(() => {
    const key = pendingFocus.current;
    if (!key) return;
    const node = inputs.current.get(key);
    if (!node) return;
    pendingFocus.current = null;
    lastTouch.current = null;
    // Android drops a focus request made in the same frame the view mounted.
    const go = () => { focusingProgrammatically.current = true; node.focus(); };
    if (Platform.OS === 'android') setTimeout(go, 60);
    else go();
  });

  return { scrollProps, content, field, focusSoon };
}

// Dragging a block to a new place in the page.
//
// Hand-rolled on PanResponder rather than a draggable-list library. Two reasons
// it has to be: the rows are variable height and full of multiline TextInputs,
// which those libraries virtualise and remount underneath you, losing the
// caret; and the responder is claimed by the GRIP alone, so a touch anywhere
// else still reaches the text it landed on.
//
// Nothing is reordered while the finger is down. The dragged row translates
// with the finger, the rows it passes slide out of its way by exactly the space
// it will leave behind, and the array is rewritten once, on release. Reordering
// live would move the ground under the gesture.
import { useCallback, useRef, useState } from 'react';
import { PanResponder } from 'react-native';

/** Vertical space a row occupies beyond its measured height (its margin). */
const ROW_GAP = 16;

export interface DragState {
  /** Index being dragged, or null. */
  from: number | null;
  /** Where it would land if released now. */
  to: number;
  /** How far the finger has travelled. */
  dy: number;
}

export function useBlockDrag(count: number, onCommit: (from: number, to: number) => void) {
  const heights = useRef<number[]>([]);
  const [state, setState] = useState<DragState>({ from: null, to: 0, dy: 0 });

  // Read inside the responder, which is created once and would otherwise close
  // over the first render's values forever.
  const live = useRef(state);
  live.current = state;
  const countRef = useRef(count);
  countRef.current = count;
  const commitRef = useRef(onCommit);
  commitRef.current = onCommit;

  const measure = useCallback((index: number, height: number) => {
    heights.current[index] = height;
  }, []);

  /** Top edge of each row, in the scroll content's own coordinates. */
  const topsOf = () => {
    const tops: number[] = [];
    let y = 0;
    for (let i = 0; i < countRef.current; i++) {
      tops.push(y);
      y += (heights.current[i] ?? 0) + ROW_GAP;
    }
    return tops;
  };

  // One responder per grip, not one shared between them. A shared responder has
  // no way to know which row it was grabbed by, and claiming the touch on START
  // — legitimate here, because the grip exists for nothing else — leaves no
  // later event in which to find out.
  const responders = useRef(new Map<number, ReturnType<typeof PanResponder.create>>());

  const responderFor = (index: number) => {
    const existing = responders.current.get(index);
    if (existing) return existing;
    const made = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => setState({ from: index, to: index, dy: 0 }),

      onPanResponderMove: (_e, g) => {
        const tops = topsOf();
        const h = heights.current[index] ?? 0;
        // Where the middle of the dragged row is now.
        const centre = tops[index] + h / 2 + g.dy;

        let to = index;
        while (to + 1 < countRef.current && centre > tops[to + 1] + (heights.current[to + 1] ?? 0) / 2) to++;
        while (to - 1 >= 0 && centre < tops[to - 1] + (heights.current[to - 1] ?? 0) / 2) to--;

        setState({ from: index, to, dy: g.dy });
      },

      onPanResponderRelease: () => {
        const { from, to } = live.current;
        setState({ from: null, to: 0, dy: 0 });
        if (from !== null && to !== from) commitRef.current(from, to);
      },
      // Any other end to the gesture puts the row back rather than committing a
      // move nobody finished asking for.
      onPanResponderTerminate: () => setState({ from: null, to: 0, dy: 0 }),
    });
    responders.current.set(index, made);
    return made;
  };

  /** Give this to the grip. Already stable per index — the responder is built
   *  once and cached, so this does not need memoising on top. */
  const gripHandlers = (index: number) => responderFor(index).panHandlers;

  /**
   * How far row `index` should be shifted right now. The dragged row follows
   * the finger; the rows between where it was and where it is going step aside
   * by the whole space it will vacate, so the gap opens where it will land.
   */
  const shiftOf = (index: number): number => {
    const { from, to, dy } = state;
    if (from === null) return 0;
    if (index === from) return dy;
    const pitch = (heights.current[from] ?? 0) + ROW_GAP;
    if (to > from && index > from && index <= to) return -pitch;
    if (to < from && index >= to && index < from) return pitch;
    return 0;
  };

  return { dragging: state.from !== null, draggingIndex: state.from, measure, gripHandlers, shiftOf };
}

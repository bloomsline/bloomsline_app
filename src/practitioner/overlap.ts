// Side-by-side columns for sessions that share time on the day grid.
//
// Every block was drawn full width, so two sessions at 09:00 sat exactly on
// top of each other and the second was unreachable: a cancelled session and
// the one booked in its place, or a double booking the practitioner most needs
// to see. Sessions that overlap, directly or through a chain, form a group;
// each takes the first column free at its start, and the group is split into
// as many columns as it needed. Times are minutes from the top of the grid,
// already stretched to the height the block is drawn at, so two short blocks
// that touch on screen are treated as touching here too.

export interface Span { id: string; start: number; end: number }
export interface Placement { col: number; cols: number }

export function overlapColumns(spans: Span[]): Record<string, Placement> {
  const sorted = [...spans].sort((a, b) => a.start - b.start || b.end - a.end || a.id.localeCompare(b.id));
  const out: Record<string, Placement> = {};
  let group: { id: string; col: number }[] = [];
  let colEnds: number[] = [];
  let groupEnd = -Infinity;

  const close = () => {
    for (const g of group) out[g.id] = { col: g.col, cols: colEnds.length };
    group = [];
    colEnds = [];
  };

  for (const s of sorted) {
    if (s.start >= groupEnd) close();
    let col = colEnds.findIndex((end) => end <= s.start);
    if (col === -1) { col = colEnds.length; colEnds.push(s.end); } else colEnds[col] = s.end;
    group.push({ id: s.id, col });
    groupEnd = Math.max(groupEnd, s.end);
  }
  close();
  return out;
}

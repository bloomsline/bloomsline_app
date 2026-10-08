// The order a patient's to-do list is read in. The server sends it newest first,
// so a worksheet handed back for a redo, or one still to start, could sit under
// finished ones, and Home shows only the first three: what needed doing dropped
// out of sight. Open work comes first (the nearest due day first, then newest),
// finished work after it, newest first.
//
// Pure, no imports, so `npm test` can read it directly.

export interface TodoOrderItem {
  status: string;
  dueAt?: string | null;
}

export function orderTodo<T extends TodoOrderItem>(items: T[]): T[] {
  const due = (it: T) => {
    const t = it.dueAt ? new Date(it.dueAt).getTime() : NaN;
    return Number.isFinite(t) ? t : Infinity;
  };
  const open = items.filter((it) => it.status !== 'completed');
  const done = items.filter((it) => it.status === 'completed');
  // Array.prototype.sort is stable, so items with the same due day (or none)
  // keep the server's newest-first order.
  return [...open.sort((a, b) => due(a) - due(b)), ...done];
}

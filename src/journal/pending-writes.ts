// Writes a closing journal page is still sending, for the list to wait on.
//
// Leaving a page saves it as the page unmounts, and the list reloads as it
// regains focus: the same moment. The reload usually won, so a title changed a
// second before leaving still showed the old one until the next refresh.
const pending = new Set<Promise<unknown>>();

export function trackJournalWrite(p: Promise<unknown>): void {
  pending.add(p);
  void p.finally(() => pending.delete(p));
}

/** Wait for any such write to finish — up to `ms`, so a slow connection never
 *  holds the list back for long. */
export async function settleJournalWrites(ms = 2500): Promise<void> {
  if (pending.size === 0) return;
  await Promise.race([Promise.allSettled([...pending]), new Promise((r) => setTimeout(r, ms))]);
}

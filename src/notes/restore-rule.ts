// Whether writing kept on this phone (never confirmed by the server) should open
// instead of what the server has, for one session's note.
//
// It used to compare the phone's clock ("kept at") with the server's ("written
// at"), as strings. A phone clock running fast made a week-old copy look newer
// than a note written on the web since: it opened, autosaved, and replaced it.
// Now the copy remembers which server version it was written on top of
// (`baseAt`, the server's own timestamp), and wins only while the server still
// has exactly that version. Two server timestamps, no phone clock.
//
// Pure, no imports, so `npm test` reads it directly.

export interface KeptCopy {
  /** When this phone kept it: its own clock. Only for copies from before `baseAt`. */
  savedAt: string;
  /** The server's version this copy was written on top of; null when the note had
   *  none yet. Absent on copies kept by older builds. */
  baseAt?: string | null;
}

const at = (iso: string | null | undefined): number | null => {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : null;
};

/**
 * `serverAt` is the server's `updatedAt` for the note now, or undefined when
 * the server could not be read (offline: the copy is then the only writing).
 */
export function localWins(kept: KeptCopy, serverAt: string | null | undefined): boolean {
  if (serverAt === undefined) return true;
  if (kept.baseAt !== undefined) {
    // Unchanged since the copy began: the copy is the newer writing. Changed
    // (the web, another phone): the server's note stands.
    return at(kept.baseAt) === at(serverAt);
  }
  // An older build's copy, with no base: the old rule, but on real instants
  // rather than comparing two strings.
  const server = at(serverAt);
  const mine = at(kept.savedAt);
  if (server === null) return true;
  return mine !== null && mine > server;
}

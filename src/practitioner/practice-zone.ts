import { useEffect, useState } from 'react';

// The practice's timezone, for every date a practitioner reads.
//
// A practitioner travelling, or with a phone set to another zone, saw a patient
// record in the phone's zone while the calendar and the web showed the
// practice's: a session at 23:30 in Paris read as the next day. The day, the
// requests, the note workspace and the booking options already return the
// zone, so the first of them to answer fills this in for every other screen.
// Screens that open before any of them ask for the day once.

let known: string | null = null;
const listeners = new Set<(tz: string) => void>();

export function rememberPracticeZone(tz: unknown): void {
  if (typeof tz !== 'string' || !tz || tz === known) return;
  known = tz;
  listeners.forEach((l) => l(tz));
}

/** `{ timeZone }` to spread into toLocale* options, or `{}` until it is known
 *  (the phone's zone, which is right for most practitioners). */
export function usePracticeZone(load?: () => Promise<unknown>): { timeZone?: string } {
  const [tz, setTz] = useState<string | null>(known);
  useEffect(() => {
    listeners.add(setTz);
    if (!known && load) void load();
    else if (known) setTz(known);
    return () => { listeners.delete(setTz); };
  }, [load]);
  return tz ? { timeZone: tz } : {};
}

/** The zone once any response has carried it, else null. */
export function currentPracticeZone(): string | null {
  return known;
}

/** Test seam: forget the zone between cases. */
export function resetPracticeZone(): void {
  known = null;
}

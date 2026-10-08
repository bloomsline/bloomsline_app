// "Your account deletion was cancelled", carried from the sign-in that did it to
// the first screen after it. Signing in is the undo for a pending deletion, and
// it used to happen without a word, leaving the person unsure whether their
// account was still going. Memory only: it is about this sign-in, nothing later.
let pending = false;

/** The sign-in answered `restored` (JSON) or `restored=1` (a web return). */
export function markRestored(): void {
  pending = true;
}

/** Read AND clear: it is said once. */
export function takeRestored(): boolean {
  const p = pending;
  pending = false;
  return p;
}

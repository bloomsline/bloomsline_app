// Where the patient was trying to go before we asked them to sign in.
//
// A shared-resource email links straight to /resource/:assignmentId. If the
// patient isn't signed in, the (app) gate redirects them to welcome — and the
// destination was simply discarded, so after logging in they landed on their
// home tab and had to go hunting for the exercise their practitioner sent. This
// remembers it across the sign-in trip.
//
// Deliberately in memory, not storage: it should survive a sign-in, not a
// reinstall. A stale destination resurfacing days later would be worse than
// none.
let pending: string | null = null;

/** Routes we are willing to resume into. Anything else is ignored, so a crafted
 *  link can't turn the gate into an open redirect. */
const ALLOWED = [/^\/resource\/[A-Za-z0-9_-]{1,64}$/];

export function rememberRoute(path: string | null | undefined): void {
  if (!path || typeof path !== 'string') return;
  if (!ALLOWED.some((re) => re.test(path))) return;
  pending = path;
}

/** Read AND clear — resuming is a one-shot, or every later launch would jump. */
export function takeRoute(): string | null {
  const p = pending;
  pending = null;
  return p;
}

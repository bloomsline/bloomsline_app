// Turning a route into a screen name that is safe to send.
//
// The app's paths carry identifiers: `/resource/7f3c…`, `/invite/eyJhbGciOi…`,
// `/journal-entry?id=…`. An invite token in particular is a CREDENTIAL — it
// signs somebody in — so a screen name is not a harmless string until it has
// been through here.
//
// Pure TypeScript, tested by `npm test`.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The screen name for a router path.
 *
 * Everything after `?` or `#` goes, and any segment that is an id is replaced
 * with `:id`. The test for "an id" is deliberately broad — a uuid, digits, or
 * anything long and word-like — because the cost of being wrong in one
 * direction is a screen called `/resource/:id` and in the other a token in an
 * analytics table.
 */
export function screenName(pathname: string): string {
  const path = pathname.split('?')[0].split('#')[0];
  const cleaned = path
    .split('/')
    .map((segment) => (isIdentifier(segment) ? ':id' : segment))
    .join('/');
  // `/` is the router's entry screen; give it a name rather than a slash.
  if (cleaned === '' || cleaned === '/') return '/index';
  return cleaned.length > 1 && cleaned.endsWith('/') ? cleaned.slice(0, -1) : cleaned;
}

function isIdentifier(segment: string): boolean {
  if (!segment) return false;
  if (UUID.test(segment)) return true;
  if (/^\d+$/.test(segment)) return true;
  // A long unbroken run of id-ish characters: cuid, nanoid, a JWT's first part.
  return segment.length >= 16 && /^[A-Za-z0-9_-]+$/.test(segment);
}

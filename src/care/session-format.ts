// How the app presents a session's format: its words, its icon, and what the
// imminent session offers (Join, Maps to the practice, Maps to a place).
//
// Session places (home, outdoors, a place the practitioner named) arrive as
// keys like `place:home`. The server sends each session's `formatLabel`,
// `formatKind` and `location`; this reads those, and falls back to the app's
// own words for the built-in formats when talking to a server that does not
// send them. An unknown key is never shown raw and never treated as the
// practice: no Maps button to the practice for a home visit.
//
// Pure (no React Native), so `npm test` runs it under plain node.

export type FormatKind = 'in_person' | 'video' | 'phone' | 'place' | 'unknown';
export type FormatIconKey = 'video' | 'phone' | 'practice' | 'home' | 'outdoors' | 'pin' | 'session';

const BASE: Record<string, { en: string; fr: string }> = {
  video: { en: 'Video', fr: 'Visio' },
  phone: { en: 'Phone', fr: 'Téléphone' },
  in_person: { en: 'At the practice', fr: 'Au cabinet' },
  'place:home': { en: 'At home', fr: 'À domicile' },
  'place:outdoors': { en: 'Outdoors', fr: 'En extérieur' },
};

export function formatKindOf(key: string, fromServer?: string | null): FormatKind {
  if (fromServer === 'in_person' || fromServer === 'video' || fromServer === 'phone' || fromServer === 'place') return fromServer;
  if (key === 'in_person' || key === 'video' || key === 'phone') return key;
  return /^place:[a-z0-9-]{1,40}$/.test(key) ? 'place' : 'unknown';
}

/** The format in words: the server's label, the app's own for a known key,
 *  else a neutral word ("Session"), never the raw key. */
export function formatWords(key: string, locale: string, serverLabel?: string | null): string {
  if (serverLabel && serverLabel.trim()) return serverLabel;
  const fr = locale === 'fr';
  const known = BASE[key];
  if (known) return fr ? known.fr : known.en;
  if (formatKindOf(key) === 'place') return fr ? 'Autre lieu' : 'Other place';
  return fr ? 'Séance' : 'Session';
}

export function formatIconKey(key: string): FormatIconKey {
  if (key === 'video') return 'video';
  if (key === 'phone') return 'phone';
  if (key === 'in_person') return 'practice';
  if (key === 'place:home') return 'home';
  if (key === 'place:outdoors') return 'outdoors';
  return formatKindOf(key) === 'place' ? 'pin' : 'session';
}

/** A map search for a typed address or meeting point. */
export function mapsSearchUrl(text: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(text)}`;
}

export interface SessionLike {
  sessionFormat: string;
  formatLabel?: string | null;
  formatKind?: string | null;
  location?: string | null;
  meetLink?: string | null;
}

/**
 * What the imminent session offers to get there:
 *   video    → join (its link)
 *   phone    → a "they will call you" line
 *   practice → Maps to the practice, else its address as text
 *   place    → Maps to the session's own location (home address, meeting
 *              point), else nothing to open
 *   unknown  → nothing
 */
export function sessionWayThere(s: SessionLike, practice: { mapsUrl?: string | null; address?: string | null }):
  | { kind: 'join'; url: string }
  | { kind: 'phone' }
  | { kind: 'maps'; url: string; place: boolean }
  | { kind: 'address'; text: string }
  | { kind: 'none' } {
  const k = formatKindOf(s.sessionFormat, s.formatKind);
  if (k === 'video') return s.meetLink ? { kind: 'join', url: s.meetLink } : { kind: 'none' };
  if (k === 'phone') return { kind: 'phone' };
  if (k === 'in_person') {
    // A room typed on the session does not replace the way to the practice.
    if (practice.mapsUrl) return { kind: 'maps', url: practice.mapsUrl, place: false };
    if (practice.address) return { kind: 'address', text: practice.address };
    if (s.location?.trim()) return { kind: 'address', text: s.location.trim() };
    return { kind: 'none' };
  }
  if (k === 'place' && s.location?.trim()) return { kind: 'maps', url: mapsSearchUrl(s.location.trim()), place: true };
  return { kind: 'none' };
}

/** What analytics records: the kind, never a place's own id. */
export const formatForAnalytics = (key: string): string => formatKindOf(key);

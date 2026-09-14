// Naming who a share reaches, in a sentence.
//
// A share goes to every practitioner linked when it is made. Screens used to
// name only the first ("Anna can read this") while the moment or page reached
// all of them, which is the one place in the app where a name has to be
// complete to be true.

/** "Dr. Anna Martin" → "Anna". The title is not a name. */
export const firstNameOf = (name: string | null | undefined): string =>
  (name ?? '').replace(/^dr\.?\s*/i, '').trim().split(/\s+/)[0] ?? '';

/** "Anna", "Anna and Marc", "Anna, Marc and Léa" — or "" for nobody. */
export function joinFirstNames(names: readonly string[], locale: 'en' | 'fr'): string {
  const firsts = names.map(firstNameOf).filter(Boolean);
  if (firsts.length <= 1) return firsts[0] ?? '';
  const and = locale === 'fr' ? ' et ' : ' and ';
  return `${firsts.slice(0, -1).join(', ')}${and}${firsts[firsts.length - 1]}`;
}

// French elision before a name: "d’Adi" but "de Mila", "qu’Adi" but "que Mila".
// A vowel or an h (taken as mute, as it is for nearly every first name) elides.
const ELIDES = /^[aeiouyhàâäéèêëîïôöùûüœæ]/i;

/** "de"/"que" followed by the word, elided where French elides. */
export function frElide(particle: 'de' | 'que', word: string): string {
  return ELIDES.test(word.trim()) ? `${particle === 'de' ? 'd' : 'qu'}’${word.trim()}` : `${particle} ${word.trim()}`;
}

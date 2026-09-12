// The links a settings panel opens. Shared, because the patient's panel and the
// practitioner's now list the same ones and a second copy of a URL is a second
// place for it to go stale.
import { Linking, Platform } from 'react-native';
import type { Locale } from '@/src/i18n';

const open = (url: string) => {
  if (Platform.OS === 'web') globalThis.open?.(url, '_blank');
  else Linking.openURL(url).catch(() => {});
};

/**
 * A public page, in the reader's own language.
 *
 * Not copies. These same documents are what the site serves, and the one thing
 * worse than a policy nobody reads is two versions of it that disagree — so the
 * app links to the source rather than restating it.
 */
export const openPublic = (slug: string, locale: Locale): void =>
  open(`https://www.bloomsline.com${locale === 'fr' ? '/fr' : ''}/${slug}`);

/** Us, on WhatsApp. */
export const openContact = (): void =>
  open('https://wa.me/33671482004?text=' + encodeURIComponent('Hi Bloomsline 👋'));

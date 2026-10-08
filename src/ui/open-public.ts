import { Linking, Platform } from 'react-native';

// A page of the public site (privacy, terms, data protection, security), in
// the reader's language. The site is the source: one policy, not two copies
// that drift apart. Used wherever the app asks someone to agree to it, so what
// they agree to is one tap away.
export function openPublicPage(slug: 'privacy' | 'terms' | 'data-protection' | 'security', locale: 'en' | 'fr'): void {
  const url = `https://www.bloomsline.com${locale === 'fr' ? '/fr' : ''}/${slug}`;
  if (Platform.OS === 'web') globalThis.open?.(url, '_blank');
  else Linking.openURL(url).catch(() => {});
}

// The sentence to show for a refused sign-in, in the patient's language.
//
// The server says WHY with a code (waitlisted, suspended, private_relay,
// private_relay_email) and an
// English sentence. The code is translated here; the sentence is only used when
// there is no code, and the screen's own fallback when there is neither.
import type { SignInResult } from './auth-context';
import type { Dict } from '@/src/i18n';

export function signInMessage(r: SignInResult, t: Dict, fallback: string): string {
  if (r.ok) return '';
  const byCode = r.code ? (t.authLink.providerReturn as Record<string, string>)[r.code] : undefined;
  return byCode ?? r.message ?? fallback;
}

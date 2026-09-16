// Whether this phone has agreed to analytics.
//
// Module state plus storage, with no React in it, following the same split as
// `prefs/app-prefs-store.ts` — the provider reads it, `auth/*` never has to.
//
// DEVICE-LEVEL, like the theme and unlike the tab preferences: it is stored
// under `ui.` rather than `pref.` and `forgetAccount()` does not clear it.
// Consent is a decision someone made about THIS phone sending statistics, and
// signing out is not a withdrawal of it. The flip side, an honest one: on a
// shared device the second person inherits the first person's answer, which is
// why the answer is always visible and changeable in Settings.
import { storageGet, storageSet } from '@/src/storage';
import { countConsentAnswer } from './tally';

export type ConsentState = 'granted' | 'refused' | 'unset';

const KEY = 'ui.analyticsConsent';

let current: ConsentState = 'unset';
let loaded = false;

/** Read once at startup. Anything unrecognised reads as `unset`, so a corrupt
 *  value asks again rather than assuming a yes. */
export async function loadConsent(): Promise<ConsentState> {
  if (loaded) return current;
  const raw = await storageGet(KEY);
  current = raw === 'granted' || raw === 'refused' ? raw : 'unset';
  loaded = true;
  return current;
}

export function consentState(): ConsentState {
  return current;
}

export function analyticsAllowed(): boolean {
  return current === 'granted';
}

/** True while nobody has answered. The ask appears only in this state. */
export function shouldAskConsent(): boolean {
  return current === 'unset';
}

export async function setConsent(state: Exclude<ConsentState, 'unset'>, locale: string): Promise<void> {
  const first = current === 'unset';
  current = state;
  loaded = true;
  await storageSet(KEY, state);
  // Counted on our own server, including the noes — see `tally.ts`. Read
  // `first` BEFORE the write, so someone who declines and later agrees is one
  // person who said no, and separately one who changed their mind.
  countConsentAnswer({ kind: first ? 'first' : 'change', granted: state === 'granted', locale });
}

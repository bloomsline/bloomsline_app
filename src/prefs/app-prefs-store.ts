// Where the app-preference CACHE lives on the device, and how to forget it.
//
// Split from the provider so that signing out can clear these without importing
// React state — the provider reads `useAuth`, so anything auth imports must not
// reach back into it.
import { storageDelete } from '../storage';

export const LANDING_KEY = 'pref.landingTab';
export const INTROS_KEY = 'pref.introsSeen';

/**
 * Forget the cached preferences of whoever was signed in.
 *
 * These are a cache of the ACCOUNT's preferences, not of the phone's, and the
 * distinction only shows itself when two people use one device: sign out of a
 * patient, sign in as a practitioner, and the practitioner inherited the
 * patient's home tab and their dismissed explainers until the app was killed.
 *
 * The theme is deliberately NOT cleared here. That one really is about the
 * phone and the eyes in front of it, and it should survive whoever is holding
 * it.
 */
export async function clearAppPrefs(): Promise<void> {
  await Promise.all([storageDelete(LANDING_KEY), storageDelete(INTROS_KEY)]).catch(() => {});
}

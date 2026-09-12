// Everything the app remembers about the PERSON, forgotten in one place.
//
// Signing out cleared the tokens and two keys, and left the rest: a module-level
// cache holding the last face, another holding the last practitioner, and the
// cached preferences. None of that is reachable from the sign-in screen, so it
// looked fine — until two people shared a phone. Sign out of a patient account,
// sign in as a practitioner, and settings still showed the patient's name and
// picture and their choice of home tab, until the app was killed and the module
// state went with it. That is the report, and that is what this fixes.
//
// It is a LIST, and it will go stale. Anything cached per account belongs on it:
// the test is "would the next person to sign in on this phone see it?" A device
// preference — the theme — is not on it and should not be.
import { clearPractitionerFace } from '@/src/care/practitioner-face';
import { clearMomentsFirstRun } from '@/src/moments/first-run';
import { clearAppPrefs } from '@/src/prefs/app-prefs-store';
import { clearMeFace } from '@/src/profile/me-face';

/** Called by sign-out, before the status flips to anonymous. */
export async function forgetAccount(): Promise<void> {
  clearMeFace();
  clearPractitionerFace();
  await Promise.all([clearAppPrefs(), clearMomentsFirstRun()]).catch(() => {});
}

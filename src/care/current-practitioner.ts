// Which practitioner every request is about, as plain module state.
//
// A patient linked to several practitioners switches between them like
// profiles, and the SERVER scopes My Care, booking, to-dos, documents, the
// library and sharing to whichever one the request names. That name travels as
// a header on every call, so it has to be readable from `apiFetch`, which sits
// below React and below every provider. Hence a variable and not context.
//
// Split from the provider for the same reason app-prefs-store is split from
// its provider: `auth/api` and `forget-account` import this, and neither may
// reach back into React state or into `api/me`, which imports `auth/api`.
import { storageDelete } from '@/src/storage';

/** Where the choice is remembered on the device. Cleared with the account. */
export const SELECTED_PRACTITIONER_KEY = 'pref.selectedPractitioner';

let currentPractitionerId: string | null = null;

/** The id `apiFetch` sends as `x-bl-practitioner`, or null to send nothing. */
export function getCurrentPractitionerId(): string | null {
  return currentPractitionerId;
}

/**
 * Point every request from now on at this practitioner.
 *
 * Called BEFORE the state change that makes screens refetch. The other order
 * let the first refetch after a switch leave with the old header, and a screen
 * showed the previous practitioner's sessions under the new one's name.
 */
export function setCurrentPractitionerId(id: string | null): void {
  currentPractitionerId = id;
}

/**
 * Forget the choice, in memory and on the device.
 *
 * On the forget-account list: the id belongs to one patient's links, and the
 * next person to sign in on this phone must not send it. The server would
 * refuse it and fall back, but a request should not name someone else's
 * practitioner in the first place.
 */
export async function clearSelectedPractitioner(): Promise<void> {
  currentPractitionerId = null;
  await storageDelete(SELECTED_PRACTITIONER_KEY).catch(() => {});
}

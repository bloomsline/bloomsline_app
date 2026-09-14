// Who else can read a shared moment or journal page, beside the practitioner
// selected in the app.
//
// With a practitioner switcher, "shared" on screen means shared with the one
// selected. A page shared with Maya and looked at while Paul is selected used to
// read "Private", which told the patient nobody could read it when Maya could.
// Compared by id, not name: two practitioners can share a display name.
import { firstNameOf } from '@/src/care/practitioner-names';

export function otherReaders(names: string[] | undefined, ids: string[] | undefined, selectedId: string | null): string[] {
  if (!names || !ids || ids.length !== names.length) return [];
  return names.filter((_, i) => ids[i] !== selectedId).map((n) => firstNameOf(n) || n);
}

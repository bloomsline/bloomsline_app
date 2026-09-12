// The practitioner's profile: their name and their picture, the same screen the
// patient gets. `(app)` is gated on `status === 'authed'` and a practitioner is
// `'practitioner'`, so they cannot simply be sent to the patient's route — hence
// a route of their own over the shared screen rather than a second copy of it.
import { ProfileScreen } from '@/src/profile/ProfileScreen';

export default function PractitionerProfile() {
  return <ProfileScreen home="/(practitioner)/settings" />;
}

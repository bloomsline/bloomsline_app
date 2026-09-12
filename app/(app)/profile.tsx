// The patient's profile. The screen itself is shared with the practitioner's —
// see `src/profile/ProfileScreen`.
import { ProfileScreen } from '@/src/profile/ProfileScreen';

export default function Profile() {
  return <ProfileScreen home="/settings" />;
}

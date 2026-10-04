import { useLocalSearchParams } from 'expo-router';
import { FamilyInviteLanding } from '@/src/family/FamilyInviteLanding';

// A guardian's invitation link (guardian plan, phase 6). See FamilyInviteLanding.
export default function GuardianInvite() {
  const { token } = useLocalSearchParams<{ token: string }>();
  return <FamilyInviteLanding kind="guardian" token={String(token ?? '')} />;
}

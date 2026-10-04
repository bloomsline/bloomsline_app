import { useLocalSearchParams } from 'expo-router';
import { FamilyInviteLanding } from '@/src/family/FamilyInviteLanding';

// A child's own invitation link (guardian plan, phase 3b/6). See FamilyInviteLanding.
export default function ChildInvite() {
  const { token } = useLocalSearchParams<{ token: string }>();
  return <FamilyInviteLanding kind="child" token={String(token ?? '')} />;
}

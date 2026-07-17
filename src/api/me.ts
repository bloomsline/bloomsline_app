// Patient profile seam. Drives the Flow A (has a practitioner) vs Flow B (solo)
// branch, and persists the name/consent collected during onboarding.
//
// NOTE: these hit backend endpoints that are NOT built yet
// (`/api/mobile/me`) — until they exist, fetchMe() returns null (→ solo/Flow B
// default) and saveProfile() reports false, and onboarding proceeds regardless.
// TODO(backend, care repo): GET/PATCH /api/mobile/me returning
// { firstName, lastName, hasPractitioner, practitionerName, onboardedAt }.
import { apiFetch } from '../auth/api';

export interface MeProfile {
  firstName: string | null;
  lastName: string | null;
  hasPractitioner: boolean;
  practitionerName: string | null;
  onboardedAt: string | null;
}

export async function fetchMe(): Promise<MeProfile | null> {
  try {
    const res = await apiFetch('/api/mobile/me');
    if (!res.ok) return null;
    return (await res.json()) as MeProfile;
  } catch {
    return null;
  }
}

export async function saveProfile(input: {
  firstName?: string;
  lastName?: string;
  birthday?: string | null;
  agreedToTerms?: boolean;
  onboarded?: boolean;
}): Promise<boolean> {
  try {
    const res = await apiFetch('/api/mobile/me', { method: 'PATCH', body: JSON.stringify(input) });
    return res.ok;
  } catch {
    return false;
  }
}

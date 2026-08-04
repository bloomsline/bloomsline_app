// Practitioner API client. Deliberately small: the phone shows the day and the
// requests waiting on a decision, not the practice. Patient records stay in the
// care app — a lost phone should not be a lost record.
import { apiFetch } from '../auth/api';

export interface PractitionerSession {
  id: string;
  scheduledAt: string; // ISO
  durationMinutes: number;
  sessionFormat: string; // in_person | video | phone
  sessionType: string;
  who: string;
  location: string | null;
  meetLink: string | null;
}

export interface BookingRequest {
  id: string;
  scheduledAt: string; // ISO
  durationMinutes: number;
  sessionFormat: string;
  sessionType: string;
  who: string;
  isGuest: boolean;
}

export async function fetchDay(): Promise<{ items: PractitionerSession[]; timezone: string } | null> {
  try {
    const res = await apiFetch('/api/mobile/practitioner/day');
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function fetchRequests(): Promise<{ items: BookingRequest[]; timezone: string } | null> {
  try {
    const res = await apiFetch('/api/mobile/practitioner/requests');
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/** Approve or decline. The server re-checks the slot is still free and mirrors
 *  the decision to Google + the patient's inbox, so a 409 here means somebody
 *  else got there first — which the caller should surface, not swallow. */
export async function decideRequest(id: string, action: 'approve' | 'decline'): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await apiFetch(`/api/mobile/practitioner/requests/${id}`, {
      method: 'POST',
      body: JSON.stringify({ action }),
    });
    if (res.ok) return { ok: true };
    const body = await res.json().catch(() => null);
    return { ok: false, error: body?.error ?? 'Could not update the request.' };
  } catch {
    return { ok: false, error: 'Could not reach the server.' };
  }
}

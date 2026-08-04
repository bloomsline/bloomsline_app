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

export interface PatientListItem {
  id: string;
  name: string;
  lastSessionAt: string | null;
}

export interface PatientNote {
  id: string;
  title: string | null;
  content: string;
  noteType: string;
  createdAt: string;
}

export interface PatientDetail {
  patient: PatientListItem;
  notes: PatientNote[];
  totalNotes: number;
}

export async function fetchPatients(search?: string): Promise<PatientListItem[] | null> {
  try {
    const qs = search?.trim() ? `?q=${encodeURIComponent(search.trim())}` : '';
    const res = await apiFetch(`/api/mobile/practitioner/patients${qs}`);
    if (!res.ok) return null;
    return (await res.json()).items as PatientListItem[];
  } catch {
    return null;
  }
}

export async function fetchPatient(id: string): Promise<PatientDetail | null> {
  try {
    const res = await apiFetch(`/api/mobile/practitioner/patients/${id}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/** Notes are plain text on the server by design (no HTML, no stored-XSS
 *  surface), so nothing here sends markup. */
export async function createNote(patientId: string, content: string, title?: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await apiFetch(`/api/mobile/practitioner/patients/${patientId}/notes`, {
      method: 'POST',
      body: JSON.stringify({ content, title }),
    });
    if (res.ok) return { ok: true };
    const body = await res.json().catch(() => null);
    return { ok: false, error: body?.error ?? 'Could not save the note.' };
  } catch {
    return { ok: false, error: 'Could not reach the server.' };
  }
}

export interface SessionTypeOption {
  id: string;
  label: string;
  durationMinutes: number;
  defaultFormat: string;
}

export interface ShareableResource {
  id: string;
  title: string;
  type: string;
  description: string | null;
}

export async function fetchBookingOptions(params?: { date?: string; duration?: number; format?: string }): Promise<{ sessionTypes: SessionTypeOption[]; timezone: string; slots: string[] } | null> {
  try {
    const qs = new URLSearchParams();
    if (params?.date) qs.set('date', params.date);
    if (params?.duration) qs.set('duration', String(params.duration));
    if (params?.format) qs.set('format', params.format);
    const res = await apiFetch(`/api/mobile/practitioner/bookings${qs.toString() ? `?${qs}` : ''}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function bookSession(input: {
  memberId: string; sessionTypeId: string; scheduledAt: string; sessionFormat: string; durationMinutes: number;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await apiFetch('/api/mobile/practitioner/bookings', { method: 'POST', body: JSON.stringify(input) });
    if (res.ok) return { ok: true };
    const body = await res.json().catch(() => null);
    return { ok: false, error: body?.error ?? 'Could not book.' };
  } catch {
    return { ok: false, error: 'Could not reach the server.' };
  }
}

export async function addPatient(input: { firstName: string; lastName: string; email?: string }): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await apiFetch('/api/mobile/practitioner/patients', { method: 'POST', body: JSON.stringify(input) });
    if (res.ok) return { ok: true };
    const body = await res.json().catch(() => null);
    return { ok: false, error: body?.error ?? 'Could not add the patient.' };
  } catch {
    return { ok: false, error: 'Could not reach the server.' };
  }
}

export async function fetchShareableResources(): Promise<ShareableResource[] | null> {
  try {
    const res = await apiFetch('/api/mobile/practitioner/resources');
    if (!res.ok) return null;
    return (await res.json()).items as ShareableResource[];
  } catch {
    return null;
  }
}

export async function shareResource(resourceId: string, memberId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await apiFetch(`/api/mobile/practitioner/resources/${resourceId}/assign`, { method: 'POST', body: JSON.stringify({ memberId }) });
    if (res.ok) return { ok: true };
    const body = await res.json().catch(() => null);
    return { ok: false, error: body?.error ?? 'Could not share it.' };
  } catch {
    return { ok: false, error: 'Could not reach the server.' };
  }
}

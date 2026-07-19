// Patient booking API — available slots + create a session with the linked
// practitioner. Bearer-auth via apiFetch.
import { apiFetch } from '../auth/api';

export interface SlotDay {
  date: string; // 'YYYY-MM-DD' in the practitioner timezone
  slots: string[]; // ISO instants
}

export interface BookingSlots {
  days: SlotDay[];
  timezone: string;
  sessionType: { id: string; name: string; durationMinutes: number; priceCents: number | null };
  format: string;
  sessionTypes: { id: string; name: string; durationMinutes: number }[];
  offeredFormats: string[];
}

/** Bookable days (each with slot instants) + the resolved type/format. null when
 *  there is no linked practitioner (409) or the request fails. */
export async function fetchSlots(params: { sessionTypeId?: string; format?: string } = {}): Promise<BookingSlots | null> {
  const q = new URLSearchParams();
  if (params.sessionTypeId) q.set('sessionTypeId', params.sessionTypeId);
  if (params.format) q.set('format', params.format);
  const qs = q.toString();
  const res = await apiFetch(`/api/mobile/care/slots${qs ? `?${qs}` : ''}`);
  if (!res.ok) return null;
  return (await res.json()) as BookingSlots;
}

export interface BookResult {
  ok: boolean;
  appointmentId?: string;
  pending?: boolean;
  reason?: string; // 'conflict' | 'unavailable'
  error?: string;
}

export async function createBooking(input: {
  slotIso: string;
  sessionTypeId?: string;
  format?: string;
  idempotencyKey: string;
}): Promise<BookResult> {
  const res = await apiFetch('/api/mobile/care/book', { method: 'POST', body: JSON.stringify(input) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, reason: data?.reason, error: data?.error ?? `Could not book (${res.status})` };
  return { ok: true, appointmentId: data.appointmentId, pending: data.pending };
}

export interface SessionActionResult {
  ok: boolean;
  reason?: string;
  error?: string;
}

/** Move an existing session to a new time. */
export async function rescheduleSession(id: string, slotIso: string): Promise<SessionActionResult> {
  const res = await apiFetch(`/api/mobile/care/sessions/${id}/reschedule`, { method: 'POST', body: JSON.stringify({ slotIso }) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, reason: data?.reason, error: data?.error ?? `Could not reschedule (${res.status})` };
  return { ok: true };
}

/** Cancel an existing session. */
export async function cancelSession(id: string, reason?: string): Promise<SessionActionResult> {
  const res = await apiFetch(`/api/mobile/care/sessions/${id}/cancel`, { method: 'POST', body: JSON.stringify({ reason }) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, reason: data?.reason, error: data?.error ?? `Could not cancel (${res.status})` };
  return { ok: true };
}

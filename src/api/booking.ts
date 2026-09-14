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
  /** `priceCents` is what THIS patient pays (their own rate where set); null is
   *  no charge. `formats` are the ways this type can be booked. */
  sessionTypes: { id: string; name: string; durationMinutes: number; priceCents: number | null; defaultFormat: string; formats?: string[] }[];
  offeredFormats: string[];
  currency: string;
  /** Absent from older servers. */
  policy?: { allowPatientChange: boolean; noticeHours: number; requireApproval: boolean };
}

/** Why booking is not open to this patient, as the server put it. `other` is a
 *  refusal from a server that did not say (older ones), shown as before. */
export type SlotsRefusal = 'not_allowed' | 'no_practitioner' | 'other';

/** Bookable days (each with slot instants) + the resolved type/format.
 *  `{ unavailable }` when the server says booking is not for this patient;
 *  null when it could not be asked. Those were one value, so a dropped
 *  connection told the patient "Booking isn't available — reach out to your
 *  practitioner".
 *
 *  The reason is kept because the two refusals ask different things of the
 *  patient: a practitioner who books for them is someone to contact, and
 *  having no practitioner selected is a switch away. */
export async function fetchSlots(params: { sessionTypeId?: string; format?: string } = {}): Promise<BookingSlots | { unavailable: SlotsRefusal } | null> {
  const q = new URLSearchParams();
  if (params.sessionTypeId) q.set('sessionTypeId', params.sessionTypeId);
  if (params.format) q.set('format', params.format);
  const qs = q.toString();
  const res = await apiFetch(`/api/mobile/care/slots${qs ? `?${qs}` : ''}`);
  if (res.status === 403 || res.status === 409) {
    const body = (await res.json().catch(() => null)) as { reason?: string } | null;
    const reason = body?.reason === 'not_allowed' || body?.reason === 'no_practitioner' ? body.reason : 'other';
    return { unavailable: reason };
  }
  if (!res.ok) return null;
  return (await res.json().catch(() => null)) as BookingSlots | null;
}

// `error` is only ever the server's own sentence. The fallback used to be an
// English "Could not book (503)", which also made every screen's translated
// message unreachable; with it gone, a screen shows its own words when the
// server had none (no connection, a crash).
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
  if (!res.ok) return { ok: false, reason: data?.reason, error: typeof data?.error === 'string' ? data.error : undefined };
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
  if (!res.ok) return { ok: false, reason: data?.reason, error: typeof data?.error === 'string' ? data.error : undefined };
  return { ok: true };
}

/** Cancel an existing session. */
export async function cancelSession(id: string, reason?: string): Promise<SessionActionResult> {
  const res = await apiFetch(`/api/mobile/care/sessions/${id}/cancel`, { method: 'POST', body: JSON.stringify({ reason }) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, reason: data?.reason, error: typeof data?.error === 'string' ? data.error : undefined };
  return { ok: true };
}

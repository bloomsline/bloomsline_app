// Practitioner API client. Deliberately small: the phone shows the day and the
// requests waiting on a decision, not the practice. Patient records stay in the
// care app — a lost phone should not be a lost record.
import { apiFetch } from '../auth/api';
import type { PatientBlock } from './resources';

export interface PractitionerSession {
  id: string;
  memberId?: string | null;
  scheduledAt: string; // ISO
  durationMinutes: number;
  sessionFormat: string; // in_person | video | phone
  sessionType: string;
  who: string;
  /** A guest booking has no member row, so the member-scoped actions can't run. */
  isGuest?: boolean;
  email?: string | null;
  location: string | null;
  meetLink: string | null;
  status?: string;
  paymentStatus?: string; // paid | unpaid | free
  priceCents?: number | null;
  source?: string; // manual | google | booking
  cancellationReason?: string | null;
  seriesId?: string | null;
  seriesPosition?: number | null;
  seriesTotal?: number | null;
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

/** A day's sessions. With no date: today + tomorrow, for the dashboard. With
 *  one: that single day, which is how the day calendar walks through them. */
export async function fetchDay(date?: string): Promise<{ items: PractitionerSession[]; timezone: string; currency?: string } | null> {
  try {
    const res = await apiFetch(`/api/mobile/practitioner/day${date ? `?date=${date}` : ''}`);
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

export interface PatientSession {
  id: string;
  scheduledAt: string;
  durationMinutes: number;
  sessionFormat: string;
  sessionType: string;
  status: string;
}

/** A marked span of the note text. Half-open: [start, end). Composed into the
 *  web's markup server-side, so this is the only shape the phone deals in. */
export interface NoteRange {
  start: number;
  end: number;
  type: 'bold' | 'italic' | 'quote' | 'tag';
  slug?: string;
}

export interface UpcomingSession {
  id: string;
  memberId: string;
  who: string;
  scheduledAt: string;
  durationMinutes: number;
  sessionFormat: string;
  sessionType: string;
}

export interface NoteWorkspace {
  sessions: UpcomingSession[];
  timezone: string;
  noteTypes: string[];
  tags: { slug: string; label: string }[];
  templates: { id: string; label: string; body: string }[];
}

/** Everything the note flow opens with: sessions still to happen across every
 *  patient, and the vocabulary to write one with. */
export async function fetchNoteWorkspace(): Promise<NoteWorkspace | null> {
  try {
    const res = await apiFetch('/api/mobile/practitioner/sessions');
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export interface NoteVocabulary {
  sessions: PatientSession[];
  noteTypes: string[];
  tags: { slug: string; label: string }[];
}

/** What a note can be attached to and labelled with — the same vocabulary the
 *  web editor offers. */
export async function fetchNoteVocabulary(patientId: string): Promise<NoteVocabulary | null> {
  try {
    const res = await apiFetch(`/api/mobile/practitioner/patients/${patientId}/sessions`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/** A note belongs to a SESSION. The phone sends plain text; the server escapes
 *  it into the sanitized HTML the web model stores and appends the tags as real
 *  marks, so a note written here is the same object as one written there. */
export async function createNote(input: {
  patientId: string; appointmentId: string; content: string;
  title?: string; noteType?: string; ranges?: NoteRange[]; isPrivate?: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  const { patientId, ...payload } = input;
  try {
    const res = await apiFetch(`/api/mobile/practitioner/patients/${patientId}/notes`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (res.ok) return { ok: true };
    const err = await res.json().catch(() => null);
    return { ok: false, error: err?.error ?? 'Could not save the note.' };
  } catch {
    return { ok: false, error: 'Could not reach the server.' };
  }
}

export interface SessionTypeOption {
  id: string;
  label: string;
  durationMinutes: number;
  defaultFormat: string;
  /** Whether a payment reminder has a link to send. Without one there is no
   *  reminder, so the sheet hides the option instead of failing on tap. */
  hasPaymentLink?: boolean;
}

/** No-show reasons, grouped and localised by the server. The reason decides the
 *  recorded status (no-show vs cancelled), so the list is never hardcoded here. */
export interface CloseReasonGroup { label: string; options: [string, string][] }

export interface ShareableResource {
  id: string;
  title: string;
  type: string;
  description: string | null;
  /** How many patients have sent this one back. Optional so a build talking to
   *  a server that predates the count simply shows none. */
  submissionCount?: number;
}

export interface NextAvailableDay { date: string; slots: string[] }

export async function fetchBookingOptions(params?: { date?: string; duration?: number; format?: string }): Promise<{ sessionTypes: SessionTypeOption[]; timezone: string; slots: string[]; nextAvailable: NextAvailableDay[]; closeReasons?: CloseReasonGroup[] } | null> {
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

// ---------------------------------------------------------------------------
// Acting on a session, from the day calendar.
//
// Each of these is one call to a mobile route that wraps the SAME server action
// the care app's booking popover uses. None of the lifecycle rules live here:
// the phone decides what to OFFER, the server decides what is allowed. That
// split is why a session cancelled on the web and one cancelled on the phone
// end up identical — same state machine, same Google mirror, same emails.
// ---------------------------------------------------------------------------

/** Shared shape: 409 carries the reason a practitioner can act on ("that time is taken"). */
async function sessionAction(path: string, init: RequestInit, fallback: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await apiFetch(`/api/mobile/practitioner/sessions/${path}`, init);
    if (res.ok) return { ok: true };
    const body = await res.json().catch(() => null);
    return { ok: false, error: body?.error ?? fallback };
  } catch {
    return { ok: false, error: 'Could not reach the server.' };
  }
}

/** Record how the session went. A no-show needs a reason: it decides the status. */
export function closeSession(id: string, input: {
  outcome: 'completed' | 'no_show'; paymentStatus: string; summary?: string; reason?: string; sendPaymentLink?: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  return sessionAction(`${id}/close`, { method: 'POST', body: JSON.stringify(input) }, 'Could not close the session.');
}

/** Move it. The server re-checks the slot, so a taken time comes back as an error. */
export function rescheduleSession(id: string, input: {
  scheduledAt: string; durationMinutes?: number; sessionFormat?: string; location?: string | null; sessionType?: string;
}): Promise<{ ok: boolean; error?: string }> {
  return sessionAction(`${id}/reschedule`, { method: 'POST', body: JSON.stringify(input) }, 'Could not move the session.');
}

/** Cancel this one, this and later, or the whole series. */
export function cancelSession(id: string, input?: { scope?: 'this' | 'following' | 'all'; reason?: string }): Promise<{ ok: boolean; error?: string }> {
  return sessionAction(`${id}/cancel`, { method: 'POST', body: JSON.stringify(input ?? {}) }, 'Could not cancel the session.');
}

/** Remove it entirely — for the booking that should never have existed. */
export function deleteSession(id: string): Promise<{ ok: boolean; error?: string }> {
  return sessionAction(`${id}`, { method: 'DELETE' }, 'Could not delete the session.');
}

/** Send the patient their date, time and joining details again. */
export function resendSessionDetails(id: string): Promise<{ ok: boolean; error?: string }> {
  return sessionAction(`${id}/resend`, { method: 'POST' }, 'Could not send the details.');
}

/** Nudge an unpaid session. Only offered when the session type has a pay link. */
export function sendPaymentReminder(id: string): Promise<{ ok: boolean; error?: string }> {
  return sessionAction(`${id}/payment-reminder`, { method: 'POST' }, 'Could not send the reminder.');
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

// ---------------------------------------------------------------------------
// Previewing a resource, and reading what came back.
// ---------------------------------------------------------------------------

/** A resource as the patient would receive it: the CURRENT published version. */
export interface ResourcePreview {
  resource: { id: string; title: string; type: string; description: string | null };
  version: { id: string; blocks: PatientBlock[] };
  mediaUrls?: Record<string, string>;
}

export async function fetchResourcePreview(id: string): Promise<ResourcePreview | null> {
  try {
    const res = await apiFetch(`/api/mobile/practitioner/resources/${id}`);
    if (!res.ok) return null;
    return (await res.json()) as ResourcePreview;
  } catch {
    return null;
  }
}

export interface SubmissionSummary {
  id: string;
  resourceId: string;
  resourceTitle: string;
  memberId: string | null;
  who: string;
  source: string; // web | app | link
  submittedAt: string | null;
  score: { total: number; maxScore: number; label: string | null } | null;
}

/** The two groupings, each with counts. By resource is what the app opens on. */
export interface SubmissionGroups {
  byResource: { id: string; title: string; type: string; count: number }[];
  byPatient: { id: string; name: string; count: number }[];
}

export async function fetchSubmissionGroups(): Promise<SubmissionGroups | null> {
  try {
    const res = await apiFetch('/api/mobile/practitioner/submissions');
    if (!res.ok) return null;
    return (await res.json()) as SubmissionGroups;
  } catch {
    return null;
  }
}

export async function fetchSubmissions(by: { resourceId?: string; memberId?: string }): Promise<SubmissionSummary[] | null> {
  try {
    const qs = new URLSearchParams();
    if (by.resourceId) qs.set('resourceId', by.resourceId);
    if (by.memberId) qs.set('memberId', by.memberId);
    const res = await apiFetch(`/api/mobile/practitioner/submissions?${qs}`);
    if (!res.ok) return null;
    return (await res.json()).items as SubmissionSummary[];
  } catch {
    return null;
  }
}

/** One submission, with the blocks of the version it was ANSWERED ON — never
 *  the current one, or old answers would be drawn against new questions. */
export interface SubmissionDetail extends SubmissionSummary {
  version: { id: string; blocks: PatientBlock[] };
  answers: Record<string, unknown>;
  mediaUrls?: Record<string, string>;
  practitionerNote: string | null;
}

export async function fetchSubmission(id: string): Promise<SubmissionDetail | null> {
  try {
    const res = await apiFetch(`/api/mobile/practitioner/submissions/${id}`);
    if (!res.ok) return null;
    return (await res.json()) as SubmissionDetail;
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

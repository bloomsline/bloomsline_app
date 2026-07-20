// My Care API client — the patient's practitioner + upcoming sessions.
import { apiFetch } from '../auth/api';

export interface CareSession {
  id: string;
  scheduledAt: string; // ISO
  durationMinutes: number;
  sessionFormat: string; // in_person | video | phone
  sessionType: string;
  status: string;
  meetLink: string | null;
  // Paid / awaiting payment, or null when the practitioner has not turned
  // payment visibility on. Null means "do not show", not "unknown".
  paymentStatus: string | null;
}

/**
 * The practitioner as their patient sees them, from the practitioner's own
 * public profile. Everything is optional: a profile they have not filled in
 * must render as a sparser screen, never as invented detail.
 */
export interface CarePractitioner {
  name: string | null;
  headline: string | null;
  bio: string | null;
  specialties: string[];
  sessionTypes: string[];
  languages: string[];
  city: string | null;
  country: string | null;
  photoUrl: string | null;
}

/** What the practitioner lets this patient do to their own sessions. The server
 *  enforces these regardless; the app uses them only to avoid showing an action
 *  that would be refused. */
export interface CarePermissions {
  canBook: boolean;
  canCancel: boolean;
  canReschedule: boolean;
  noticeHours: number;
}

export interface PatientCare {
  hasPractitioner: boolean;
  permissions: CarePermissions;
  practitionerName: string | null;
  practitionerHeadline: string | null;
  practitioner: CarePractitioner | null;
  nextSession: CareSession | null;
  upcomingSessions: CareSession[];
}

export async function fetchCare(): Promise<PatientCare | null> {
  try {
    const res = await apiFetch('/api/mobile/care');
    if (!res.ok) return null;
    return (await res.json()) as PatientCare;
  } catch {
    return null;
  }
}

export interface TodoItem {
  id: string;
  resourceId: string;
  title: string;
  type: string;
  status: string; // assigned | in_progress | completed
  dueAt: string | null;
  assignedAt: string;
}

/** Resources the practitioner assigned to the patient. null on failure; [] when
 *  there's no practitioner or nothing assigned. */
export async function fetchTodo(): Promise<TodoItem[] | null> {
  try {
    const res = await apiFetch('/api/mobile/care/todo');
    if (!res.ok) return null;
    return (await res.json()).items as TodoItem[];
  } catch {
    return null;
  }
}

/** The patient's past sessions, newest first. */
export async function fetchHistory(): Promise<CareSession[] | null> {
  try {
    const res = await apiFetch('/api/mobile/care/history');
    if (!res.ok) return null;
    return (await res.json()).sessions as CareSession[];
  } catch {
    return null;
  }
}

export interface CareDocument {
  id: string;
  title: string;
  type: string | null;
  status: string;
  signed: boolean;
  signedAt: string | null;
  sentAt: string;
}

export async function fetchDocuments(): Promise<CareDocument[] | null> {
  try {
    const res = await apiFetch('/api/mobile/care/documents');
    if (!res.ok) return null;
    return (await res.json()).items as CareDocument[];
  } catch {
    return null;
  }
}

export interface SharedItem {
  id: string;
  text: string | null;
  moods: string[];
  when: string;
}

export async function fetchSharing(): Promise<SharedItem[] | null> {
  try {
    const res = await apiFetch('/api/mobile/care/sharing');
    if (!res.ok) return null;
    return (await res.json()).items as SharedItem[];
  } catch {
    return null;
  }
}

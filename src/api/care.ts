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
}

export interface PatientCare {
  hasPractitioner: boolean;
  practitionerName: string | null;
  practitionerHeadline: string | null;
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

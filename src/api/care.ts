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
  /** Where an in-person session happens. Both optional and independent: a
   *  practitioner may have given a Maps link, an address, both, or neither. */
  address: string | null;
  mapsUrl: string | null;

  /* The rest of the public profile at /p/[slug]. Controlled-vocab terms arrive
   * as LABELS in the app's language, already resolved by the server: the
   * taxonomy lives in @bloomsline/shared, which this repo cannot import, and
   * these used to render as raw ids ("stress_anxiety") at the patient. */
  approaches: string[];
  agesServed: string[];
  credentials: string[];
  education: { degree: string; institution?: string; year?: string }[];
  licenses: { title: string; region?: string }[];
  certifications: { name: string; issuer?: string }[];
  publications: { type: string; title: string; description?: string; url?: string }[];
  yearsExperience: number | null;
  offersTelehealth: boolean;
  offersInPerson: boolean;
  acceptanceStatus: 'accepting' | 'waitlist' | 'not_accepting';
  isVerified: boolean;
  introVideoUrl: string | null;
  /** Formatted by the server, in this locale and their currency. */
  feeRange: string | null;
  slidingScale: boolean;
  insurance: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  website: string | null;
  linkedin: string | null;
  instagram: string | null;
  facebook: string | null;
  twitter: string | null;
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

/** `locale` decides the language of the profile's vocabulary terms. Omitted by
 *  callers that only want the practitioner's photo or name. */
export async function fetchCare(locale?: 'en' | 'fr'): Promise<PatientCare | null> {
  try {
    const res = await apiFetch(`/api/mobile/care${locale ? `?locale=${locale}` : ''}`);
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
  /** Their practitioner has written back on this one. Optional: a build talking
   *  to a server that predates it simply shows no badge. */
  hasReply?: boolean;
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

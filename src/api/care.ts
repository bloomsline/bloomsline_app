// My Care API client — the patient's practitioner + upcoming sessions.
import { apiFetch } from '../auth/api';

export interface CareSession {
  id: string;
  scheduledAt: string; // ISO
  durationMinutes: number;
  sessionFormat: string; // in_person | video | phone | place:<id>
  /** The server's words for it ("À domicile"); absent from older servers. */
  formatLabel?: string;
  /** in_person | video | phone | place. */
  formatKind?: string;
  /** Where, for a session held somewhere: the home address, a meeting point. */
  location?: string | null;
  /** The session's own map link (its office's or meeting point's), from
   *  servers since saved locations. */
  mapsUrl?: string | null;
  /** How to get in: "Getting in: building B, door code: 4721." Already in the
   *  reader's language. Absent from older servers and for video or phone. */
  access?: string | null;
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
  /** Whose profile this is. Lets a cache check the payload is about the
   *  practitioner selected now. Absent from older servers. */
  practitionerId?: string;
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
  /** Answers are kept as a draft and not yet sent. Optional: without it a
   *  started worksheet reads as not started, as it always has. */
  hasDraft?: boolean;
  /** The practitioner handed a sent response back to be changed. Optional,
   *  like `hasDraft`. */
  reopened?: boolean;
  /** The practitioner's word from the Send dialog. Optional, like `hasDraft`. */
  note?: string | null;
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
export async function fetchHistory(locale?: 'en' | 'fr'): Promise<CareSession[] | null> {
  try {
    // The app's language, for each session's format label.
    const res = await apiFetch(`/api/mobile/care/history${locale ? `?locale=${locale}` : ''}`);
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

/**
 * A short-lived link to a signed document, or null.
 *
 * Fetched on the tap rather than listed with the documents: a presigned url
 * expires, and a list the patient opened this morning would hand out dead links
 * all afternoon.
 */
export async function fetchDocumentUrl(id: string): Promise<string | null> {
  try {
    const res = await apiFetch(`/api/mobile/care/documents/${encodeURIComponent(id)}/view`);
    if (!res.ok) return null;
    return ((await res.json()) as { url?: string }).url ?? null;
  } catch {
    return null;
  }
}

export interface DocumentBlock { id?: string; type: 'heading' | 'paragraph' | 'list' | 'divider'; text?: string; items?: string[] }

/** One document to read and sign in the app (GET /api/mobile/care/documents/[id]). */
export interface DocumentToSign {
  id: string;
  title: string;
  signed: boolean;
  signedAt: string | null;
  /** Past its signing window: it can be read, not signed. */
  expired: boolean;
  /** The practitioner's text, or null for an uploaded PDF (then `pdfUrl`). */
  blocks: DocumentBlock[] | null;
  pdfUrl: string | null;
  allowGuardian: boolean;
  /** A minor's document: the guardian signs it, as guardian. */
  guardianSigns: boolean;
  defaultName: string;
  practitionerName: string | null;
  practitionerSignatureUrl: string | null;
}

/** `'gone'` on 404 (not theirs, or removed), null when it could not be reached. */
export async function fetchDocument(id: string): Promise<DocumentToSign | 'gone' | null> {
  try {
    const res = await apiFetch(`/api/mobile/care/documents/${encodeURIComponent(id)}`);
    if (res.status === 404) return 'gone';
    if (!res.ok) return null;
    return (await res.json()) as DocumentToSign;
  } catch {
    return null;
  }
}

export interface SignatureStrokes { width: number; height: number; strokes: [number, number][][] }

/** Sign in the app. The server draws the strokes into the signature image, so
 *  no native drawing module is needed. `error` is already in the patient's language. */
export async function signDocument(id: string, body: { signerName: string; capacity: 'self' | 'guardian'; signature: SignatureStrokes }): Promise<
  { ok: true } | { ok: false; reason: 'signed' | 'expired' | 'name' | 'signature' | 'gone' | 'offline' | 'failed'; error?: string }
> {
  try {
    const res = await apiFetch(`/api/mobile/care/documents/${encodeURIComponent(id)}/sign`, { method: 'POST', body: JSON.stringify(body) });
    if (res.ok) return { ok: true };
    const data = (await res.json().catch(() => null)) as { error?: string; reason?: string } | null;
    const reason = res.status === 404 ? 'gone'
      : data?.reason === 'signed' || data?.reason === 'expired' || data?.reason === 'name' || data?.reason === 'signature' ? data.reason
      : 'failed';
    return { ok: false, reason, error: data?.error };
  } catch {
    return { ok: false, reason: 'offline' };
  }
}

export interface SharedItem {
  id: string;
  /** Which endpoint stops sharing it. Older servers list moments only and do
   *  not send it, so absent means a moment. */
  kind?: 'moment' | 'journal';
  /** A journal page's title, when it has one. */
  title?: string | null;
  text: string | null;
  moods: string[];
  when: string;
  /** Who can read it now, by name. Older servers do not send it. */
  sharedWith?: string[];
}

/** What the SELECTED practitioner can read: moments and journal pages. */
export async function fetchSharing(): Promise<SharedItem[] | null> {
  try {
    const res = await apiFetch('/api/mobile/care/sharing');
    if (!res.ok) return null;
    return (await res.json()).items as SharedItem[];
  } catch {
    return null;
  }
}

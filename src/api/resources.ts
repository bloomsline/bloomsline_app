// Patient resource (assignment) API — open an assigned resource, render it, and
// submit answers. Scoring is server-side; the client never receives option scores.
import { apiFetch } from '../auth/api';
import { putFile } from '@/src/upload/put-file';
import { MAX_FILE_BYTES, type FileDescriptor } from '@/src/resources/answers';

import type { CanvasZone } from '@/src/resources/canvas';

export interface PatientBlock {
  id: string;
  type: string;
  text?: string;
  /** embed: the link or video address (https://), sent by servers from 7 Oct 2026. */
  url?: string;
  mediaKind?: string;
  /** media: the file's original name (a PDF's title when it has no label). */
  mediaName?: string;
  label?: string;
  required?: boolean;
  options?: { id: string; label: string }[];
  scale?: { min: number; max: number; step?: number; minLabel?: string; maxLabel?: string };
  columns?: { id: string; label: string; type: string }[];
  // zoned_canvas: the regions the patient files entries into.
  canvas?: { width: number; height: number };
  zones?: CanvasZone[];
  templateId?: string;
}

export interface PatientScore {
  total: number;
  maxScore: number;
  interpretation: { label: string; note?: string } | null;
}

export interface AssignmentView {
  // completedAt / submittedAt are OPTIONAL on purpose: the app ships ahead of
  // the server that added them, so a build talking to an older API must still
  // render the finished state, just without a date.
  // dueAt and note come from the Send dialog; optional for older servers.
  assignment: { id: string; status: string; completedAt?: string | null; dueAt?: string | null; note?: string | null };
  resource: { title: string; type: string; description: string | null };
  version: { id: string; blocks: PatientBlock[] };
  scored: boolean;
  /** Signed URLs for `media` blocks, keyed by block id. Optional: a build
   *  talking to a server that predates them simply shows nothing. */
  mediaUrls?: Record<string, string>;
  /** Signed URLs for every file in a `file_upload` answer, keyed by block id and
   *  in `filesOf(answer)` order. Optional: an older server sends only the first
   *  file's, in `mediaUrls`. */
  fileUrls?: Record<string, string[]>;
  response: {
    id: string;
    answers: Record<string, unknown>;
    status: string;
    score: PatientScore | null;
    submittedAt?: string | null;
    /** Last written, response or draft. Older servers do not send it. */
    updatedAt?: string;
    /** The practitioner's closing message, once they have written one. */
    practitionerNote?: string | null;
    /** When the message was written, and whether answers were sent after it. */
    noteWrittenAt?: string | null;
    noteOnEarlierAnswers?: boolean;
  } | null;
  /** Sent and not handed back: readable, not editable. Optional so a build
   *  talking to an older server still works (it falls back to the status). */
  locked?: boolean;
  /** Who assigned it. It can be someone other than the practitioner selected
   *  in the app: an email link opens the item whoever is selected. Absent from
   *  older servers. */
  practitioner?: { id: string; name: string | null };
}

export async function fetchAssignment(id: string): Promise<AssignmentView | null> {
  try {
    const res = await apiFetch(`/api/mobile/care/todo/${id}`);
    if (!res.ok) return null;
    return (await res.json()) as AssignmentView;
  } catch {
    return null;
  }
}

/**
 * As fetchAssignment, saying why there is nothing. 'gone' when the server said
 * it is not there (taken back, deleted, not this patient's); 'unreachable' for
 * no answer or a server error, which trying again can fix. The screen used to
 * tell an offline patient the exercise was "no longer available", with no way
 * to try again.
 */
export async function loadAssignment(id: string): Promise<{ view: AssignmentView } | { failed: 'gone' | 'unreachable' }> {
  try {
    const res = await apiFetch(`/api/mobile/care/todo/${id}`);
    if (res.ok) return { view: (await res.json()) as AssignmentView };
    return { failed: res.status === 404 || res.status === 403 || res.status === 410 ? 'gone' : 'unreachable' };
  } catch {
    return { failed: 'unreachable' };
  }
}

export interface SubmitResult {
  ok: boolean;
  score?: PatientScore | null;
  /** Why it was refused, when the server said: missing_required, revoked,
   *  already_submitted. Absent for a request that never got an answer. */
  reason?: string;
  missingBlockId?: string;
}

/**
 * Send the answers. Never throws.
 *
 * It did throw on a dropped connection — `fetch` rejects rather than returning
 * an error status — and nothing caught it, so Submit spun forever and the only
 * way off the screen was Back, which took every answer with it.
 */
/** `locale`: the language the answers were typed in, so the server reads "1,234"
 *  the way the field's "Read as" line did (see src/resources/number). */
export async function submitAssignment(id: string, answers: Record<string, unknown>, locale?: 'en' | 'fr'): Promise<SubmitResult> {
  try {
    const res = await apiFetch(`/api/mobile/care/todo/${id}/submit`, { method: 'POST', body: JSON.stringify({ answers, locale }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, reason: data?.reason, missingBlockId: data?.missingBlockId };
    return { ok: true, score: data.score };
  } catch {
    return { ok: false };
  }
}

/**
 * Keep unfinished answers on the server (a draft the practitioner cannot see).
 * `final` means trying again will not help: the worksheet was sent or withdrawn.
 */
export async function saveAssignmentDraft(id: string, answers: Record<string, unknown>, locale?: 'en' | 'fr'): Promise<{ ok: boolean; final?: boolean }> {
  try {
    const res = await apiFetch(`/api/mobile/care/todo/${id}/draft`, { method: 'PUT', body: JSON.stringify({ answers, locale }) });
    if (res.ok) return { ok: true };
    return { ok: false, final: res.status === 404 || res.status === 409 };
  } catch {
    return { ok: false };
  }
}

/** The descriptor a `file_upload` answer stores (matches the web + server shape).
 *  One answer holds one to five of them; read it with `filesOf`. */
export type UploadedFile = FileDescriptor;

export type UploadOutcome =
  | { ok: true; file: UploadedFile }
  /** `too_large`: over the route's ceiling, said before a byte is sent.
   *  `busy`: the route's rate limit. `failed`: anything else, retryable. */
  | { ok: false; reason: 'too_large' | 'busy' | 'failed' };

// Presign a single response-file upload under the caller's own
// resource-responses/ prefix, then PUT the bytes straight to object storage
// (the app server never touches them — same path Moments media uses). Never
// throws: a dropped connection is a failed upload the patient can retry, not a
// spinner that never ends.
export async function uploadResponseFile(
  file: { uri: string; name: string; type: string; size: number },
  onProgress?: (fraction: number) => void,
): Promise<UploadOutcome> {
  if (file.size > MAX_FILE_BYTES) return { ok: false, reason: 'too_large' };
  try {
    const res = await apiFetch('/api/mobile/care/upload', {
      method: 'POST',
      body: JSON.stringify({ fileName: file.name, contentType: file.type, sizeBytes: file.size }),
    });
    if (!res.ok) return { ok: false, reason: res.status === 413 ? 'too_large' : res.status === 429 ? 'busy' : 'failed' };
    const { key, url, headers } = (await res.json()) as { key?: string; url?: string; headers?: Record<string, string> };
    if (!key || !url) return { ok: false, reason: 'failed' };
    // Same native trap as every other upload in the app — see `upload/put-file`.
    if (!(await putFile(url, file.uri, file.type, headers ?? {}, onProgress))) return { ok: false, reason: 'failed' };
    return { ok: true, file: { key, name: file.name, type: file.type, size: file.size } };
  } catch {
    return { ok: false, reason: 'failed' };
  }
}

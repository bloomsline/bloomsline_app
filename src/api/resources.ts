// Patient resource (assignment) API — open an assigned resource, render it, and
// submit answers. Scoring is server-side; the client never receives option scores.
import { apiFetch } from '../auth/api';

export interface PatientBlock {
  id: string;
  type: string;
  text?: string;
  mediaKind?: string;
  label?: string;
  required?: boolean;
  options?: { id: string; label: string }[];
  scale?: { min: number; max: number; step?: number; minLabel?: string; maxLabel?: string };
  columns?: { id: string; label: string; type: string }[];
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
  assignment: { id: string; status: string; completedAt?: string | null };
  resource: { title: string; type: string; description: string | null };
  version: { id: string; blocks: PatientBlock[] };
  scored: boolean;
  response: {
    id: string;
    answers: Record<string, unknown>;
    status: string;
    score: PatientScore | null;
    submittedAt?: string | null;
  } | null;
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

export interface SubmitResult {
  ok: boolean;
  score?: PatientScore | null;
  error?: string;
  missingBlockId?: string;
}

export async function submitAssignment(id: string, answers: Record<string, unknown>): Promise<SubmitResult> {
  const res = await apiFetch(`/api/mobile/care/todo/${id}/submit`, { method: 'POST', body: JSON.stringify({ answers }) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data?.error ?? `Could not submit (${res.status})`, missingBlockId: data?.missingBlockId };
  return { ok: true, score: data.score };
}

/** The descriptor a `file_upload` answer stores (matches the web + server shape). */
export interface UploadedFile {
  key: string;
  name: string;
  type: string;
  size: number;
}

// Presign a single response-file upload under the caller's own
// resource-responses/ prefix, then PUT the bytes straight to object storage
// (the app server never touches them — same path Moments media uses). Returns
// the descriptor to store in the answer, or null on failure.
export async function uploadResponseFile(file: { uri: string; name: string; type: string; size: number }): Promise<UploadedFile | null> {
  const res = await apiFetch('/api/mobile/care/upload', {
    method: 'POST',
    body: JSON.stringify({ fileName: file.name, contentType: file.type, sizeBytes: file.size }),
  });
  if (!res.ok) return null;
  const { key, url, headers } = (await res.json()) as { key?: string; url?: string; headers?: Record<string, string> };
  if (!key || !url) return null;
  const blob = await (await fetch(file.uri)).blob();
  const put = await fetch(url, { method: 'PUT', headers: { ...headers, 'content-type': file.type }, body: blob });
  if (!put.ok) return null;
  return { key, name: file.name, type: file.type, size: file.size };
}

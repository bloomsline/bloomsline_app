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
  assignment: { id: string; status: string };
  resource: { title: string; type: string; description: string | null };
  version: { id: string; blocks: PatientBlock[] };
  scored: boolean;
  response: { id: string; answers: Record<string, unknown>; status: string; score: PatientScore | null } | null;
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

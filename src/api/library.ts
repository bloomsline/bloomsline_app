// Library ("Small activities") API — browse + do self-guided activities. Runs
// are private to the patient. Reuses the block/score types from the resources client.
import { apiFetch } from '../auth/api';
import type { PatientBlock, PatientScore } from './resources';

export interface LibraryItem {
  id: string;
  title: string;
  type: string;
  description: string | null;
  runCount: number;
}

export interface LibraryResourceView {
  resource: { id: string; title: string; type: string; description: string | null };
  version: { id: string; blocks: PatientBlock[] };
  scored: boolean;
  runCount: number;
}

export async function listLibrary(): Promise<LibraryItem[] | null> {
  try {
    const res = await apiFetch('/api/mobile/library');
    if (!res.ok) return null;
    return (await res.json()).items as LibraryItem[];
  } catch {
    return null;
  }
}

export async function getLibraryResource(id: string): Promise<LibraryResourceView | null> {
  try {
    const res = await apiFetch(`/api/mobile/library/${id}`);
    if (!res.ok) return null;
    return (await res.json()) as LibraryResourceView;
  } catch {
    return null;
  }
}

export interface RunResult {
  ok: boolean;
  score?: PatientScore | null;
  error?: string;
}

export async function runLibraryActivity(id: string, answers: Record<string, unknown>): Promise<RunResult> {
  const res = await apiFetch(`/api/mobile/library/${id}/run`, { method: 'POST', body: JSON.stringify({ answers }) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data?.error ?? `Could not save (${res.status})` };
  return { ok: true, score: data.score };
}

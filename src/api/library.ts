// Library ("My guides" / "Mes repères") API — browse + do self-guided activities. Runs
// are private to the patient. Reuses the block/score types from the resources client.
import { apiFetch } from '../auth/api';
import { decodeEntities } from '@/src/resources/html';
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
  /** Signed URLs for `media` blocks, keyed by block id. Optional: a build
   *  talking to a server that predates them simply shows nothing. */
  mediaUrls?: Record<string, string>;
  runCount: number;
}

export async function listLibrary(): Promise<LibraryItem[] | null> {
  try {
    const res = await apiFetch('/api/mobile/library');
    if (!res.ok) return null;
    const items = (await res.json()).items as LibraryItem[];
    // Same reason as `ResourceIntro`: these are sanitised HTML fields, and the
    // list printed `&nbsp;` at people.
    return items.map((it) => ({ ...it, title: decodeEntities(it.title), description: it.description ? decodeEntities(it.description) : null }));
  } catch {
    return null;
  }
}

export async function getLibraryResource(id: string): Promise<LibraryResourceView | null> {
  try {
    const res = await apiFetch(`/api/mobile/library/${id}`);
    if (!res.ok) return null;
    const view = (await res.json()) as LibraryResourceView;
    // The title and description on the resource itself, for the same reason as
    // the list. The BLOCKS are decoded by the html parser that lays them out.
    return { ...view, resource: { ...view.resource, title: decodeEntities(view.resource.title), description: view.resource.description ? decodeEntities(view.resource.description) : null } };
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

// Journal API — the patient's private entries. Bearer-auth via apiFetch.
import { apiFetch } from '../auth/api';
import type { JournalBlock } from '../journal/blocks';

export interface JournalEntry {
  id: string;
  title: string | null;
  body: string; // flattened plain-text preview (list uses this)
  blocks?: JournalBlock[]; // full block content (GET /:id only)
  wordCount: number;
  sharedWithPractitioner?: boolean; // list AND GET /:id — the list marks sent pages
  createdAt: string; // ISO
  updatedAt: string; // ISO
}

export async function listJournal(): Promise<JournalEntry[] | null> {
  try {
    const res = await apiFetch('/api/mobile/journal');
    if (!res.ok) return null;
    return (await res.json()).entries as JournalEntry[];
  } catch {
    return null;
  }
}

export async function getJournal(id: string): Promise<JournalEntry | null> {
  try {
    const res = await apiFetch(`/api/mobile/journal/${id}`);
    if (!res.ok) return null;
    return (await res.json()).entry as JournalEntry;
  } catch {
    return null;
  }
}

export async function createJournal(input: { title: string | null; blocks: Record<string, unknown>[] }): Promise<JournalEntry | null> {
  try {
    const res = await apiFetch('/api/mobile/journal', { method: 'POST', body: JSON.stringify(input) });
    if (!res.ok) return null;
    return (await res.json()).entry as JournalEntry;
  } catch {
    return null;
  }
}

export async function updateJournal(id: string, input: { title: string | null; blocks: Record<string, unknown>[] }): Promise<boolean> {
  try {
    const res = await apiFetch(`/api/mobile/journal/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
    return res.ok;
  } catch {
    return false;
  }
}

export async function deleteJournal(id: string): Promise<boolean> {
  try {
    const res = await apiFetch(`/api/mobile/journal/${id}`, { method: 'DELETE' });
    return res.ok;
  } catch {
    return false;
  }
}

/** Share / unshare an entry with the practitioner. Returns the confirmed state;
 *  throws on failure so the caller can revert an optimistic toggle. */
export async function shareJournal(id: string, shared: boolean): Promise<boolean> {
  const res = await apiFetch(`/api/mobile/journal/${id}/share`, { method: 'POST', body: JSON.stringify({ shared }) });
  if (!res.ok) throw new Error(`share failed (${res.status})`);
  const data = await res.json().catch(() => ({}));
  return data?.shared === true;
}

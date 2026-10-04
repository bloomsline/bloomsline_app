// The patient's notices (guardian plan, Q8): what the server has written to
// their own chart's feed, such as a session their parent booked, or an exercise
// their practitioner shared. Read at the top of My Care, dismissed with a tap.
import { apiFetch } from '../auth/api';

export interface Notice {
  id: string;
  type: string;
  title: string;
  body: string;
  entityType: string | null;
  entityId: string | null;
  createdAt: string; // ISO
}

/** Unread notices, newest first. Null when the request failed (keep what is shown). */
export async function fetchNotices(): Promise<Notice[] | null> {
  try {
    const res = await apiFetch('/api/mobile/care/notices');
    if (!res.ok) return null;
    return ((await res.json()) as { items: Notice[] }).items;
  } catch {
    return null;
  }
}

/** Mark notices read: some by id, or all of them. */
export async function dismissNotices(which: string[] | 'all'): Promise<boolean> {
  try {
    const res = await apiFetch('/api/mobile/care/notices/read', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(which === 'all' ? { all: true } : { ids: which }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// The patient's notices (guardian plan, Q8): what the server has written to
// their own chart's feed, such as a session their parent booked, or an exercise
// their practitioner shared. Read behind the bell on My Care (notifications.tsx).
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

export interface BellNotice extends Notice {
  /** Read, or settled: a document already signed, the receipt for signing it. */
  read: boolean;
  /** What a tap opens, resolved by the server. Null: nothing to open. */
  target: { kind: 'assignment' | 'document' | 'session'; id: string } | null;
}

/** Recent notices, read and unread, worded in `locale`, with the unread count for
 *  the badge. Null when the request failed (keep what is shown). */
export async function fetchBell(locale: 'en' | 'fr'): Promise<{ items: BellNotice[]; unread: number } | null> {
  try {
    const res = await apiFetch(`/api/mobile/care/notices?all=1&locale=${locale}`);
    if (!res.ok) return null;
    const data = (await res.json()) as { items: BellNotice[]; unread?: number };
    // An older server sends unread items only, without `read` or a count.
    const items = data.items.map((n) => ({ ...n, read: n.read ?? false, target: n.target ?? null }));
    return { items, unread: typeof data.unread === 'number' ? data.unread : items.filter((n) => !n.read).length };
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

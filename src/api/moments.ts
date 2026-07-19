// Moments API client. Talks to the care backend's /api/moments (Bearer auth via
// apiFetch). Slice 1 covers WRITE moments (mood + note); media (photo/voice/
// video) is deferred until object storage is provisioned, so we never send
// `media` here yet — the timeline still renders any media the backend returns.
import { apiFetch } from '../auth/api';

export interface MomentMediaDTO {
  id: string;
  kind: string;
  mimeType: string;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
  url: string;
  thumbnailUrl: string | null;
}

export interface MomentDTO {
  id: string;
  type: string;
  textContent: string | null;
  caption: string | null;
  moods: string[];
  capturedAt: string; // ISO
  sharedWithPractitioner: boolean;
  media: MomentMediaDTO[];
}

export interface MomentPage {
  moments: MomentDTO[];
  nextCursor: string | null;
}

/** The patient's own timeline, newest first. `before` = keyset cursor (an ISO
 *  capturedAt from a previous page's nextCursor). */
export async function listMoments(params: { before?: string; limit?: number } = {}): Promise<MomentPage> {
  const q = new URLSearchParams();
  if (params.before) q.set('before', params.before);
  if (params.limit) q.set('limit', String(params.limit));
  const qs = q.toString();
  const res = await apiFetch(`/api/moments${qs ? `?${qs}` : ''}`);
  if (!res.ok) throw new Error(`Failed to load moments (${res.status})`);
  return (await res.json()) as MomentPage;
}

/** Delete one of the patient's own moments. */
export async function deleteMoment(id: string): Promise<void> {
  const res = await apiFetch(`/api/moments/${id}`, { method: 'DELETE' });
  if (!res.ok && res.status !== 404) throw new Error(`Could not delete (${res.status})`);
}

/** Share / unshare a moment with the patient's practitioner(s). Returns the new state. */
export async function shareMoment(id: string, shared: boolean): Promise<boolean> {
  const res = await apiFetch(`/api/moments/${id}/share`, { method: 'POST', body: JSON.stringify({ shared }) });
  if (!res.ok) throw new Error(`Could not update sharing (${res.status})`);
  return (await res.json()).shared as boolean;
}

export interface MomentMediaInput {
  kind: 'image' | 'video' | 'audio';
  storageKey: string;
  thumbnailKey?: string | null;
  mimeType: string;
  width?: number | null;
  height?: number | null;
  durationSeconds?: number | null;
  fileSizeBytes?: number | null;
}

/** Presign a direct upload to object storage. Returns the key + a PUT url. */
export async function presignMedia(input: { contentType: string; sizeBytes: number; thumbnail?: boolean }): Promise<{ key: string; url: string; headers: Record<string, string> }> {
  const res = await apiFetch('/api/moments/media/presign', { method: 'POST', body: JSON.stringify(input) });
  if (!res.ok) {
    const msg = await res.json().catch(() => null);
    throw new Error(msg?.error ?? `Upload unavailable (${res.status})`);
  }
  return res.json();
}

/** Create a moment (mood + note + optional media). Returns the created moment. */
export async function createMoment(input: {
  textContent?: string | null;
  moods?: string[];
  capturedAt?: string;
  media?: MomentMediaInput[];
}): Promise<MomentDTO> {
  const media = input.media ?? [];
  const type = media.length > 0 ? (media.length > 1 ? 'mixed' : media[0].kind === 'image' ? 'photo' : media[0].kind === 'video' ? 'video' : 'voice') : 'write';
  const res = await apiFetch('/api/moments', {
    method: 'POST',
    body: JSON.stringify({
      type,
      textContent: input.textContent ?? null,
      moods: input.moods ?? [],
      capturedAt: input.capturedAt,
      media,
    }),
  });
  if (!res.ok) {
    const msg = await res.json().catch(() => null);
    throw new Error(msg?.error ?? `Could not save (${res.status})`);
  }
  return (await res.json()).moment as MomentDTO;
}

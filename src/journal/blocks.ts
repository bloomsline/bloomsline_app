// Journal block model (mobile). Mirrors the server shape in
// apps/care/src/lib/journal/blocks.ts. A single loose interface (not a union)
// keeps in-place editing of RN state simple. Client-only fields (localUri,
// uploading, url) are stripped before saving.
export type BlockType = 'text' | 'heading' | 'quote' | 'callout' | 'list' | 'link' | 'image' | 'video' | 'voice';
export const MEDIA_TYPES: BlockType[] = ['image', 'video', 'voice'];
export const isMedia = (t: BlockType): boolean => MEDIA_TYPES.includes(t);

export interface JournalBlock {
  id: string;
  type: BlockType;
  // text-like
  text?: string;
  // list
  ordered?: boolean;
  items?: string[];
  // link
  url?: string;
  label?: string;
  // media (key = source of truth; url/thumbnailUrl are signed display urls)
  storageKey?: string;
  thumbnailKey?: string | null;
  thumbnailUrl?: string | null;
  mime?: string;
  durationSeconds?: number | null;
  width?: number | null;
  height?: number | null;
  // client-only (never sent)
  /** The file on this phone: the photo, the VIDEO, the recording. Always the
   *  thing itself, never a picture of it; see `localThumbUri`. */
  localUri?: string;
  /** A video's poster frame on this phone. Kept apart from `localUri` because
   *  the two were once the same field, and the player was handed a JPEG. */
  localThumbUri?: string | null;
  uploading?: boolean;
  failed?: boolean;
}

let seq = 0;
export const newId = (): string => `b${Date.now().toString(36)}${(seq++).toString(36)}`;

export function newBlock(type: BlockType): JournalBlock {
  const id = newId();
  switch (type) {
    case 'list': return { id, type, ordered: false, items: [''] };
    case 'link': return { id, type, url: '', label: '' };
    case 'image': case 'video': case 'voice': return { id, type, uploading: true };
    default: return { id, type, text: '' };
  }
}

/** True when a block has no meaningful content (so we can drop trailing empties). */
export function isEmpty(b: JournalBlock): boolean {
  if (isMedia(b.type)) return !b.storageKey && !b.uploading;
  if (b.type === 'list') return !(b.items ?? []).some((x) => x.trim());
  if (b.type === 'link') return !(b.url ?? '').trim();
  return !(b.text ?? '').trim();
}

/**
 * A link as someone would type it, made into one a browser can open, or ''
 * when it is not a web address at all. Exactly the server's rule.
 *
 * The server only keeps links that start with http(s)://, and it drops the rest
 * without a word. So `www.site.com`, or a pasted link with a space in front,
 * showed in the preview straight after saving (that is the phone's copy) and
 * was gone the next time the page opened (that is the server's). Mirrors
 * `normalizeLinkUrl` in apps/care/src/lib/journal/blocks.ts.
 */
export function normalizeLink(raw: string | undefined): string {
  const url = (raw ?? '').trim();
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith('//')) return `https:${url}`;
  // Some other scheme (mailto:, javascript:) is not a web address, and the
  // server refuses it. `host:port` is not a scheme, which the digit check sees.
  if (/^[a-z][a-z0-9+.-]*:(?!\d)/i.test(url)) return '';
  // An address has no spaces and has a dot in it (or is localhost).
  if (/\s/.test(url) || (!url.includes('.') && !/^localhost\b/i.test(url))) return '';
  return `https://${url}`;
}

/** What to PLAY or show for a media block: the file on this phone when there is
 *  one, else the uploaded copy. Local first, so nothing a player is holding is
 *  swapped out from under it when an upload lands. `||` because an unsignable
 *  server url arrives as an empty string. */
export const mediaSource = (b: JournalBlock): string | null => b.localUri || b.url || null;

/** The still to show for a block: a photo is its own still; a video has a
 *  poster, and its `url` is a video, which an <Image> cannot draw. */
export const posterSource = (b: JournalBlock): string | null =>
  b.type === 'video' ? b.localThumbUri || b.thumbnailUrl || null : mediaSource(b);

/** Serialize to the server block shape: keep only real fields, drop client-only
 *  ones, and skip media that hasn't finished uploading (no key yet). */
export function serializeForSave(blocks: JournalBlock[]): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (const b of blocks) {
    if (isMedia(b.type) && !b.storageKey) continue; // still uploading / failed
    switch (b.type) {
      case 'text': case 'heading': case 'quote': case 'callout':
        out.push({ id: b.id, type: b.type, text: b.text ?? '' }); break;
      case 'list':
        out.push({ id: b.id, type: 'list', ordered: !!b.ordered, items: (b.items ?? []).filter((x) => x.trim()) }); break;
      case 'link':
        if (normalizeLink(b.url)) out.push({ id: b.id, type: 'link', url: normalizeLink(b.url), label: (b.label ?? '').trim() }); break;
      case 'image':
        out.push({ id: b.id, type: 'image', storageKey: b.storageKey, mime: b.mime, width: b.width ?? null, height: b.height ?? null }); break;
      case 'video':
        out.push({ id: b.id, type: 'video', storageKey: b.storageKey, thumbnailKey: b.thumbnailKey ?? null, mime: b.mime, durationSeconds: b.durationSeconds ?? null }); break;
      case 'voice':
        out.push({ id: b.id, type: 'voice', storageKey: b.storageKey, mime: b.mime, durationSeconds: b.durationSeconds ?? null }); break;
    }
  }
  return out;
}

/** True when the whole entry is blank (so we never persist an empty draft). */
export function entryIsEmpty(title: string, blocks: JournalBlock[]): boolean {
  return !title.trim() && blocks.every(isEmpty);
}

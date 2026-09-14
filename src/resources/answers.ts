// What counts as an answer, read on the phone the way the server reads it.
//
// The server is the one that decides (apps/care/src/lib/resources/answers.ts
// `coerceAnswer`): an answer is "there" when it survives being coerced to its
// block's shape. It only ever reported the FIRST missing question, so the screen
// could mark one field at a time and a patient with three gaps found them over
// three refused submits. Reading the same rules here lets the screen mark every
// gap at once, and clear each mark the moment it is filled. The server still has
// the last word; this only lets the screen say it sooner.
//
// Pure, no React and no imports, so `npm test` can read it directly (Node's type
// stripping does not resolve extensionless imports). The one thing that needs
// the number parser takes it as an argument.

/** The descriptor a `file_upload` answer stores (matches the web + server shape). */
export interface FileDescriptor {
  key: string;
  name: string;
  type: string;
  size: number;
}

/** How many files one `file_upload` question takes. The server's ceiling too. */
export const MAX_FILES = 5;
/** The upload route's ceiling for one file (api/mobile/care/upload MAX_BYTES). */
export const MAX_FILE_BYTES = 100 * 1024 * 1024;

function descriptor(v: unknown): FileDescriptor | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  if (typeof o.key !== 'string' || !o.key) return null;
  return {
    key: o.key,
    name: typeof o.name === 'string' && o.name ? o.name : 'file',
    type: typeof o.type === 'string' ? o.type : '',
    size: typeof o.size === 'number' && Number.isFinite(o.size) && o.size >= 0 ? o.size : 0,
  };
}

/**
 * Every file in a `file_upload` answer, in order. The stored shape is a single
 * descriptor for one file (what every answer written before multi-file looks
 * like, and what an older web page still writes) and an array for two to five,
 * so both are read. Anything unreadable is skipped rather than failing the list.
 */
export function filesOf(value: unknown): FileDescriptor[] {
  const raw = Array.isArray(value) ? value : value ? [value] : [];
  const out: FileDescriptor[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const d = descriptor(item);
    if (!d || seen.has(d.key)) continue;
    seen.add(d.key);
    out.push(d);
    if (out.length >= MAX_FILES) break;
  }
  return out;
}

/**
 * The answer to store for a list of files: nothing for none, the bare descriptor
 * for one, an array for more. One file stays a bare object on purpose, so a
 * server or a web page that only knows the single shape still reads it.
 */
export function fileAnswer(files: FileDescriptor[]): FileDescriptor | FileDescriptor[] | undefined {
  const list = filesOf(files);
  if (list.length === 0) return undefined;
  if (list.length === 1) return list[0];
  return list;
}

/**
 * Signed URLs by storage key, for one answer. The detail payload sends
 * `fileUrls[blockId]` aligned with `filesOf(answer)` as the SERVER had it, and
 * the patient may have removed or added files since, so a position is not a
 * safe way to find a file's link once the answer is being edited. A key is.
 * `firstUrl` is `mediaUrls[blockId]`, all an older server sends: the first file.
 */
export function urlsByKey(serverValue: unknown, urls: string[] | undefined, firstUrl?: string): Record<string, string> {
  // Read exactly as the server's `filesOf` reads it (no de-duplication, no cap),
  // since that is the order its list was built in. A file it could not sign
  // keeps its place as '' and simply gets no link here: the tile still shows
  // its name, and every later file keeps its own url.
  const raw = Array.isArray(serverValue) ? serverValue : serverValue ? [serverValue] : [];
  const files = raw.map(descriptor);
  const out: Record<string, string> = {};
  const list = urls && urls.length ? urls : firstUrl ? [firstUrl] : [];
  files.forEach((f, i) => { if (f && typeof list[i] === 'string' && list[i] && !out[f.key]) out[f.key] = list[i]; });
  return out;
}

/** `urlsByKey` for every file question of a version, as one map (keys are unique). */
export function fileUrlIndex(
  blocks: { id: string; type: string }[],
  answers: Record<string, unknown> | null | undefined,
  fileUrls: Record<string, string[]> | undefined,
  mediaUrls: Record<string, string> | undefined,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const b of blocks) {
    if (b.type !== 'file_upload') continue;
    Object.assign(out, urlsByKey(answers?.[b.id], fileUrls?.[b.id], mediaUrls?.[b.id]));
  }
  return out;
}

// ---- dates -------------------------------------------------------------------

export interface DateParts { y: number; m: number; d: number }

/**
 * A stored date as its parts, or null. `YYYY-MM-DD` is what the picker stores and
 * the server keeps; `DD/MM/YYYY` (or with dots or dashes) is what the old free
 * text field asked for, and answers typed that way are still out there. A day
 * that does not exist (31 April) is not a date.
 */
export function readDate(value: unknown): DateParts | null {
  if (typeof value !== 'string') return null;
  const s = value.trim();
  let y: number, m: number, d: number;
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (iso) [y, m, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  else {
    const dmy = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s);
    if (!dmy) return null;
    [d, m, y] = [Number(dmy[1]), Number(dmy[2]), Number(dmy[3])];
  }
  const probe = new Date(Date.UTC(y, m - 1, d));
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== m - 1 || probe.getUTCDate() !== d) return null;
  return { y, m, d };
}

/** Parts as the `YYYY-MM-DD` the server stores. */
export function isoOf(p: DateParts): string {
  return `${String(p.y).padStart(4, '0')}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`;
}

// ---- required ----------------------------------------------------------------

export interface AnswerBlock {
  id: string;
  type: string;
  required?: boolean;
  options?: { id: string }[];
  columns?: { id: string; type: string }[];
  zones?: { id: string }[];
}

/** A number from what was typed or stored, the way the server reads it. */
export type ReadNumber = (v: unknown) => number | undefined;

const nonBlank = (v: unknown) => typeof v === 'string' && v.trim().length > 0;

/**
 * Whether this value would be KEPT as an answer. Mirrors `coerceAnswer`: a table
 * with only empty rows is no answer (the server drops empty rows), a multi-choice
 * with nothing ticked is none, a scale with nothing picked is none.
 */
export function isAnswered(block: AnswerBlock, value: unknown, readNumber: ReadNumber): boolean {
  switch (block.type) {
    case 'short_text':
    case 'long_text':
      return nonBlank(value);
    case 'number':
    case 'scale':
      return readNumber(value) !== undefined;
    case 'date':
      return readDate(value) !== null;
    case 'yes_no':
      return value === 'yes' || value === 'no';
    case 'single_choice':
      return typeof value === 'string' && (block.options ?? []).some((o) => o.id === value);
    case 'multi_choice': {
      if (!Array.isArray(value)) return false;
      const ids = new Set((block.options ?? []).map((o) => o.id));
      return value.some((v) => typeof v === 'string' && ids.has(v));
    }
    case 'file_upload':
      return filesOf(value).some((f) => f.key.startsWith('resource-responses/'));
    case 'table': {
      if (!Array.isArray(value)) return false;
      const cols = block.columns ?? [];
      return value.some((row) => {
        if (!row || typeof row !== 'object') return false;
        const r = row as Record<string, unknown>;
        return cols.some((c) => (c.type === 'number' ? readNumber(r[c.id]) !== undefined : nonBlank(r[c.id])));
      });
    }
    case 'zoned_canvas': {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
      const src = value as Record<string, unknown>;
      return (block.zones ?? []).some((z) => {
        const list = src[z.id];
        return Array.isArray(list) && list.some((e) => {
          const text = e && typeof e === 'object' ? (e as Record<string, unknown>).text : e;
          return nonBlank(text);
        });
      });
    }
    default:
      return true;
  }
}

/** Every required question with no answer, in the order they are asked. */
export function missingRequired(blocks: AnswerBlock[], answers: Record<string, unknown>, readNumber: ReadNumber, interactive: Set<string>): string[] {
  return blocks
    .filter((b) => b.required === true && interactive.has(b.type) && !isAnswered(b, answers[b.id], readNumber))
    .map((b) => b.id);
}

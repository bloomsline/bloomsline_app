// A copy, on this phone, of writing that has not reached the server yet.
//
// Journal pages, worksheet answers and session notes are kept on the server as
// they are written. That covers leaving a screen and switching phones — and
// nothing covered the phone killing the app while it was offline: the words were
// only in memory, and they were gone. Before each save is sent, a copy goes
// here; when the server confirms, the copy is removed. A copy still present on
// the next open is writing that never arrived, and the screen restores it.
//
// Therapy writing, so it is kept as tightly as the platform allows: the app's
// private documents directory on a phone (not the cache the OS may clear, not
// shared storage), and ALL of it is removed at sign-out (`forgetAccount`). Only
// unconfirmed writing is ever held.
//
// On the web it is `sessionStorage`: kept through a reload or a crashed tab, gone
// when the tab is closed. It was `localStorage`, which on a shared or family
// computer kept someone's therapy writing until they remembered to sign out.
// Copies left there by earlier builds are removed on first use.
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

export type UnsentKind = 'journal' | 'worksheet' | 'note';
export interface Unsent<T> { savedAt: string; payload: T }

const isWeb = Platform.OS === 'web';
const WEB_PREFIX = 'bl_unsent:';

/** The web's store for unsent writing: this tab only. */
function webStore(): Storage | undefined {
  purgeLongLivedCopies();
  return globalThis.sessionStorage;
}

let purged = false;
/** Copies earlier builds kept in localStorage, which outlives the tab. */
function purgeLongLivedCopies(): void {
  if (purged) return;
  purged = true;
  try {
    const ls = globalThis.localStorage;
    if (!ls) return;
    for (let i = ls.length - 1; i >= 0; i--) {
      const k = ls.key(i);
      if (k?.startsWith(WEB_PREFIX)) ls.removeItem(k);
    }
  } catch { /* storage blocked */ }
}
const dir = () => `${FileSystem.documentDirectory ?? ''}unsent/`;
const safe = (s: string) => s.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 120);
const nameOf = (kind: UnsentKind, id: string) => `${kind}-${safe(id)}.json`;

export async function saveUnsent<T>(kind: UnsentKind, id: string, payload: T): Promise<void> {
  const body = JSON.stringify({ savedAt: new Date().toISOString(), payload } satisfies Unsent<T>);
  try {
    if (isWeb) { webStore()?.setItem(WEB_PREFIX + nameOf(kind, id), body); return; }
    await FileSystem.makeDirectoryAsync(dir(), { intermediates: true }).catch(() => {});
    await FileSystem.writeAsStringAsync(dir() + nameOf(kind, id), body);
  } catch {
    // A copy that could not be written leaves the server save as the only one,
    // which is how it was before; nothing to tell anyone.
  }
}

export async function readUnsent<T>(kind: UnsentKind, id: string): Promise<Unsent<T> | null> {
  try {
    const raw = isWeb
      ? webStore()?.getItem(WEB_PREFIX + nameOf(kind, id)) ?? null
      : (await FileSystem.getInfoAsync(dir() + nameOf(kind, id))).exists
        ? await FileSystem.readAsStringAsync(dir() + nameOf(kind, id))
        : null;
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Unsent<T>;
    return parsed && typeof parsed.savedAt === 'string' ? parsed : null;
  } catch {
    return null;
  }
}

export async function clearUnsent(kind: UnsentKind, id: string): Promise<void> {
  try {
    if (isWeb) { webStore()?.removeItem(WEB_PREFIX + nameOf(kind, id)); return; }
    await FileSystem.deleteAsync(dir() + nameOf(kind, id), { idempotent: true });
  } catch { /* already gone */ }
}

/** Every copy, for sign-out: none of it belongs to the next person here. */
export async function clearAllUnsent(): Promise<void> {
  try {
    if (isWeb) {
      const ls = webStore();
      if (!ls) return;
      for (let i = ls.length - 1; i >= 0; i--) {
        const k = ls.key(i);
        if (k?.startsWith(WEB_PREFIX)) ls.removeItem(k);
      }
      return;
    }
    await FileSystem.deleteAsync(dir(), { idempotent: true });
  } catch { /* nothing stored */ }
}

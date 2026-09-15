// Keep the picture links the line already has when the same moments come back.
//
// Every read of the line signs every picture again, and a new link is a new
// image as far as the phone is concerned: it drew the node empty, fetched the
// same photograph under its new address, and drew it again. Moments reads its
// first page every time the tab is shown, so coming back to it made every photo
// on screen blink.
//
// A link the server signed stays good for 30 minutes (PREVIEW_EXPIRY in the care
// app's lib/storage). Within REUSE_MS of receiving one, a moment whose media are
// the same files keeps its old links, and if nothing else about it changed it is
// the very same object, so the memoised row does not redraw at all.

import type { MomentDTO } from '../api/moments.ts';

/** Comfortably inside the server's 30 minutes, so a kept link never expires on screen. */
export const REUSE_MS = 20 * 60_000;

const sameList = (a: readonly string[] | undefined, b: readonly string[] | undefined) =>
  (a ?? []).length === (b ?? []).length && (a ?? []).every((x, i) => x === (b ?? [])[i]);

const sameMedia = (a: MomentDTO, b: MomentDTO) =>
  a.media.length === b.media.length && a.media.every((m, i) => m.id === b.media[i].id);

const sameApartFromLinks = (a: MomentDTO, b: MomentDTO) =>
  a.type === b.type && a.textContent === b.textContent && a.caption === b.caption && a.capturedAt === b.capturedAt
  && a.sharedWithPractitioner === b.sharedWithPractitioner && sameList(a.moods, b.moods)
  && sameList(a.sharedWith, b.sharedWith) && sameList(a.sharedWithIds, b.sharedWithIds) && sameMedia(a, b);

/**
 * `next` as read from the server, with the links from `prev` kept wherever they
 * are still young. `linksAt` records when each moment's links arrived and is
 * updated in place for the ones that took new links.
 */
export function keepFreshLinks(prev: readonly MomentDTO[], next: readonly MomentDTO[], linksAt: Map<string, number>, now: number): MomentDTO[] {
  const before = new Map(prev.map((m) => [m.id, m]));
  return next.map((m) => {
    const old = before.get(m.id);
    const at = linksAt.get(m.id);
    if (old && at !== undefined && now - at < REUSE_MS && sameMedia(old, m)) {
      return sameApartFromLinks(old, m) ? old : { ...m, media: old.media };
    }
    linksAt.set(m.id, now);
    return m;
  });
}

// Geometry for zoned_canvas exercises (Circle of Control, Iceberg, Body Map).
//
// PORTED from apps/care/src/lib/resources/zoned-canvas.ts in the care repo. The
// two are separate npm projects so neither can import the other; this copy is
// kept deliberately identical, and the care copy carries the unit tests that pin
// the behaviour (including the real v1 canvases). Change one, change both.
//
// A canvas answer stores no coordinates — an entry belongs to a ZONE, and where
// its chip sits is worked out here, at render time. That is what makes one
// answer render identically on the practitioner's wide screen, in a PDF, and on
// a phone, and it is why moving an entry between zones is the only "placement"
// a patient ever performs.
//
// Everything here is pure: no React, no DOM. The web renderer, the review view
// and the mobile app all lay chips out through these functions, so a canvas
// cannot drift between surfaces.
export type ZoneShape =
  | { kind: 'rect'; x: number; y: number; w: number; h: number; rx?: number }
  | { kind: 'circle'; cx: number; cy: number; r: number }
  | { kind: 'ellipse'; cx: number; cy: number; rx: number; ry: number }
  | { kind: 'polygon'; points: [number, number][] };

export interface CanvasZone {
  id: string;
  label: string | Record<string, string>;
  shape: ZoneShape;
  accent?: string;
  parentZoneId?: string;
}

export interface CanvasEntry {
  id: string;
  text: string;
  createdAt?: string;
}

export type CanvasAnswer = Record<string, CanvasEntry[]>;

export interface Point { x: number; y: number }
export interface Box { x: number; y: number; w: number; h: number }

/** v1 authored a label per language; fall back through the requested locale,
 *  English, then whatever exists, so a zone is never nameless. */
export function zoneLabel(label: string | Record<string, string> | undefined, locale = 'en'): string {
  if (!label) return '';
  if (typeof label === 'string') return label;
  return label[locale] || label.en || Object.values(label)[0] || '';
}

export function shapeBox(shape: ZoneShape): Box {
  switch (shape.kind) {
    case 'rect':
      return { x: shape.x, y: shape.y, w: shape.w, h: shape.h };
    case 'circle':
      return { x: shape.cx - shape.r, y: shape.cy - shape.r, w: shape.r * 2, h: shape.r * 2 };
    case 'ellipse':
      return { x: shape.cx - shape.rx, y: shape.cy - shape.ry, w: shape.rx * 2, h: shape.ry * 2 };
    case 'polygon': {
      const pts = shape.points;
      if (!pts.length) return { x: 0, y: 0, w: 0, h: 0 };
      const xs = pts.map((p) => p[0]);
      const ys = pts.map((p) => p[1]);
      const x = Math.min(...xs);
      const y = Math.min(...ys);
      return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
    }
  }
}

/** Is a point inside the shape? Ray casting for polygons; the rest are direct. */
export function pointInShape(shape: ZoneShape, p: Point): boolean {
  switch (shape.kind) {
    case 'rect':
      return p.x >= shape.x && p.x <= shape.x + shape.w && p.y >= shape.y && p.y <= shape.y + shape.h;
    case 'circle': {
      const dx = p.x - shape.cx;
      const dy = p.y - shape.cy;
      return dx * dx + dy * dy <= shape.r * shape.r;
    }
    case 'ellipse': {
      if (shape.rx <= 0 || shape.ry <= 0) return false;
      const dx = (p.x - shape.cx) / shape.rx;
      const dy = (p.y - shape.cy) / shape.ry;
      return dx * dx + dy * dy <= 1;
    }
    case 'polygon': {
      const pts = shape.points;
      let inside = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i];
        const [xj, yj] = pts[j];
        const straddles = yi > p.y !== yj > p.y;
        if (straddles && p.x < ((xj - xi) * (p.y - yi)) / (yj - yi || Number.EPSILON) + xi) inside = !inside;
      }
      return inside;
    }
  }
}

// A polygon has no closed form for either test, so its boundary is sampled.
// Twelve points is a 30° step: fine enough that a chip cannot poke out of the
// shapes v1 authored, cheap enough to run for every candidate slot.
const POLY_SAMPLES = 12;

function ringPoints(p: Point, r: number): Point[] {
  const out: Point[] = [];
  for (let i = 0; i < POLY_SAMPLES; i++) {
    const a = (2 * Math.PI * i) / POLY_SAMPLES;
    out.push({ x: p.x + r * Math.cos(a), y: p.y + r * Math.sin(a) });
  }
  return out;
}

/** Is a disc of radius r at p entirely within the shape? */
export function discInside(shape: ZoneShape, p: Point, r: number): boolean {
  switch (shape.kind) {
    case 'rect':
      return p.x - r >= shape.x && p.x + r <= shape.x + shape.w && p.y - r >= shape.y && p.y + r <= shape.y + shape.h;
    case 'circle':
      return Math.hypot(p.x - shape.cx, p.y - shape.cy) + r <= shape.r;
    case 'ellipse': {
      // Shrinking both semi-axes by r is conservative: the result sits inside
      // the true inward offset, so a chip that passes is genuinely contained.
      const rx = shape.rx - r;
      const ry = shape.ry - r;
      if (rx <= 0 || ry <= 0) return false;
      const dx = (p.x - shape.cx) / rx;
      const dy = (p.y - shape.cy) / ry;
      return dx * dx + dy * dy <= 1;
    }
    case 'polygon':
      return pointInShape(shape, p) && ringPoints(p, r).every((q) => pointInShape(shape, q));
  }
}

/** Is a disc of radius r at p entirely OUTSIDE the shape? */
export function discClear(shape: ZoneShape, p: Point, r: number): boolean {
  switch (shape.kind) {
    case 'rect': {
      // Distance to the nearest point of the rect.
      const nx = Math.max(shape.x, Math.min(p.x, shape.x + shape.w));
      const ny = Math.max(shape.y, Math.min(p.y, shape.y + shape.h));
      return Math.hypot(p.x - nx, p.y - ny) >= r;
    }
    case 'circle':
      return Math.hypot(p.x - shape.cx, p.y - shape.cy) >= shape.r + r;
    case 'ellipse': {
      // Growing both semi-axes by r covers the true outward offset, so staying
      // outside the grown ellipse guarantees no overlap.
      const dx = (p.x - shape.cx) / (shape.rx + r);
      const dy = (p.y - shape.cy) / (shape.ry + r);
      return dx * dx + dy * dy >= 1;
    }
    case 'polygon':
      return !pointInShape(shape, p) && ringPoints(p, r).every((q) => !pointInShape(shape, q));
  }
}

/** The zones drawn inside a given one. Circle of Control's circle is a child of
 *  its outer square, so "what I can't control" must not scatter its chips across
 *  the circle. */
export function childZonesOf(zones: CanvasZone[], zoneId: string): CanvasZone[] {
  return zones.filter((z) => z.parentZoneId === zoneId);
}

// A label sits in a box, so the packer works in boxes. Padding and the gap kept
// between neighbours, both in canvas units.
const LABEL_PAD = 8;
const LABEL_GAP = 6;
// Character budgets tried in order, longest first: the packer takes the most
// text the zone can hold, and only shortens when it must.
const BUDGET_STEPS = [30, 26, 22, 18, 15, 12, 10, 8, 6];
const MAX_ENTRY_LINES = 2;
const MAX_FONT_SIZE = 34;

/** Average glyph width at a given font size, in canvas units. */
const charWidth = (fontSize: number) => CHAR_WIDTH * (fontSize / 17);

/** Corners, edge midpoints and centre — the sample set used to test a box
 *  against a shape the way `ringPoints` does for a disc. Exact for convex
 *  shapes, which every canvas we ship uses. */
function boxPoints(b: Box): Point[] {
  const { x, y, w, h } = b;
  return [
    { x, y }, { x: x + w, y }, { x, y: y + h }, { x: x + w, y: y + h },
    { x: x + w / 2, y }, { x: x + w / 2, y: y + h },
    { x, y: y + h / 2 }, { x: x + w, y: y + h / 2 },
    { x: x + w / 2, y: y + h / 2 },
  ];
}

/** Is the box entirely INSIDE the shape? */
export function rectInside(shape: ZoneShape, b: Box): boolean {
  if (shape.kind === 'rect') {
    return b.x >= shape.x && b.y >= shape.y &&
           b.x + b.w <= shape.x + shape.w && b.y + b.h <= shape.y + shape.h;
  }
  return boxPoints(b).every((p) => pointInShape(shape, p));
}

/** Is the box entirely OUTSIDE the shape? Both directions are checked: a small
 *  child zone can sit wholly within the box without any box corner falling
 *  inside it. */
export function rectClear(shape: ZoneShape, b: Box): boolean {
  switch (shape.kind) {
    case 'circle': {
      // Exact: nearest point on an axis-aligned box to the circle's centre.
      const nx = Math.max(b.x, Math.min(shape.cx, b.x + b.w));
      const ny = Math.max(b.y, Math.min(shape.cy, b.y + b.h));
      return Math.hypot(nx - shape.cx, ny - shape.cy) >= shape.r;
    }
    case 'rect':
      return b.x + b.w <= shape.x || b.x >= shape.x + shape.w ||
             b.y + b.h <= shape.y || b.y >= shape.y + shape.h;
    default: {
      if (boxPoints(b).some((p) => pointInShape(shape, p))) return false;
      const ob = shapeBox(shape);
      return !boxPoints(ob).some((p) =>
        p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h);
    }
  }
}

/** Cut to `budget`, marking the cut so the caller can offer the full text. */
function shortenTo(text: string, budget: number): { text: string; truncated: boolean } {
  const clean = (text ?? '').trim().replace(/\s+/g, ' ');
  if (clean.length <= budget) return { text: clean, truncated: false };
  return { text: `${clean.slice(0, Math.max(3, budget - 1)).replace(/\s+$/, '')}\u2026`, truncated: true };
}

function measureEntry(text: string, budget: number, fontSize: number) {
  const cut = shortenTo(text, budget);
  const perLine = Math.max(6, Math.ceil(budget / MAX_ENTRY_LINES) + 2);
  const lines: string[] = [];
  let line = '';
  for (const word of cut.text.split(' ')) {
    const cand = line ? `${line} ${word}` : word;
    if (cand.length <= perLine || !line) { line = cand; continue; }
    lines.push(line);
    line = word;
    if (lines.length === MAX_ENTRY_LINES) break;
  }
  if (line && lines.length < MAX_ENTRY_LINES) lines.push(line);
  const shown = lines.slice(0, MAX_ENTRY_LINES);
  const widest = shown.reduce((m, l) => Math.max(m, l.length), 0);
  return {
    lines: shown,
    truncated: cut.truncated,
    w: widest * charWidth(fontSize) + LABEL_PAD * 2,
    h: shown.length * (fontSize * 1.18) + LABEL_PAD * 2,
  };
}

export interface CanvasLabel { box: Box; lines: string[]; truncated: boolean }
export interface LabelLayout {
  /** Index-aligned with the texts given. `null` means the zone had no room for
   *  it even at the smallest legible size — the caller must still surface it. */
  labels: (CanvasLabel | null)[];
  fontSize: number;
  budget: number;
  /** True when something could not be placed at all. */
  overflowed: boolean;
}

/** One attempt: place every text at this budget and size, or fail fast. */
function packAll(
  zone: CanvasZone, children: CanvasZone[], box: Box, band: number,
  texts: string[], budget: number, fontSize: number,
): CanvasLabel[] | null {
  const used: Box[] = [];
  const out: CanvasLabel[] = [];
  for (const text of texts) {
    const m = measureEntry(text, budget, fontSize);
    // Step with the label, not a fixed grid: a fine sweep costs thousands of
    // probes per entry and finds nothing a half-label step misses.
    const step = Math.max(10, Math.round(Math.min(m.w, m.h) / 2));
    let spot: Box | null = null;
    for (let y = box.y + band + 3; y + m.h <= box.y + box.h - 3 && !spot; y += step) {
      for (let x = box.x + 3; x + m.w <= box.x + box.w - 3 && !spot; x += step) {
        const cand: Box = { x, y, w: m.w, h: m.h };
        if (!rectInside(zone.shape, cand)) continue;
        if (children.some((c) => !rectClear(c.shape, cand))) continue;
        const clash = used.some((u) =>
          cand.x < u.x + u.w + LABEL_GAP && cand.x + cand.w + LABEL_GAP > u.x &&
          cand.y < u.y + u.h + LABEL_GAP && cand.y + cand.h + LABEL_GAP > u.y);
        if (!clash) spot = cand;
      }
    }
    if (!spot) return null; // this configuration cannot hold them all
    used.push(spot);
    out.push({ box: spot, lines: m.lines, truncated: m.truncated });
  }
  return out;
}

/**
 * Lay every entry out as READABLE TEXT inside its zone.
 *
 * This replaces the numbered chips. A number told the patient nothing: the
 * exercise works by seeing everything at once — yourself in the middle, what
 * you control inside, what you do not outside — and an interface that hides each
 * item behind a tap ships the mechanics and loses the mechanism.
 *
 * Nothing is ever dropped to make room. As a zone fills, the TEXT BUDGET
 * shrinks; entries keep their place and the shortened ones are flagged so the
 * surface can offer the full wording. The previous `chipSlots` silently returned
 * fewer slots than asked for, so a busy zone left entries with no mark at all.
 *
 * `minFontSize` is the caller's legibility floor in canvas units — a phone
 * renders the canvas at roughly 0.42x, a wide screen at 0.8x, so the two
 * surfaces are entitled to different budgets for the same answer. Answers store
 * no coordinates, which is exactly what makes that safe.
 *
 * Searched cheaply on purpose: each budget is tried once at the floor (likeliest
 * to fit, cheapest to reject) and the type is only grown after one succeeds.
 * Sweeping every pair took ~100M operations per render and froze the page.
 */
export function labelSlots(
  zone: CanvasZone,
  zones: CanvasZone[],
  texts: string[],
  opts: { minFontSize: number },
): LabelLayout {
  const minFontSize = Math.max(8, Math.round(opts.minFontSize));
  if (!texts.length) return { labels: [], fontSize: minFontSize, budget: BUDGET_STEPS[0], overflowed: false };

  const box = shapeBox(zone.shape);
  if (box.w <= 0 || box.h <= 0) {
    return { labels: texts.map(() => null), fontSize: minFontSize, budget: BUDGET_STEPS[0], overflowed: true };
  }
  const children = childZonesOf(zones, zone.id);
  const labelLines = wrapLabel(zoneLabel(zone.label), box.w - 24).length || 1;
  const wanted = LABEL_BAND + (labelLines - 1) * 20 + (zone.parentZoneId ? 8 : 0);
  const band = box.h > wanted * 2 ? wanted : 0;

  for (const budget of BUDGET_STEPS) {
    const atFloor = packAll(zone, children, box, band, texts, budget, minFontSize);
    if (!atFloor) continue;
    let best = atFloor;
    let bestFont = minFontSize;
    for (let fs = minFontSize + 2; fs <= MAX_FONT_SIZE; fs += 2) {
      const bigger = packAll(zone, children, box, band, texts, budget, fs);
      if (!bigger) break;
      best = bigger;
      bestFont = fs;
    }
    return { labels: best, fontSize: bestFont, budget, overflowed: false };
  }

  // Genuinely too full. Place what fits at the tightest budget and report the
  // rest as null rather than pretending they are on the canvas.
  const smallest = BUDGET_STEPS[BUDGET_STEPS.length - 1];
  const used: Box[] = [];
  const labels: (CanvasLabel | null)[] = texts.map((text) => {
    const m = measureEntry(text, smallest, minFontSize);
    const step = Math.max(10, Math.round(Math.min(m.w, m.h) / 2));
    for (let y = box.y + band + 3; y + m.h <= box.y + box.h - 3; y += step) {
      for (let x = box.x + 3; x + m.w <= box.x + box.w - 3; x += step) {
        const cand: Box = { x, y, w: m.w, h: m.h };
        if (!rectInside(zone.shape, cand)) continue;
        if (children.some((c) => !rectClear(c.shape, cand))) continue;
        const clash = used.some((u) =>
          cand.x < u.x + u.w + LABEL_GAP && cand.x + cand.w + LABEL_GAP > u.x &&
          cand.y < u.y + u.h + LABEL_GAP && cand.y + cand.h + LABEL_GAP > u.y);
        if (clash) continue;
        used.push(cand);
        return { box: cand, lines: m.lines, truncated: m.truncated };
      }
    }
    return null;
  });
  return { labels, fontSize: minFontSize, budget: smallest, overflowed: labels.some((l) => l === null) };
}


/**
 * Flatten a canvas block's per-language zone labels down to the ONE the
 * practitioner wrote, using the resource's own language.
 *
 * v1's starter templates ship a label per language; a practitioner who rewrites
 * them edits the language they work in and leaves the rest as the stock text. So
 * choosing by the READER's locale showed an English patient "What I CAN'T
 * Control" while their French practitioner had written a whole sentence of their
 * own. The resource's language is the author's language, and what the author
 * wrote is what everybody should read, whatever their phone is set to.
 */
export function resolveZoneLabels<T extends { type: string; zones?: CanvasZone[] }>(blocks: T[], language?: string): T[] {
  return blocks.map((b) => {
    if (b.type !== 'zoned_canvas' || !b.zones?.length) return b;
    return { ...b, zones: b.zones.map((z) => ({ ...z, label: zoneLabel(z.label, language) })) };
  });
}

// Roughly how wide a character is at the label font size, in canvas units. SVG
// text does not wrap, and a practitioner's label can be a full sentence, so the
// wrap has to be computed rather than left to the renderer.
const CHAR_WIDTH = 8.6;
const MAX_LABEL_LINES = 3;

/** Break a label into lines that fit the given width, longest-word-safe and
 *  capped so a paragraph cannot swallow the zone. The full text always remains
 *  in the legend below the canvas. */
export function wrapLabel(text: string, widthUnits: number, fontSize = 17): string[] {
  const clean = (text ?? '').trim().replace(/\s+/g, ' ');
  if (!clean) return [];
  const perLine = Math.max(8, Math.floor(widthUnits / (CHAR_WIDTH * (fontSize / 17))));
  if (clean.length <= perLine) return [clean];

  const lines: string[] = [];
  let line = '';
  for (const word of clean.split(' ')) {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length <= perLine) { line = candidate; continue; }
    if (line) lines.push(line);
    // A single word longer than the line is cut rather than allowed to overflow.
    line = word.length > perLine ? `${word.slice(0, perLine - 1)}…` : word;
    if (lines.length === MAX_LABEL_LINES) break;
  }
  if (line && lines.length < MAX_LABEL_LINES) lines.push(line);
  if (lines.length === MAX_LABEL_LINES) {
    const last = lines[MAX_LABEL_LINES - 1];
    const consumed = lines.join(' ').length;
    if (consumed < clean.length && !last.endsWith('…')) {
      lines[MAX_LABEL_LINES - 1] = `${last.slice(0, Math.max(1, perLine - 1))}…`;
    }
  }
  return lines;
}

// The strip at the top of a zone the label occupies. Chips keep out of it, so a
// number never lands on the words naming the region.
const LABEL_BAND = 30;

/** Where a zone's label sits. A NESTED zone is pushed further down: at the top
 *  of a circle drawn inside a rect, the two labels and the circle's own outline
 *  all converge, which is exactly the overlap v1 spent a polish pass fixing. */
export function labelAnchor(shape: ZoneShape, nested = false): Point {
  const box = shapeBox(shape);
  return { x: box.x + box.w / 2, y: box.y + (nested ? 38 : 22) };
}

/** Total entries across every zone — used to tell an untouched canvas from a
 *  filled one without walking the answer twice at each call site. */
export function countEntries(answer: Record<string, { length: number }[]> | Record<string, unknown> | null | undefined): number {
  if (!answer || typeof answer !== 'object') return 0;
  let n = 0;
  for (const v of Object.values(answer as Record<string, unknown>)) if (Array.isArray(v)) n += v.length;
  return n;
}

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

// A chip is a numbered dot; this is its radius in canvas units, used to keep
// chips off the zone outline rather than straddling it.
const CHIP_RADIUS = 14;
// Grid densities tried in order. A sparse grid spreads chips out; if the zone is
// mostly occupied by children (or is a thin polygon) the denser passes find the
// slots the first one could not.
const DENSITY_STEPS = [1, 1.6, 2.4, 3.6];

/**
 * Positions for `count` chips inside a zone, avoiding its child zones and its
 * own outline. Deterministic: the same answer lays out the same way every time,
 * on every surface — a patient who reopens their exercise sees what they left.
 *
 * Returns fewer points than asked for only when the zone genuinely cannot hold
 * them; callers show the overflow in the legend, which lists every entry anyway.
 */
export function chipSlots(zone: CanvasZone, zones: CanvasZone[], count: number): Point[] {
  if (count <= 0) return [];
  const box = shapeBox(zone.shape);
  if (box.w <= 0 || box.h <= 0) return [];
  const children = childZonesOf(zones, zone.id);

  // A short zone (the Body Map's head) would have no room left if the label
  // band were reserved, so it is only kept clear where there is height to spare.
  const band = box.h > LABEL_BAND * 3 ? LABEL_BAND + (zone.parentZoneId ? 8 : 0) : 0;

  const fits = (p: Point): boolean => {
    if (p.y - CHIP_RADIUS < box.y + band) return false;
    // The chip is a disc, not a point: it has to sit WHOLLY inside the zone and
    // wholly clear of any nested one. Sampling a few offsets is not enough —
    // on a circle, a chip on the diagonal passes a north/south/east/west check
    // while still hanging over the edge — so each shape is tested analytically.
    if (!discInside(zone.shape, p, CHIP_RADIUS)) return false;
    for (const c of children) if (!discClear(c.shape, p, CHIP_RADIUS)) return false;
    return true;
  };

  let best: Point[] = [];
  for (const density of DENSITY_STEPS) {
    // Aim for a grid whose cells are roughly square and numerous enough to hold
    // `count` even after the invalid cells are dropped.
    const target = Math.max(1, Math.ceil(count * density));
    const ratio = box.w / box.h;
    const rows = Math.max(1, Math.round(Math.sqrt(target / Math.max(ratio, 0.0001))));
    const cols = Math.max(1, Math.ceil(target / rows));

    const found: Point[] = [];
    for (let r = 0; r < rows && found.length < count; r++) {
      for (let c = 0; c < cols && found.length < count; c++) {
        const p = {
          x: box.x + (box.w * (c + 0.5)) / cols,
          y: box.y + (box.h * (r + 0.5)) / rows,
        };
        if (fits(p)) found.push(p);
      }
    }
    if (found.length > best.length) best = found;
    if (best.length >= count) break;
  }
  return best.slice(0, count);
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

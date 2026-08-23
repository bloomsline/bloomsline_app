// A shape per feeling, for the nodes on the line.
//
// Every moment used to be the same 56px circle, so the timeline read as a row of
// identical dots and the feeling lived only in a small colour swatch. This gives
// each emotion its own silhouette.
//
// WHY PARAMETERS AND NOT 21 DRAWINGS. A moment can hold up to three feelings and
// the shape has to represent all of them at once. Two hand-drawn SVG paths cannot
// be averaged into a third that means anything — but two parameter vectors can,
// and the form that comes out sits genuinely between its parents. So the shapes
// are generated, and blending is a lerp.
//
// The vector is deliberately small, because each field has to be something a
// person can actually SEE at node size:
//
//   points    how many lobes go round the form      2 (a bud) … 12 (a shatter)
//   amp       how far those lobes leave the circle  0 (still) … 0.36 (violent)
//   sharp     crest quality                         0 soft and round … 1 spiked
//   rotate    where the first lobe sits             separates otherwise-alike forms
//   stretch   aspect                                >1 reaching up, <1 pressed down
//   bias      where the mass sits                   +1 rises, −1 sinks
//   jitter    irregularity                          0 composed … 1 unsettled
//
// The four quadrants of the mood meter fall out of the numbers rather than being
// hardcoded: pleasant-calm feelings are low `amp`, low `sharp`, positive `bias`;
// unpleasant-activated ones are high `points`, high `sharp`, high `jitter`.

export interface MoodShape {
  points: number;
  amp: number;
  sharp: number;
  rotate: number;
  stretch: number;
  bias: number;
  jitter: number;
}

/** No feeling recorded. A plain circle — the one form that claims nothing. */
export const NEUTRAL_SHAPE: MoodShape = { points: 0, amp: 0, sharp: 0, rotate: 0, stretch: 1, bias: 0, jitter: 0 };

const s = (points: number, amp: number, sharp: number, rotate: number, stretch: number, bias: number, jitter: number): MoodShape =>
  ({ points, amp, sharp, rotate, stretch, bias, jitter });

const TURN = Math.PI * 2;

/**
 * The vocabulary. Grouped by the mood meter's two axes — how pleasant, and how
 * activated — because that is what the eye reads first at 56px; the specific
 * emotion is then carried by colour and by the smaller differences here.
 */
export const MOOD_SHAPES: Record<string, MoodShape> = {
  // ── Pleasant · settled ──────────────────────────────────────────────
  // Few lobes, shallow, soft crests, mass sitting slightly high. These should
  // look like they are at rest: nothing on them points at you.
  peaceful: s(3, 0.03, 0.0, 0.00, 1.00, 0.08, 0.00), // very nearly the circle it started as
  calm: s(4, 0.11, 0.0, TURN / 8, 1.00, 0.08, 0.00), // a clear four-fold sway
  tender: s(3, 0.13, 0.0, TURN / 6, 1.05, 0.14, 0.10), // three soft lobes, a little uneven — care is not tidy
  grateful: s(5, 0.15, 0.05, TURN / 10, 1.02, 0.20, 0.00), // full and open, five broad petals
  loved: s(2, 0.24, 0.30, TURN / 4, 1.00, 0.34, 0.00), // two lobes above a point — a heart, without drawing one
  hopeful: s(5, 0.14, 0.30, TURN / 20, 1.22, 0.46, 0.02), // stretched upward, reaching

  // ── Pleasant · activated ────────────────────────────────────────────
  // The energy shows as more lobes and sharper crests, but the mass still rises:
  // this is the difference between a burst and a lash.
  funny: s(7, 0.16, 0.15, TURN / 14, 0.96, 0.16, 0.30), // an irregular ripple that will not sit still
  playful: s(6, 0.26, 0.45, TURN / 9, 1.00, 0.24, 0.30), // bouncing, off-axis
  proud: s(5, 0.24, 0.70, TURN / 4, 1.16, 0.36, 0.00), // an upright star, squarely on its point
  inspired: s(6, 0.30, 0.78, TURN / 12, 1.06, 0.30, 0.02), // a spark throwing light outward
  joyful: s(9, 0.26, 0.55, 0.00, 1.02, 0.28, 0.00), // an even sunburst — the most open form here

  // ── Unpleasant · activated ──────────────────────────────────────────
  // Many lobes, hard crests, jitter. Angry and fearful are close in valence and
  // used to be indistinguishable on the line; they are not close in shape.
  restless: s(10, 0.15, 0.40, TURN / 16, 1.02, 0.06, 0.34), // small fast agitation
  anxious: s(13, 0.13, 0.55, TURN / 22, 1.06, 0.10, 0.46), // a tremor round the whole edge
  fear: s(7, 0.31, 0.85, TURN / 4, 1.26, 0.04, 0.20), // tall, spiked, pointing away
  angry: s(9, 0.34, 0.92, TURN / 18, 1.00, 0.02, 0.12), // a flare, hardest crests in the set
  overwhelmed: s(12, 0.28, 0.72, TURN / 24, 1.00, -0.06, 0.50), // too many directions at once

  // ── Unpleasant · settled ────────────────────────────────────────────
  // The mass sinks and the form flattens. Weight, not spikes — and each one
  // sinks differently, or they all read as the same grey blob.
  uncertain: s(5, 0.15, 0.15, TURN / 7, 1.00, -0.10, 0.38), // wobbling, no clear direction
  tired: s(2, 0.12, 0.05, TURN / 4, 0.76, -0.34, 0.06), // pressed flat, wider than tall
  sad: s(1, 0.30, 0.72, TURN / 4, 1.24, -0.44, 0.02), // a drop, pointed at the top, hanging
  heavy: s(3, 0.14, 0.10, -TURN / 4, 0.74, -0.58, 0.00), // squat, settled on its base, hard to lift
  lonely: s(1, 0.34, 0.55, TURN / 2, 1.06, -0.26, 0.06), // one lobe, turned away to the side
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const mix = (a: MoodShape, b: MoodShape, t: number): MoodShape => ({
  points: lerp(a.points, b.points, t),
  amp: lerp(a.amp, b.amp, t),
  sharp: lerp(a.sharp, b.sharp, t),
  rotate: lerp(a.rotate, b.rotate, t),
  stretch: lerp(a.stretch, b.stretch, t),
  bias: lerp(a.bias, b.bias, t),
  jitter: lerp(a.jitter, b.jitter, t),
});

/**
 * The shape for a moment, blending every feeling it holds.
 *
 * Averaged evenly rather than weighted: a patient picking "grateful" and
 * "anxious" is telling us it was both, and quietly deciding one of them mattered
 * more would be us editing their answer.
 *
 * Unknown keys are skipped, not defaulted — the backend keeps ids this client
 * has never heard of, and a stranger should not drag every shape toward neutral.
 */
export function shapeFor(moods: readonly string[]): MoodShape {
  const known = moods.map((m) => MOOD_SHAPES[m]).filter((v): v is MoodShape => !!v);
  if (known.length === 0) return NEUTRAL_SHAPE;
  return known.reduce((acc, next, i) => (i === 0 ? next : mix(acc, next, 1 / (i + 1))));
}

/** Deterministic per-vertex noise. Not Math.random: the same moment has to draw
 *  the same shape on every render, or the line crawls. */
const wobble = (i: number, seed: number) => {
  const n = Math.sin(i * 12.9898 + seed * 78.233) * 43758.5453;
  return (n - Math.floor(n)) - 0.5;
};

/**
 * The outline, as an SVG path centred on (cx, cy).
 *
 * Sampled radially and closed with Catmull-Rom, where the tangent scale falls to
 * zero as `sharp` rises — so one generator covers everything from a soft bud to a
 * hard star, and a blend between them is a real shape rather than a crossfade.
 */
export function shapePath(shape: MoodShape, cx: number, cy: number, radius: number): string {
  const { points, amp, sharp, rotate, stretch, bias, jitter } = shape;
  const steps = Math.max(72, Math.round(points) * 16);
  const seed = points * 7.3 + amp * 31.1 + rotate * 5.7;

  const raw: [number, number][] = [];
  let reach = 0;
  for (let i = 0; i < steps; i++) {
    const theta = (i / steps) * TURN;
    // Crest shaping: |cos|^p keeps the peaks narrow and the valleys broad as p
    // grows, which is the difference between a wave and a spike.
    const wave = Math.cos(points * theta + rotate);
    const shaped = Math.sign(wave) * Math.abs(wave) ** (1 + sharp * 3);
    // `bias` fattens one end: +up, −down. sin is positive at the top because y
    // is flipped below.
    const lean = 1 + bias * 0.20 * Math.sin(theta);
    const noise = jitter * wobble(i, seed) * 0.16;
    const r = 1 + amp * shaped + noise;
    const dx = r * Math.cos(theta) * lean;
    const dy = -r * Math.sin(theta) * lean * stretch;
    raw.push([dx, dy]);
    reach = Math.max(reach, Math.hypot(dx, dy));
  }

  // Normalise to the requested radius. Without this a twelve-spike `overwhelmed`
  // is physically twice the size of `peaceful` and dominates the line by
  // accident — the shape should say what the feeling IS, not how loud it is.
  const k2 = radius / (reach || 1);
  const pts: [number, number][] = raw.map(([dx, dy]) => [cx + dx * k2, cy + dy * k2]);

  const at = (i: number) => pts[(i + pts.length) % pts.length];
  const k = (1 - sharp) / 6; // tangent scale: 0 gives straight edges between crests
  let d = `M ${at(0)[0].toFixed(2)} ${at(0)[1].toFixed(2)}`;
  for (let i = 0; i < pts.length; i++) {
    const [x0, y0] = at(i - 1);
    const [x1, y1] = at(i);
    const [x2, y2] = at(i + 1);
    const [x3, y3] = at(i + 2);
    const c1x = x1 + (x2 - x0) * k;
    const c1y = y1 + (y2 - y0) * k;
    const c2x = x2 - (x3 - x1) * k;
    const c2y = y2 - (y3 - y1) * k;
    d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${x2.toFixed(2)} ${y2.toFixed(2)}`;
  }
  return `${d} Z`;
}

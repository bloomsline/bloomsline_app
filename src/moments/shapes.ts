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
//   inward    which way the lobes go                 0 spikes out … 1 bites in
//   ripple    a second, finer frequency              0 none … ~20 a fine tremor
//   rippleAmp how deep that tremor runs
//
// `inward` and `ripple` exist because the first version had only one way to say
// "activated" — more lobes, sharper crests — so every energetic feeling came out
// a star, and half the vocabulary looked alike on the thread. Energy is not one
// thing: `playful` is bouncy, `anxious` is a tremor, `angry` is spikes. Bounce is
// a round lobe pushed OUT, a tremor is a fine second frequency, and a bite is a
// lobe pushed IN. Those are different axes, and they have to be separate.
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
  /** 0 pushes every lobe outward (a star), 1 pulls them inward (a bite),
   *  0.5 is the symmetric wave the first version could only ever draw. */
  inward: number;
  /** A finer second frequency laid over the form — texture, not silhouette. */
  ripple: number;
  rippleAmp: number;
}

/** No feeling recorded. A plain circle — the one form that claims nothing. */
export const NEUTRAL_SHAPE: MoodShape = { points: 0, amp: 0, sharp: 0, rotate: 0, stretch: 1, bias: 0, jitter: 0, inward: 0.5, ripple: 0, rippleAmp: 0 };

const s = (
  points: number, amp: number, sharp: number, rotate: number, stretch: number, bias: number, jitter: number,
  inward = 0.5, ripple = 0, rippleAmp = 0,
): MoodShape => ({ points, amp, sharp, rotate, stretch, bias, jitter, inward, ripple, rippleAmp });

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
  // Energetic, and deliberately NOT spiky. A spike is a threat; delight is a
  // bounce. These push their lobes OUT and keep them round, which is what
  // separates this row from the difficult one below — the first version made
  // both of them stars and five feelings in a row looked like one.
  funny: s(4, 0.10, 0.05, TURN / 14, 0.98, 0.16, 0.20, 0.30, 13, 0.055), // a round body giggling — fine ripple, no points
  playful: s(5, 0.26, 0.05, TURN / 9, 1.00, 0.24, 0.34, 0.05, 0, 0), // big soft bounces, off-axis
  proud: s(3, 0.22, 0.50, TURN / 4, 1.20, 0.42, 0.00, 0.10, 0, 0), // upright, three broad points — a shield, not a sparkle
  inspired: s(4, 0.36, 0.90, TURN / 8, 1.06, 0.30, 0.00, 0.05, 0, 0), // four long rays with air between them — a spark
  joyful: s(11, 0.20, 0.35, 0.00, 1.02, 0.28, 0.00, 0.15, 0, 0), // the one true sunburst, and the only one

  // ── Unpleasant · activated ──────────────────────────────────────────
  // Here the energy IS sharp, and the row separates by frequency rather than by
  // adding points: a tremor, an agitation, a spike, a flare, and both at once.
  restless: s(0, 0.00, 0.00, 0.00, 1.02, 0.06, 0.34, 0.50, 12, 0.11), // a circle that will not keep still
  anxious: s(0, 0.00, 0.00, 0.00, 1.06, 0.10, 0.50, 0.50, 21, 0.065), // a much finer, faster tremor
  fear: s(3, 0.40, 0.95, TURN / 4, 1.34, 0.06, 0.18, 0.05, 0, 0), // tall and jagged, pointing away
  angry: s(6, 0.34, 0.92, TURN / 18, 1.00, 0.02, 0.10, 0.05, 0, 0), // six hard spikes — a flare
  overwhelmed: s(5, 0.26, 0.80, TURN / 24, 1.00, -0.06, 0.42, 0.20, 17, 0.075), // spikes AND a tremor: two things at once

  // ── Unpleasant · settled ────────────────────────────────────────────
  // The mass sinks and the form flattens. Weight, not spikes — and each one
  // sinks differently, or they all read as the same grey blob.
  uncertain: s(5, 0.16, 0.20, TURN / 7, 1.00, -0.10, 0.34, 0.80, 0, 0), // scalloped inward — edges eaten away
  tired: s(2, 0.14, 0.05, TURN / 4, 0.70, -0.40, 0.06), // pressed flat, wider than tall — sagging
  sad: s(1, 0.46, 0.88, TURN / 4, 1.26, -0.42, 0.02, 0.15), // a drop: drawn to a point at the top, heavy underneath
  heavy: s(3, 0.14, 0.10, -TURN / 4, 0.74, -0.58, 0.00), // squat, settled on its base, hard to lift
  lonely: s(1, 0.40, 0.45, TURN / 2, 1.04, -0.20, 0.02, 1.00), // a whole form with one piece bitten out of it
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
  inward: lerp(a.inward, b.inward, t),
  ripple: lerp(a.ripple, b.ripple, t),
  rippleAmp: lerp(a.rippleAmp, b.rippleAmp, t),
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
  const { points, amp, sharp, rotate, stretch, bias, jitter, inward, ripple, rippleAmp } = shape;
  const steps = Math.max(96, Math.round(Math.max(points, ripple)) * 16);
  const seed = points * 7.3 + amp * 31.1 + rotate * 5.7;

  const raw: [number, number][] = [];
  let reach = 0;
  for (let i = 0; i < steps; i++) {
    const theta = (i / steps) * TURN;
    // Crest shaping: |cos|^p keeps the peaks narrow and the valleys broad as p
    // grows, which is the difference between a wave and a spike.
    const wave = Math.cos(points * theta + rotate);
    const shaped = Math.sign(wave) * Math.abs(wave) ** (1 + sharp * 3);
    // Split the crest from the trough so the lobes can go one way or the other:
    // outward is a spike, inward is a bite, and half-and-half is a plain wave.
    const out = Math.max(shaped, 0) * (1 - inward) * 2;
    const cut = Math.min(shaped, 0) * inward * 2;
    const tremor = rippleAmp * Math.cos(ripple * theta + rotate * 1.7);
    // `bias` fattens one end: +up, −down. sin is positive at the top because y
    // is flipped below.
    const lean = 1 + bias * 0.20 * Math.sin(theta);
    const noise = jitter * wobble(i, seed) * 0.16;
    const r = 1 + amp * (out + cut) + tremor + noise;
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

// A person's own mark, for when they have not given us a photograph.
//
// Same shape engine as the Moments line, deliberately NOT the same shapes. The
// mood silhouettes mean something — `angry` is six hard spikes, `sad` is a
// heavy drop — and handing somebody one of those as their identity would say
// something about them that nobody chose. So the parameters are synthesised
// from a seed instead, inside a range that can only ever produce calm forms:
// low `sharp`, no `jitter`, a symmetric wave. Every avatar is a soft blob; the
// seed decides which one.
//
// Deterministic, so a person's mark never changes, and local, so nothing about
// who they are is sent anywhere to draw it.
import { NEUTRAL_SHAPE, type MoodShape } from '@/src/moments/shapes';

/** Small, stable string hash. Not cryptographic — it picks a shape. */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** A deterministic 0..1 stream from one seed, so each trait is independent. */
function streamOf(seed: number) {
  let x = seed || 1;
  return () => {
    x ^= x << 13; x >>>= 0;
    x ^= x >> 17;
    x ^= x << 5; x >>>= 0;
    return x / 4294967296;
  };
}

/** The palette an identity mark may be drawn in. Chosen to sit beside the app's
 *  accent rather than compete with the mood colours on the line. */
const INK = ['#4A9A86', '#5B8FB9', '#8B7EC8', '#C97BA0', '#C98A5B', '#6FA76F'] as const;

export interface IdentityMark {
  shape: MoodShape;
  color: string;
}

/**
 * The mark for a person, from whatever name or address identifies them.
 *
 * Falls back to the plain circle when there is nothing to seed with — an empty
 * seed would give everyone the same shape, which is worse than giving them no
 * shape at all.
 */
export function identityMark(seed: string | null | undefined): IdentityMark {
  const key = (seed ?? '').trim().toLowerCase();
  if (!key) return { shape: NEUTRAL_SHAPE, color: INK[0] };

  const h = hash(key);
  const r = streamOf(h);

  return {
    color: INK[h % INK.length],
    shape: {
      // 3–6 lobes. Two reads as a heart and one as a drop, and both of those
      // are taken.
      points: 3 + Math.floor(r() * 4),
      // Enough to be a silhouette, never enough to be a star.
      amp: 0.10 + r() * 0.10,
      sharp: r() * 0.12,
      rotate: r() * Math.PI * 2,
      stretch: 0.96 + r() * 0.10,
      bias: (r() - 0.5) * 0.24,
      jitter: 0,
      inward: 0.5,
      ripple: 0,
      rippleAmp: 0,
    },
  };
}

/**
 * Seeded RNG. No dependency, no Math.random — which is what makes `--seed` a
 * real guarantee rather than a hope.
 */

/** xmur3 string hash → 32-bit seed. */
export function hashSeed(str: string): number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^ (h >>> 16)) >>> 0;
}

export interface Rng {
  /** [0, 1) */
  next(): number;
  int(maxExclusive: number): number;
  pick<T>(xs: readonly T[]): T;
  shuffle<T>(xs: readonly T[]): T[];
  bool(p: number): boolean;
  /** Lowercase hex of the given length. */
  hex(len: number): string;
  /**
   * A deterministic CHILD stream, independent of how much any sibling consumed.
   *
   * This is the part that is easy to get wrong. With one shared stream,
   * inserting a mutator in the middle of a chain shifts the stream of every
   * mutator after it and silently changes payloads that should not have moved.
   * Each mutator gets `rng.fork(mutator.id)`; each variant gets
   * `rng.fork(`${techniqueId}:${i}`)`.
   */
  fork(label: string): Rng;
  readonly seed: number;
}

export function createRng(seed: string | number): Rng {
  const rootSeed = typeof seed === "number" ? seed >>> 0 : hashSeed(seed);
  let a = rootSeed;

  // mulberry32
  const next = (): number => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const rng: Rng = {
    seed: rootSeed,
    next,
    int: (maxExclusive) => (maxExclusive <= 0 ? 0 : Math.floor(next() * maxExclusive)),
    pick<T>(xs: readonly T[]): T {
      if (xs.length === 0) throw new Error("rng.pick: empty array");
      return xs[Math.floor(next() * xs.length)] as T;
    },
    shuffle<T>(xs: readonly T[]): T[] {
      const out = [...xs];
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [out[i], out[j]] = [out[j] as T, out[i] as T];
      }
      return out;
    },
    bool: (p) => next() < p,
    hex(len) {
      let s = "";
      while (s.length < len) s += Math.floor(next() * 0x10000).toString(16).padStart(4, "0");
      return s.slice(0, len);
    },
    // Derived from (rootSeed, label) only — never from the parent's position in
    // its own stream. That independence is the whole point.
    fork: (label) => createRng(hashSeed(`${rootSeed}::${label}`)),
  };

  return rng;
}

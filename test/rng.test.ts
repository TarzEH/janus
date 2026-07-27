import { describe, expect, it } from "vitest";
import { createRng, hashSeed } from "../src/rng/rng.js";

describe("rng", () => {
  it("is deterministic for the same seed", () => {
    const a = Array.from({ length: 10 }, () => createRng("hunter2").next());
    const b = Array.from({ length: 10 }, () => createRng("hunter2").next());
    expect(a).toEqual(b);
  });

  it("differs across seeds", () => {
    expect(createRng("a").next()).not.toBe(createRng("b").next());
  });

  it("stays inside [0, 1)", () => {
    const rng = createRng("range");
    for (let i = 0; i < 1000; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("hashes seeds to unsigned 32-bit values", () => {
    for (const s of ["", "a", "hunter2", "🙂"]) {
      const h = hashSeed(s);
      expect(Number.isInteger(h)).toBe(true);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThanOrEqual(0xffffffff);
    }
  });

  /**
   * The one that actually matters. With a single shared stream, inserting a
   * mutator mid-chain shifts every later mutator's randomness and silently
   * changes payloads that should not have moved.
   */
  it("gives forks streams independent of sibling consumption", () => {
    const parent = createRng("root");
    const before = parent.fork("zero-width").hex(8);

    const noisy = createRng("root");
    noisy.fork("leetspeak");
    for (let i = 0; i < 500; i++) noisy.next();
    const after = noisy.fork("zero-width").hex(8);

    expect(after).toBe(before);
  });

  it("gives different forks different streams", () => {
    const rng = createRng("root");
    expect(rng.fork("a").hex(8)).not.toBe(rng.fork("b").hex(8));
  });

  it("shuffles without losing or duplicating elements", () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8];
    const out = createRng("s").shuffle(input);
    expect(out.sort((a, b) => a - b)).toEqual(input);
  });

  it("produces hex of the requested length", () => {
    for (const n of [1, 4, 8, 16, 33]) {
      expect(createRng("h").hex(n)).toMatch(new RegExp(`^[0-9a-f]{${n}}$`));
    }
  });
});

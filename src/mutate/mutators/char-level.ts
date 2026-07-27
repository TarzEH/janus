import { mapRanges } from "../../text/ranges.js";
import type { Mutator } from "../types.js";

const LEET: Readonly<Record<string, string>> = {
  a: "4",
  b: "8",
  e: "3",
  g: "9",
  i: "1",
  l: "1",
  o: "0",
  s: "5",
  t: "7",
  z: "2",
};

/**
 * Latin → visually identical Cyrillic/Greek. Defeats naive keyword matching
 * while remaining fully readable to a human reviewer, which is precisely what
 * makes it worth testing.
 */
const HOMOGLYPH: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  cyrillic: {
    a: "а", c: "с", e: "е", i: "і", j: "ј", o: "о",
    p: "р", s: "ѕ", x: "х", y: "у",
    A: "А", B: "В", C: "С", E: "Е", H: "Н", K: "К",
    M: "М", O: "О", P: "Р", T: "Т", X: "Х",
  },
  greek: {
    a: "α", o: "ο", v: "ν", x: "χ",
    A: "Α", B: "Β", E: "Ε", H: "Η", I: "Ι", K: "Κ",
    M: "Μ", N: "Ν", O: "Ο", P: "Ρ", T: "Τ", X: "Χ",
  },
};

const ZERO_WIDTH: Readonly<Record<string, string>> = {
  zwsp: "​",
  zwnj: "‌",
  zwj: "‍",
};

export const leetspeak: Mutator = {
  id: "leetspeak",
  kind: "obfuscation",
  estimateLength: (n) => n,
  defaultParams: { density: 0.5 },
  describe: "Swaps letters for digit lookalikes to defeat lexical filters.",
  apply(input, ctx, params) {
    const density = Number(params?.density ?? this.defaultParams.density);
    const rng = ctx.rng.fork(this.id);
    const r = mapRanges(input, ctx.locked, (ch) => {
      const sub = LEET[ch.toLowerCase()];
      return sub && rng.bool(density) ? sub : ch;
    });
    return { text: r.text, locked: r.ranges, params: { density } };
  },
};

export const homoglyph: Mutator = {
  id: "homoglyph",
  kind: "obfuscation",
  estimateLength: (n) => n,
  defaultParams: { density: 0.35, alphabet: "cyrillic" },
  describe: "Swaps Latin letters for identical-looking Cyrillic or Greek codepoints.",
  apply(input, ctx, params) {
    const density = Number(params?.density ?? this.defaultParams.density);
    const alphabet = String(params?.alphabet ?? this.defaultParams.alphabet);
    const table = HOMOGLYPH[alphabet] ?? HOMOGLYPH.cyrillic!;
    const rng = ctx.rng.fork(this.id);
    const r = mapRanges(input, ctx.locked, (ch) => {
      const sub = table[ch];
      return sub && rng.bool(density) ? sub : ch;
    });
    return {
      text: r.text,
      locked: r.ranges,
      params: { density, alphabet },
      notes: ["Unicode normalization (NFKC) plus a confusables check defeats this."],
    };
  },
};

export const zeroWidth: Mutator = {
  id: "zero-width",
  kind: "obfuscation",
  estimateLength: (n, p) => Math.ceil(n * (1 + Number(p?.density ?? 0.25))),
  defaultParams: { density: 0.25, chars: "zwsp,zwnj" },
  describe: "Inserts invisible codepoints to break token-level string matching.",
  apply(input, ctx, params) {
    const density = Number(params?.density ?? this.defaultParams.density);
    const chars = String(params?.chars ?? this.defaultParams.chars);
    const pool = chars
      .split(",")
      .map((c) => ZERO_WIDTH[c.trim()])
      .filter((c): c is string => Boolean(c));
    if (pool.length === 0) pool.push(ZERO_WIDTH.zwsp!);
    const rng = ctx.rng.fork(this.id);
    const r = mapRanges(input, ctx.locked, (ch) =>
      /\S/.test(ch) && rng.bool(density) ? ch + rng.pick(pool) : ch,
    );
    return { text: r.text, locked: r.ranges, params: { density, chars } };
  },
};

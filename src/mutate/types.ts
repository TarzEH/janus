import type { Rng } from "../rng/rng.js";
import type { Range } from "../text/ranges.js";

export const MUTATOR_IDS = [
  "language-switch",
  "leetspeak",
  "homoglyph",
  "zero-width",
  "unicode-tags",
  "payload-splitting",
  "markdown-comment",
  "many-shot-padding",
  "rot13",
  "base64",
  // Added on measured guardrail-evasion rates rather than on novelty; see
  // mutators/smuggling.ts for the numbers and sources.
  "emoji-smuggling",
  "sneaky-bits",
  "upside-down",
  "bidi-override",
  "char-spacing",
  "flip-attack",
] as const;

export type MutatorId = (typeof MUTATOR_IDS)[number];

export type MutatorKind = "linguistic" | "obfuscation" | "structural" | "padding" | "encoding";

/**
 * Apply order. Composition is NOT commutative — leetspeak after base64 corrupts
 * the base64 — so order is enforced by stage rather than left to the caller.
 */
export const STAGE: Readonly<Record<MutatorKind, number>> = {
  linguistic: 10,
  obfuscation: 20,
  structural: 30,
  padding: 40,
  encoding: 50,
};

export interface MutationContext {
  readonly rng: Rng;
  /** Regions that must survive byte-identical: [[lock]] markers, the canary, objective params. */
  readonly locked: readonly Range[];
}

export interface MutationResult {
  readonly text: string;
  /** Locked ranges remapped into the new coordinate space. */
  readonly locked: readonly Range[];
  /** Fully resolved params — everything needed to replay this exact step. */
  readonly params: Readonly<Record<string, string | number | boolean>>;
  readonly notes?: readonly string[];
}

export interface Mutator {
  readonly id: MutatorId;
  readonly kind: MutatorKind;
  /**
   * Worst-case output length, so a chain can be rejected on size before any work
   * happens.
   *
   * Deliberately a function rather than a ratio: padding mutators add a roughly
   * ABSOLUTE amount (shots x example length) that has nothing to do with input
   * size, so a pure multiplier under-predicts them badly on short inputs and
   * over-predicts on long ones.
   */
  estimateLength(
    inputLength: number,
    params?: Readonly<Record<string, string | number | boolean>>,
  ): number;
  readonly defaultParams: Readonly<Record<string, string | number | boolean>>;
  /** One line, for `--mutators`. */
  readonly describe: string;
  apply(
    input: string,
    ctx: MutationContext,
    params?: Readonly<Record<string, string | number | boolean>>,
  ): MutationResult;
}

export interface AppliedMutation {
  readonly id: MutatorId;
  readonly params: Readonly<Record<string, string | number | boolean>>;
}

/**
 * How a caller picks a mutation chain: an explicit list, the technique's own
 * recommendation, or nothing.
 */
export type MutatorSelection = readonly MutatorId[] | "recommended" | "none";

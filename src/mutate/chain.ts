import type { Rng } from "../rng/rng.js";
import type { Range } from "../text/ranges.js";
import { getMutator, isMutatorId } from "./registry.js";
import { STAGE, type AppliedMutation, type Mutator, type MutatorId } from "./types.js";

/**
 * An absolute cap rather than a multiplier. The real failure mode is a payload
 * nobody can paste anywhere, and padding mutators add a fixed amount that has
 * nothing to do with input size — a ratio models them badly in both directions.
 */
export const DEFAULT_MAX_OUTPUT_CHARS = 200_000;

export interface ChainValidation {
  readonly ok: boolean;
  /** Stage-sorted execution order. Composition is not commutative. */
  readonly ordered: readonly MutatorId[];
  readonly errors: readonly string[];
  readonly dropped: readonly { id: string; reason: string }[];
  /** Worst-case output size, computed before any work happens. */
  readonly estimatedLength: number;
}

export interface ValidateChainOptions {
  /** From the technique entry — the catalog knows which mutators destroy which mechanisms. */
  readonly incompatible?: readonly string[];
  readonly inputLength?: number;
  readonly maxOutputChars?: number;
  readonly params?: Readonly<Record<string, Readonly<Record<string, string | number | boolean>>>>;
}

export function estimateChainLength(
  inputLength: number,
  chain: readonly MutatorId[],
  params?: ValidateChainOptions["params"],
): number {
  return chain.reduce((len, id) => {
    const m = getMutator(id);
    return m ? m.estimateLength(len, params?.[id]) : len;
  }, inputLength);
}

/**
 * Rejects a chain BEFORE any work happens, so the caller gets an explanation
 * rather than plausible-looking garbage.
 */
export function validateChain(
  ids: readonly string[],
  opts: ValidateChainOptions = {},
): ChainValidation {
  const errors: string[] = [];
  const dropped: { id: string; reason: string }[] = [];
  const incompatible = new Set(opts.incompatible ?? []);
  const maxOutput = opts.maxOutputChars ?? DEFAULT_MAX_OUTPUT_CHARS;

  const seen = new Set<MutatorId>();
  const kept: Mutator[] = [];

  for (const raw of ids) {
    if (!isMutatorId(raw)) {
      errors.push(`Unknown mutator "${raw}".`);
      continue;
    }
    if (seen.has(raw)) {
      dropped.push({ id: raw, reason: "duplicate" });
      continue;
    }
    if (incompatible.has(raw)) {
      errors.push(
        `Mutator "${raw}" is marked incompatible with this technique — applying it would destroy the mechanism under test.`,
      );
      continue;
    }
    seen.add(raw);
    kept.push(getMutator(raw) as Mutator);
  }

  const encodings = kept.filter((m) => m.kind === "encoding");
  if (encodings.length > 1) {
    errors.push(
      `At most one encoding mutator per chain; got ${encodings.map((m) => m.id).join(", ")}. Encoding is terminal — anything applied after it corrupts the encoding.`,
    );
  }

  const ordered = [...kept]
    .sort((a, b) => STAGE[a.kind] - STAGE[b.kind] || a.id.localeCompare(b.id))
    .map((m) => m.id);

  const estimatedLength = estimateChainLength(opts.inputLength ?? 0, ordered, opts.params);
  if (opts.inputLength !== undefined && estimatedLength > maxOutput) {
    errors.push(
      `Chain would produce roughly ${estimatedLength.toLocaleString()} characters, over the ${maxOutput.toLocaleString()} cap. Drop a padding or encoding step, or lower --shots.`,
    );
  }

  return { ok: errors.length === 0, ordered, errors, dropped, estimatedLength };
}

export interface ApplyChainInput {
  readonly text: string;
  readonly locked: readonly Range[];
  readonly chain: readonly MutatorId[];
  readonly rng: Rng;
  readonly params?: Readonly<Record<string, Readonly<Record<string, string | number | boolean>>>>;
  readonly maxOutputChars?: number;
}

export interface ApplyChainResult {
  readonly text: string;
  /**
   * The text as it stood before the terminal encoding step, if any.
   *
   * Invariants are checked against THIS rather than against `text`: a canary
   * inside a base64 blob is still there and still works, it is just not
   * greppable. Checking the encoded form would report a false failure; skipping
   * the check would report a false pass.
   */
  readonly verifiableText: string;
  readonly locked: readonly Range[];
  readonly applied: readonly AppliedMutation[];
  readonly notes: readonly string[];
}

export function applyChain(input: ApplyChainInput): ApplyChainResult {
  let text = input.text;
  let locked: readonly Range[] = input.locked;
  let verifiableText = input.text;
  let sawEncoding = false;
  const applied: AppliedMutation[] = [];
  const notes: string[] = [];

  for (const id of input.chain) {
    const mutator = getMutator(id);
    if (!mutator) throw new Error(`applyChain: unknown mutator "${id}"`);

    if (mutator.kind === "encoding") {
      verifiableText = text;
      sawEncoding = true;
    }

    const result = mutator.apply(
      text,
      {
        rng: input.rng,
        locked,
      },
      input.params?.[id],
    );

    text = result.text;
    locked = result.locked;
    applied.push({ id, params: result.params });
    if (result.notes) notes.push(...result.notes);
  }

  if (!sawEncoding) verifiableText = text;

  return { text, verifiableText, locked, applied, notes };
}

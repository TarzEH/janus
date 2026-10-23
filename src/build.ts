import { activeTechniques } from "./catalog/catalog.js";
import { applyChain, validateChain } from "./mutate/chain.js";
import { getMutator } from "./mutate/registry.js";
import type { MutatorId, MutatorSelection } from "./mutate/types.js";
import { renderTemplate } from "./render/template.js";
import { createRng, type Rng } from "./rng/rng.js";
import { CATEGORY_META } from "./schema/enums.js";
import type { Technique } from "./schema/technique.js";
import type { Range } from "./text/ranges.js";

/**
 * The whole tool: take the instruction you want a target model to carry out and
 * return it dressed in every documented injection technique that fits.
 *
 * There is no target profiling, no ranking and no scoring. Every applicable
 * technique fires, in catalog order, and you decide what to send. The only
 * things that shape the output are which techniques you selected, which
 * mutators ran, and the seed.
 */
export interface BuildOptions {
  /** The instruction you want the target model to carry out. */
  readonly instruction: string;
  /** Restrict the pool. Omitted means every technique that can be generated. */
  readonly techniqueIds?: readonly string[];
  readonly mutators?: MutatorSelection;
  readonly seed: string;
  readonly limit?: number;
  readonly maxOutputChars?: number;
  /** Extra techniques loaded at runtime (--load). Appended after the catalog. */
  readonly extraTechniques?: readonly Technique[];
}

export interface AppliedStep {
  readonly id: string;
  readonly params: Readonly<Record<string, string | number | boolean>>;
}

export interface Payload {
  readonly techniqueId: string;
  /** What you send. */
  readonly text: string;
  /** Pre-encoding form, when the chain ends in an encoder. */
  readonly verifiableText: string;
  /** Mutators that actually ran, in order, with resolved params. */
  readonly chain: readonly AppliedStep[];
  /** Problems with THIS payload. Belongs on stderr, never in the payload stream. */
  readonly warnings: readonly string[];
}

export interface BuildResult {
  readonly payloads: readonly Payload[];
  readonly seed: string;
  /** Techniques that exist but cannot be generated. Diagnostics, not output. */
  readonly skipped: readonly { id: string; reason: string }[];
}

/** Every occurrence of the instruction, so mutators leave it byte-identical. */
function criticalRanges(text: string, value: string): Range[] {
  const out: Range[] = [];
  if (!value) return out;
  let from = 0;
  for (;;) {
    const i = text.indexOf(value, from);
    if (i < 0) break;
    out.push({ start: i, end: i + value.length });
    from = i + value.length;
  }
  return out;
}

function buildOne(t: Technique, instruction: string, opts: BuildOptions, rootRng: Rng): Payload {
  const body = t.multiTurn
    ? t.template.turns
        .map(
          (turn, i) =>
            `[Turn ${i + 1} · send as ${turn.role}]${turn.note ? `  (${turn.note})` : ""}\n${turn.body}`,
        )
        .join("\n\n")
    : t.template.body;

  const rendered = renderTemplate(body, t.slots, { objective: instruction });

  const locked = [...rendered.locked, ...criticalRanges(rendered.text, instruction)].sort(
    (a, b) => a.start - b.start,
  );

  const selection = opts.mutators ?? "recommended";
  const requested =
    selection === "none"
      ? []
      : selection === "recommended"
        ? (t.mutators.recommended as MutatorId[])
        : [...selection];
  const incompatible = new Set(t.mutators.incompatible);
  const usable = requested.filter((id) => getMutator(id) && !incompatible.has(id));
  const dropped = requested.filter((id) => incompatible.has(id));

  const validation = validateChain(usable, {
    incompatible: t.mutators.incompatible,
    inputLength: rendered.text.length,
    maxOutputChars: opts.maxOutputChars,
  });

  const applied = applyChain({
    text: rendered.text,
    locked,
    chain: validation.ok ? validation.ordered : [],
    // The technique id seeds the mutator stream. Renaming an id changes every
    // payload it produces, which is why ids are permanent.
    rng: rootRng.fork(`${t.id}:0`),
    maxOutputChars: opts.maxOutputChars,
  });

  const warnings: string[] = [...validation.errors];
  if (dropped.length > 0) {
    warnings.push(`dropped mutator(s) incompatible with this technique: ${dropped.join(", ")}`);
  }
  if (!applied.verifiableText.includes(instruction)) {
    warnings.push(
      "your instruction did not survive mutation byte-identical; drop an obfuscation step if the target needs it verbatim",
    );
  }

  return {
    techniqueId: t.id,
    text: applied.text,
    verifiableText: applied.verifiableText,
    chain: applied.applied.map((a) => ({ id: a.id, params: a.params })),
    warnings,
  };
}

export function build(opts: BuildOptions): BuildResult {
  const instruction = opts.instruction.trim();
  if (!instruction) {
    throw new Error("empty input: supply the instruction you want the target to carry out");
  }

  const rootRng = createRng(opts.seed);
  const wanted = opts.techniqueIds?.length ? new Set(opts.techniqueIds) : undefined;

  const skipped: { id: string; reason: string }[] = [];
  const payloads: Payload[] = [];

  const pool = opts.extraTechniques?.length
    ? [...activeTechniques(), ...opts.extraTechniques.filter((t) => t.status !== "retired")]
    : activeTechniques();

  for (const t of pool) {
    if (wanted && !wanted.has(t.id)) continue;
    if (CATEGORY_META[t.category].referenceOnly) {
      skipped.push({
        id: t.id,
        reason: "reference-only: needs an optimizer or an attack runner, both out of scope",
      });
      continue;
    }
    payloads.push(buildOne(t, instruction, opts, rootRng));
    if (opts.limit !== undefined && payloads.length >= opts.limit) break;
  }

  return { payloads, seed: opts.seed, skipped };
}

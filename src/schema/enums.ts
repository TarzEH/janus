import { z } from "zod";

/**
 * JANUS models a payload as a point on three ORTHOGONAL axes.
 *
 * A single tree cannot hold both "base64 encoding" and "MCP tool-description
 * poisoning" without overlapping itself — one describes how the payload is
 * packaged, the other where it enters. CrowdStrike's public taxonomy solves this
 * with two namespaces (PT = prompting technique, IM = injection method); JANUS
 * keeps both.
 *
 *   Axis A  Category   how the payload is built          C1-C8
 *   Axis B  Vector     how it reaches the model          V1-V9
 *
 * Applicability falls out of Axis B plus the target's capability flags — it is
 * never hand-tagged per technique.
 */

// ─── Axis A: category ────────────────────────────────────────────────────────

export const CategorySchema = z.enum([
  "instruction-hierarchy",
  "context-reframing",
  "output-conditioning",
  "obfuscation-encoding",
  "temporal-statistical",
  "token-optimization",
  "recon-disclosure",
  "persistence-propagation",
]);
export type Category = z.infer<typeof CategorySchema>;

export interface CategoryMeta {
  readonly code: string;
  readonly label: string;
  /** The single organizing principle. This is what keeps the tree non-overlapping. */
  readonly principle: string;
  /** True when JANUS documents the technique but cannot generate the artifact. */
  readonly referenceOnly?: boolean;
}

export const CATEGORY_META: Readonly<Record<Category, CategoryMeta>> = {
  "instruction-hierarchy": {
    code: "C1",
    label: "Instruction-Hierarchy Attacks",
    principle: "Make attacker text outrank the system prompt.",
  },
  "context-reframing": {
    code: "C2",
    label: "Context & Persona Reframing",
    principle: "Change what the model believes it is.",
  },
  "output-conditioning": {
    code: "C3",
    label: "Output-Conditioning Attacks",
    principle: "Make refusal structurally unreachable.",
  },
  "obfuscation-encoding": {
    code: "C4",
    label: "Obfuscation & Encoding",
    principle: "Preserve semantics, destroy surface recognizability.",
  },
  "temporal-statistical": {
    code: "C5",
    label: "Temporal & Statistical Attacks",
    principle: "Power comes from many turns, examples, or attempts.",
  },
  "token-optimization": {
    code: "C6",
    label: "Token-Level & Optimization",
    principle: "Machine-found rather than human-authored.",
    referenceOnly: true,
  },
  "recon-disclosure": {
    code: "C7",
    label: "Reconnaissance & Disclosure Probes",
    principle: "The goal is to learn, not to force an action.",
  },
  "persistence-propagation": {
    code: "C8",
    label: "Persistence & Propagation",
    principle: "Survive beyond the current context window.",
  },
} as const;

/**
 * Categories are how the catalog is organised for a human reading `--list`.
 * Only `referenceOnly` changes behaviour: it marks entries JANUS documents but
 * cannot generate, because the artifact needs an optimizer or an attack runner.
 */

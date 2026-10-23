/**
 * OWASP LLM Top 10 and MITRE ATLAS mappings for catalog techniques.
 *
 * This is metadata — it describes what the techniques test, but does NOT change
 * the payload bytes the engine emits. The governing rule (see AGENTS.md) keeps
 * it outside the TechniqueSchema on purpose: `build()` never reads this file.
 *
 * Consumers: `--list --verbose`, the web playground, and documentation.
 */

// ─── OWASP LLM Top 10 (2025) ────────────────────────────────────────────────

export interface OwaspItem {
  readonly id: string;
  readonly name: string;
  readonly description: string;
}

export const OWASP_LLM_TOP_10: readonly OwaspItem[] = [
  { id: "LLM01", name: "Prompt Injection", description: "Attacker input overrides system instructions — direct or indirect." },
  { id: "LLM02", name: "Sensitive Information Disclosure", description: "Model leaks system prompts, PII, training data, or internal config." },
  { id: "LLM03", name: "Supply Chain Vulnerabilities", description: "Compromised models, plugins, training data, or deployment pipelines." },
  { id: "LLM04", name: "Data and Model Poisoning", description: "Tampered training/fine-tuning data or RAG corpus corrupts model behavior." },
  { id: "LLM05", name: "Improper Output Handling", description: "LLM output consumed by downstream code triggers XSS, SQLi, command injection, etc." },
  { id: "LLM06", name: "Excessive Agency", description: "Model takes actions beyond scope — calls tools it shouldn't, with wrong args, or without approval." },
  { id: "LLM07", name: "System Prompt Leakage", description: "System prompt or internal instructions extracted verbatim or paraphrased." },
  { id: "LLM08", name: "Vector and Embedding Weaknesses", description: "RAG retrieval manipulated through adversarial documents or embedding collisions." },
  { id: "LLM09", name: "Misinformation", description: "Model generates false/misleading content presented as factual." },
  { id: "LLM10", name: "Unbounded Consumption", description: "Resource exhaustion — token flooding, context window stuffing, recursive loops." },
];

// ─── MITRE ATLAS ─────────────────────────────────────────────────────────────

export interface AtlasItem {
  readonly id: string;
  readonly name: string;
}

export const MITRE_ATLAS: readonly AtlasItem[] = [
  { id: "AML.T0051", name: "LLM Prompt Injection" },
  { id: "AML.T0051.000", name: "Direct Prompt Injection" },
  { id: "AML.T0051.001", name: "Indirect Prompt Injection" },
  { id: "AML.T0054", name: "LLM Jailbreak" },
  { id: "AML.T0056", name: "LLM Meta Prompt Extraction" },
  { id: "AML.T0043", name: "Craft Adversarial Data" },
  { id: "AML.T0040", name: "ML Model Inference API Access" },
  { id: "AML.T0048", name: "Data Poisoning" },
  { id: "AML.T0052", name: "Phishing via LLM" },
  { id: "AML.T0015", name: "Evade ML Model" },
];

// ─── Per-technique mapping ───────────────────────────────────────────────────

export interface TechniqueMapping {
  readonly owasp: readonly string[];
  readonly atlas: readonly string[];
}

/**
 * Keyed by technique id. Every JNS-XXXX in the catalog should have an entry.
 * If a technique id is missing, the playground shows "unmapped" — it is never
 * a build error.
 */
export const TECHNIQUE_MAPPINGS: Readonly<Record<string, TechniqueMapping>> = {
  // C1 — Instruction-Hierarchy Attacks
  "JNS-0001": { owasp: ["LLM01"], atlas: ["AML.T0051.000"] },
  "JNS-0002": { owasp: ["LLM01"], atlas: ["AML.T0051.000"] },
  "JNS-0008": { owasp: ["LLM01"], atlas: ["AML.T0051.000"] },
  "JNS-0009": { owasp: ["LLM01"], atlas: ["AML.T0051.000"] },
  "JNS-0017": { owasp: ["LLM01", "LLM06"], atlas: ["AML.T0051.001"] },

  // C2 — Context & Persona Reframing
  "JNS-0004": { owasp: ["LLM01"], atlas: ["AML.T0054"] },
  "JNS-0005": { owasp: ["LLM01"], atlas: ["AML.T0054"] },

  // C3 — Output-Conditioning Attacks
  "JNS-0006": { owasp: ["LLM01"], atlas: ["AML.T0051.000"] },
  "JNS-0007": { owasp: ["LLM01"], atlas: ["AML.T0054"] },

  // C4 — Obfuscation & Encoding
  "JNS-0010": { owasp: ["LLM01"], atlas: ["AML.T0015", "AML.T0051.000"] },
  "JNS-0011": { owasp: ["LLM01"], atlas: ["AML.T0015", "AML.T0051.000"] },
  "JNS-0012": { owasp: ["LLM01"], atlas: ["AML.T0051.001"] },
  "JNS-0013": { owasp: ["LLM01"], atlas: ["AML.T0015", "AML.T0051.000"] },

  // C5 — Temporal & Statistical Attacks
  "JNS-0014": { owasp: ["LLM01", "LLM07"], atlas: ["AML.T0056", "AML.T0051.000"] },
  "JNS-0015": { owasp: ["LLM01"], atlas: ["AML.T0051.000"] },

  // C6 — Token-Level & Optimization (reference only)
  "JNS-0020": { owasp: ["LLM01"], atlas: ["AML.T0043", "AML.T0051.000"] },

  // C7 — Reconnaissance & Disclosure Probes
  "JNS-0003": { owasp: ["LLM02", "LLM07"], atlas: ["AML.T0056"] },
  "JNS-0016": { owasp: ["LLM02", "LLM06"], atlas: ["AML.T0040"] },

  // C8 — Persistence & Propagation
  "JNS-0018": { owasp: ["LLM06"], atlas: ["AML.T0048"] },
  "JNS-0019": { owasp: ["LLM04", "LLM08"], atlas: ["AML.T0048", "AML.T0051.001"] },

  // ─── New techniques (JNS-0021+) ───────────────────────────────────────────
  "JNS-0021": { owasp: ["LLM05"], atlas: ["AML.T0051.000"] },
  "JNS-0022": { owasp: ["LLM06"], atlas: ["AML.T0051.000", "AML.T0040"] },
  "JNS-0023": { owasp: ["LLM06", "LLM10"], atlas: ["AML.T0051.000"] },
  "JNS-0024": { owasp: ["LLM10"], atlas: ["AML.T0051.000"] },
  "JNS-0025": { owasp: ["LLM09"], atlas: ["AML.T0051.000"] },
  "JNS-0026": { owasp: ["LLM01", "LLM02"], atlas: ["AML.T0051.001"] },
  "JNS-0027": { owasp: ["LLM01"], atlas: ["AML.T0051.000"] },
  "JNS-0028": { owasp: ["LLM02"], atlas: ["AML.T0056", "AML.T0040"] },
  "JNS-0029": { owasp: ["LLM06", "LLM10"], atlas: ["AML.T0051.000"] },
  "JNS-0030": { owasp: ["LLM08", "LLM04"], atlas: ["AML.T0048", "AML.T0051.001"] },
};

/** Lookup helper: returns empty arrays when unmapped. */
export function getMappings(id: string): TechniqueMapping {
  return TECHNIQUE_MAPPINGS[id] ?? { owasp: [], atlas: [] };
}

/** Coverage report: which OWASP items have at least one technique. */
export function owaspCoverage(): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const item of OWASP_LLM_TOP_10) out.set(item.id, []);
  for (const [tid, m] of Object.entries(TECHNIQUE_MAPPINGS)) {
    for (const oid of m.owasp) {
      out.get(oid)?.push(tid);
    }
  }
  return out;
}

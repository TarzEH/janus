import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { TECHNIQUES, getTechnique } from "../src/catalog/catalog.js";
import { isMutatorId } from "../src/mutate/registry.js";
import { referencedSlots } from "../src/render/template.js";

/**
 * Turns every catalog PR into a self-checking one. Small now, because the
 * schema is small: everything a technique declares changes the bytes JANUS
 * emits, so every check here is about producing a valid payload rather than
 * about documenting one.
 */
describe("catalog conformance", () => {
  const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "catalog", "techniques");

  it("parses every entry (importing TECHNIQUES throws otherwise)", () => {
    expect(TECHNIQUES.length).toBeGreaterThan(0);
  });

  it("has unique ids", () => {
    const ids = TECHNIQUES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("stores each technique in a file whose name carries its id", () => {
    const files = readdirSync(dir).filter((f) => f.endsWith(".ts"));
    expect(files.length).toBe(TECHNIQUES.length);
    for (const file of files) {
      expect(getTechnique(file.slice(0, 8)), `${file} has no matching entry`).toBeDefined();
      expect(file).toMatch(/^JNS-\d{4}-[a-z0-9-]+\.ts$/);
    }
  });

  describe.each(TECHNIQUES.map((t) => [t.id, t] as const))("%s", (_id, t) => {
    it("declares exactly one slot, and it is the one the instruction fills", () => {
      // build() renders a single value: {{objective}}. Any other slot would
      // render an empty hole and ship a broken payload.
      expect(t.slots.map((s) => s.name)).toEqual(["objective"]);
    });

    it("uses every slot it declares, across all its turns", () => {
      const bodies = [t.template.body, ...t.template.turns.map((x) => x.body)];
      const referenced = new Set(bodies.flatMap(referencedSlots));
      for (const s of t.slots) {
        expect(referenced, `slot "${s.name}" is declared but never used`).toContain(s.name);
      }
      for (const r of referenced) {
        expect(t.slots.map((s) => s.name), `template uses {{${r}}}`).toContain(r);
      }
    });

    it("names only real mutators", () => {
      for (const m of [...t.mutators.recommended, ...t.mutators.incompatible]) {
        expect(isMutatorId(m), `unknown mutator "${m}"`).toBe(true);
      }
    });

    it("does not recommend a mutator it also declares incompatible", () => {
      const bad = t.mutators.recommended.filter((m) => t.mutators.incompatible.includes(m));
      expect(bad).toEqual([]);
    });
  });
});

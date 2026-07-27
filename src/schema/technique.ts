import { z } from "zod";
import { CategorySchema } from "./enums.js";
import { PayloadTemplateSchema, SlotSchema } from "./payload.js";

export const TECHNIQUE_ID_RE = /^JNS-\d{4}$/;

/**
 * What a technique file must contain.
 *
 * Deliberately small: every field here changes the bytes JANUS emits. The
 * mitigation text, OWASP/ATLAS/CWE mappings, citations, severity and prose that
 * used to live here explained payloads rather than producing them, so they are
 * gone. If you want that back, it belongs in a separate document, not in the
 * struct the generator reads on every run.
 */
export const TechniqueSchema = z
  .object({
    /**
     * Stable and NEVER reused or renamed. The id seeds the mutator RNG, so
     * changing one silently changes every payload that technique has ever
     * produced.
     */
    id: z.string().regex(TECHNIQUE_ID_RE),
    name: z.string().min(3),
    status: z.enum(["stable", "experimental", "retired"]).default("stable"),
    /** Only `referenceOnly` is load-bearing: it gates emission. */
    category: CategorySchema,

    template: PayloadTemplateSchema,
    slots: z.array(SlotSchema).default([]),

    /** Multi-turn techniques render their whole turn sequence into one payload. */
    multiTurn: z.boolean(),

    mutators: z
      .object({
        recommended: z.array(z.string()).default([]),
        /** e.g. base64 destroys a technique whose mechanism IS visible formatting. */
        incompatible: z.array(z.string()).default([]),
      })
      .default({ recommended: [], incompatible: [] }),
  })
  .superRefine((t, ctx) => {
    if (t.multiTurn && t.template.turns.length < 2) {
      ctx.addIssue({
        code: "custom",
        path: ["template", "turns"],
        message: `${t.id}: multiTurn requires at least two turns.`,
      });
    }
    if (!t.multiTurn && t.template.turns.length > 0) {
      ctx.addIssue({
        code: "custom",
        path: ["multiTurn"],
        message: `${t.id}: turns are declared but multiTurn is false.`,
      });
    }
  });

export type Technique = z.infer<typeof TechniqueSchema>;
export type TechniqueInput = z.input<typeof TechniqueSchema>;

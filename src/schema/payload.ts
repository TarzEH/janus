import { z } from "zod";

/** A named hole in a template: {{slot_name}} */
export const SlotSchema = z.object({
  name: z.string().regex(/^[a-z][a-z0-9_]*$/),
  description: z.string().min(1),
  required: z.boolean().default(true),
  default: z.string().optional(),
  examples: z.array(z.string()).default([]),
});
export type Slot = z.infer<typeof SlotSchema>;

export const TurnSchema = z.object({
  role: z.enum(["user", "tool-result", "retrieved-document", "system-adjacent"]),
  body: z.string().min(1),
  note: z.string().optional(),
});
export type Turn = z.infer<typeof TurnSchema>;

export const PayloadTemplateSchema = z.object({
  /**
   * Mustache-lite. Two constructs only:
   *   {{slot_name}}             substitution
   *   [[lock]] ... [[/lock]]    a region mutators must leave byte-identical
   *
   * Locked regions are authored as markers and resolved to offsets at render
   * time — never authored as offsets, which would rot on the first edit.
   */
  body: z.string().min(1),
  /** Multi-turn techniques order their turns here. turns[0].body must equal body. */
  turns: z.array(TurnSchema).default([]),
});
export type PayloadTemplate = z.infer<typeof PayloadTemplateSchema>;

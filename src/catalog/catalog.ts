import { z } from "zod";
import { TechniqueSchema, type Technique } from "../schema/technique.js";
import { RAW_TECHNIQUES } from "./index.generated.js";

export const CATALOG_VERSION = "0.3.0";

function parseAll(): readonly Technique[] {
  const parsed: Technique[] = [];
  const errors: string[] = [];

  for (const raw of RAW_TECHNIQUES) {
    const result = TechniqueSchema.safeParse(raw);
    if (result.success) parsed.push(result.data);
    else {
      const id = (raw as { id?: string }).id ?? "<no id>";
      errors.push(`${id}: ${z.prettifyError(result.error)}`);
    }
  }

  if (errors.length > 0) {
    throw new Error(`Invalid technique entries:\n${errors.join("\n")}`);
  }
  return parsed;
}

export const TECHNIQUES: readonly Technique[] = parseAll();

const BY_ID = new Map(TECHNIQUES.map((t) => [t.id, t]));

export function getTechnique(id: string): Technique | undefined {
  return BY_ID.get(id);
}

/** Retired entries keep their id but must never be generated. */
export function activeTechniques(): readonly Technique[] {
  return TECHNIQUES.filter((t) => t.status !== "retired");
}

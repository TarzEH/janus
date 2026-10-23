import { z } from "zod";
import { TechniqueSchema, type Technique } from "./schema/technique.js";

export class LoadError extends Error {
  constructor(
    public readonly path: string,
    public readonly issues: string[],
  ) {
    super(`${path}: ${issues.join("; ")}`);
    this.name = "LoadError";
  }
}

export function parseTechniques(raw: unknown, sourcePath: string): Technique[] {
  const items = Array.isArray(raw) ? raw : [raw];
  const techniques: Technique[] = [];
  const errors: string[] = [];

  for (const item of items) {
    const result = TechniqueSchema.safeParse(item);
    if (result.success) {
      techniques.push(result.data);
    } else {
      const id = (item as { id?: string }).id ?? "<no id>";
      errors.push(`${id}: ${z.prettifyError(result.error)}`);
    }
  }

  if (errors.length > 0) throw new LoadError(sourcePath, errors);
  if (techniques.length === 0) throw new LoadError(sourcePath, ["no techniques found"]);
  return techniques;
}

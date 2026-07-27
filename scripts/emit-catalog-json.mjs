#!/usr/bin/env node
/**
 * Emits dist/catalog.json and dist/catalog.schema.json as published artifacts.
 *
 * TS-as-data is the right authoring format (payload templates are full of
 * meaningful whitespace and invisible characters that YAML and JSON both
 * mangle), but consumers should not have to run TypeScript to read the catalog.
 * This gives Python and Go tooling a first-class path in.
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const dist = join(dirname(fileURLToPath(import.meta.url)), "..", "dist");
const { TECHNIQUES, CATALOG_VERSION, TechniqueSchema, CATEGORY_META } =
  await import(join(dist, "index.js"));

writeFileSync(
  join(dist, "catalog.json"),
  JSON.stringify(
    {
      catalogVersion: CATALOG_VERSION,
      categories: CATEGORY_META,
      techniques: TECHNIQUES,
    },
    null,
    2,
  ) + "\n",
);

try {
  writeFileSync(
    join(dist, "catalog.schema.json"),
    JSON.stringify(z.toJSONSchema(TechniqueSchema, { io: "input" }), null, 2) + "\n",
  );
} catch (e) {
  // The schema carries cross-field superRefine rules that have no JSON Schema
  // equivalent. Emitting nothing is better than emitting a schema that silently
  // accepts entries the real validator rejects.
  console.warn(`catalog.schema.json skipped: ${e.message}`);
}

console.log(`catalog.json: ${TECHNIQUES.length} techniques`);

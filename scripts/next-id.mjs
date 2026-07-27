#!/usr/bin/env node
/** Prints the next free technique id, so concurrent PRs do not collide. */
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "catalog", "techniques");
const ids = readdirSync(dir)
  .map((f) => /^JNS-(\d{4})-/.exec(f))
  .filter(Boolean)
  .map((m) => Number(m[1]));

// Ids are never reused, so this is max+1 rather than first-gap.
const next = (ids.length ? Math.max(...ids) : 0) + 1;
console.log(`JNS-${String(next).padStart(4, "0")}`);

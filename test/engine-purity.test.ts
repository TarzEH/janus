import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { REFUSAL_CATEGORIES } from "../src/guard.js";

/**
 * Two guarantees, enforced rather than promised. They used to share one
 * justification — "core must run unchanged in a browser" — which died with the
 * web app. A rule whose stated reason is provably false is a rule the next
 * person deletes, so each is now scoped and justified on its own terms.
 *
 *   1. NO NETWORK, anywhere, CLI included. JANUS makes zero requests. There is
 *      no longer any package for network code to live in, so this is absolute.
 *   2. NO CLOCK, NO Math.random, NO Node built-ins IN THE ENGINE. A recipe
 *      carries a seed and a chain and nothing else, so entropy not derived from
 *      the seed is unreproducible by construction. src/cli is exempt: reading a
 *      file and seeding from the OS is exactly its job.
 */
const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const srcRoot = join(pkgRoot, "src");
const cliRoot = join(srcRoot, "cli");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : full.endsWith(".ts") ? [full] : [];
  });
}

/**
 * Comments and regex literals both legitimately mention `fetch` and
 * `Math.random` — this file's own prose does. Strip them, or the guard fires on
 * documentation and gets disabled, which is worse than not having it.
 */
function code(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1")
    .replace(/\/(?![*/])(?:\\.|\[(?:\\.|[^\]])*\]|[^/\\\n])+\/[gimsuy]*/g, "/RE/");
}

const rel = (f: string): string => f.slice(pkgRoot.length + 1);

function offendersIn(files: readonly string[], re: RegExp): string[] {
  return files.filter((f) => re.test(code(readFileSync(f, "utf8")))).map(rel);
}

const all = walk(srcRoot);
const engine = all.filter((f) => !f.startsWith(cliRoot + "/"));

describe("JANUS makes no network requests", () => {
  it("finds source files to check", () => {
    expect(all.length).toBeGreaterThan(10);
    expect(engine.length).toBeLessThan(all.length);
  });

  // The whole tool, not just the engine: nothing here may phone home, and there
  // is no adaptive pass left to carve out an exception for.
  it("has no fetch, XHR, WebSocket or sendBeacon anywhere in src", () => {
    expect(
      offendersIn(all, /(^|[^.\w])fetch\(|XMLHttpRequest|new WebSocket|navigator\.sendBeacon/),
    ).toEqual([]);
  });

  it("reports the version it actually is", () => {
    const pkg = JSON.parse(readFileSync(join(pkgRoot, "package.json"), "utf8")) as {
      version: string;
    };
    expect(readFileSync(join(srcRoot, "version.ts"), "utf8")).toContain(`"${pkg.version}"`);
  });

  // guard.ts says its categories "match SECURITY.md verbatim". That was an
  // assertion in a comment, which enforces nothing. This makes it true.
  it("keeps the refusal list and SECURITY.md in step", () => {
    const security = readFileSync(join(pkgRoot, "SECURITY.md"), "utf8");
    for (const { category, label } of REFUSAL_CATEGORIES) {
      expect(security, `SECURITY.md is missing the "${category}" row`).toContain(category);
      expect(security, `SECURITY.md paraphrases "${category}" instead of quoting it`).toContain(label);
    }
  });

  it("depends on zod and nothing else at runtime", () => {
    const pkg = JSON.parse(readFileSync(join(pkgRoot, "package.json"), "utf8")) as {
      dependencies?: Record<string, string>;
    };
    expect(Object.keys(pkg.dependencies ?? {})).toEqual(["zod"]);
  });
});

describe("the engine is a pure function of its arguments", () => {
  it("imports no Node built-ins outside src/cli", () => {
    expect(
      offendersIn(engine, /from\s+["'](node:|fs|path|os|crypto|http|https|child_process)["']/),
    ).toEqual([]);
  });

  it("never reads the clock or Math.random outside src/cli", () => {
    // Both would break `--seed`: a run is reproducible only if every byte of
    // entropy derives from it.
    expect(offendersIn(engine, /Math\.random|Date\.now\(\)|new Date\(\s*\)/)).toEqual([]);
  });
});

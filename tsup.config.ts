import { defineConfig } from "tsup";

// tsup (esbuild) EMITS. It does not typecheck — `tsc -b` is a separate,
// mandatory gate. Never conflate the two.
//
// Two entries, two shapes. One package is both a library and a binary, and they
// want opposite things: the library keeps zod external and needs .d.ts; the
// binary bundles everything so `npx janus-cli` has zero transitive dependencies,
// and a .d.ts for an executable is meaningless.
export default defineConfig([
  {
    entry: { index: "src/index.ts" },
    format: ["esm"],
    // The dts pass runs in a synthetic project where `composite` would demand an
    // explicit file list and fail with TS6307.
    dts: { compilerOptions: { composite: false, incremental: false } },
    clean: true,
    sourcemap: true,
    target: "node20",
    external: ["zod"],
  },
  {
    entry: { janus: "src/cli/index.ts" },
    format: ["esm"],
    // Do NOT clean: this config runs after the library one and would erase it.
    clean: false,
    sourcemap: false,
    target: "node20",
    noExternal: ["zod"],
    banner: { js: "#!/usr/bin/env node" },
  },
]);

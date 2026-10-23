import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  // .tsbuild is the typecheck-only output of `tsc -b`; dist is tsup's. Neither
  // is source, and linting generated .d.ts files reports nothing actionable.
  { ignores: ["**/dist/**", "**/.tsbuild/**", "**/binaries/**", "**/node_modules/**", "**/web/**", "**/*.mjs"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
  {
    // JANUS makes zero network requests. Not "the engine doesn't" — the whole
    // tool doesn't. There is no longer any package for network code to live in,
    // so the claim is absolute and this is what keeps it true.
    files: ["src/**/*.ts"],
    rules: {
      "no-restricted-globals": [
        "error",
        { name: "fetch", message: "JANUS makes no network requests. Nothing you build here may phone home." },
      ],
    },
  },
  {
    // The engine — everything but the CLI — stays a pure function of its
    // arguments. A recipe carries a seed and a chain and nothing else, so any
    // entropy not derived from that seed is unreproducible by construction, and
    // reading the filesystem would make the library export Node-only.
    files: ["src/**/*.ts"],
    ignores: ["src/cli/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["node:*", "fs", "path", "os", "crypto", "http", "https"],
              message: "The engine takes its inputs as arguments. Node APIs belong in src/cli.",
            },
          ],
        },
      ],
    },
  },
);

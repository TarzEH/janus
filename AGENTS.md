# AGENTS.md

`janus -i "text"` turns one instruction into one prompt-injection payload per
catalog technique, obfuscated by default. Offline, deterministic, no network.

## Commands

| | |
|---|---|
| `npm run typecheck` | `tsc -b`. **tsup does not typecheck** — this is the only type gate. |
| `npm run lint` | `eslint .` |
| `npm run build` | catalog barrel → tsup → `dist/catalog.json` |
| `npm test` | `vitest run` |
| `npm run catalog:index` | regenerate `src/catalog/index.generated.ts` — **commit the result** |
| `npm run catalog:next-id` | next free JNS id |
| `npm run build:binaries` | needs `bun` on PATH |

**Run build before test.** `test/cli.test.ts` execs the built `dist/janus.js`, so
a stale build tests stale code. CI order is: catalog drift check → typecheck →
lint → build → test.

## The governing rule

> If it does not change the payload bytes, it is not in the engine.

A target profiler, a ranker, a recipe format and an explaining renderer were all
deleted for failing this. Mitigation text, OWASP mappings and citations are not
in the catalog — provenance goes in the PR description.

## Hard boundaries

**Technique ids are permanent.** The id seeds the mutator RNG
(`rootRng.fork(t.id)` in `src/build.ts`), so renaming one changes every payload
that technique has ever produced. Retire with `status: "retired"`, never rename,
never reuse.

**Nothing in `src/` may call `fetch`.** Not "the engine doesn't" — the whole tool
doesn't. Enforced by `eslint.config.js` and `test/engine-purity.test.ts`.

**Nothing outside `src/cli/` may import `node:*`, read the clock, or call
`Math.random`.** Entropy not derived from the seed is unreproducible by
construction.

**Every technique declares exactly one slot, `objective`.** `build()` renders one
value; a second slot renders an empty hole and ships a broken payload.

**`src/guard.ts`'s five refusals never widen.** `SECURITY.md` quotes them
verbatim and a test fails if the two drift.

**Mutators fork the RNG by their own id** — `ctx.rng.fork(this.id)`, never the
parent stream. Otherwise inserting a mutator mid-chain shifts every later
mutator's randomness and silently moves payloads that should not have moved.

**Composition is not commutative.** Order is enforced by `kind`:
linguistic → obfuscation → structural → padding → encoding. Encoding is terminal
and at most one per chain.

## Payload-byte drift is a bug

The suite asserts properties, never exact output, so it cannot see drift. Before
and after any engine change:

```bash
node dist/janus.js -i 'FIXED' -s fixed -m recommended --null > /tmp/after.txt
# then diff the two, order-independent
```

Docs, comments and test edits must never move payload bytes.

## Output contract

stdout is payloads. stderr is the seed, warnings and skipped techniques — that is
what makes `janus … | xargs -0` correct.

Payloads are multi-line by design, so a newline cannot delimit them. Piped
default is NUL; `--jsonl` for machines; `--raw` warns. Exit codes follow `grep`:
`0` payloads · `1` nothing emitted · `2` usage · `3` refused. EPIPE exits 0.

## Editing the catalog

TypeScript-as-data, not YAML or JSON: templates carry zero-width codepoints and
homoglyphs that YAML renders as indistinguishable from corruption, and JSON would
flatten a 20-line payload into one unreviewable line.

`.editorconfig` disables trailing-whitespace trimming under
`src/catalog/techniques/` because that whitespace is load-bearing. Do not
"clean" a template.

## More

`CONTRIBUTING.md` — adding a technique or mutator, in detail.
`docs/ARCHITECTURE.md` — why the pieces are shaped this way.
`SECURITY.md` — the refusal list and what this tool honestly does not control.

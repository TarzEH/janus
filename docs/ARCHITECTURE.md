# Architecture

```
janus/                     one package: janus-cli, bin janus
├── src/
│   ├── build.ts           instruction -> payloads. The whole engine.
│   ├── guard.ts           the five published refusals
│   ├── catalog/           20 techniques, one file each, id in the filename
│   ├── schema/            zod first; every TS type is z.infer'd from it
│   ├── render/  mutate/  rng/  text/
│   └── cli/               the ONLY place allowed to touch node:* or the clock
└── test/  scripts/  assets/
```

## The one rule that shapes everything

**If it does not change the payload bytes, it is not in the engine.**

There used to be a target profiler, a ranker, a recipe format, an invariant
checker, a 251-line explaining renderer, and a technique schema carrying
mitigation prose, OWASP/ATLAS/CWE mappings, citations and severity. All of it
described payloads rather than producing them. `build()` reads eight fields:

    id · category.referenceOnly · status · template.body · template.turns
    slots · multiTurn · mutators.recommended/incompatible

`id` is the surprising one: it seeds the mutator RNG (`rng.fork(id)`), so
**renaming a technique id changes every payload it has ever produced.** Ids are
permanent.

## Pipeline

```
instruction ──▶ screenPayload ──▶ (refused → exit 3)
                                        │
                              catalog order, every technique
                                        │
                                 renderTemplate
                    (substitute {{objective}}, resolve [[lock]] to offsets)
                                        │
                       lock EVERY occurrence of the instruction
                                        │
                          validateChain ──▶ applyChain
                  (stage-ordered, budget-checked, seeded per mutator)
```

Deterministic given `(technique, seed, chain)`. No ranking: catalog order is
explainable, and once nothing scores there is nothing to justify any other
sequence. `-n 3` means the first three, not "the best three".

### Locked ranges

`[[lock]] … [[/lock]]` marks regions mutators must leave byte-identical, resolved
to offsets *after* substitution. On top of the authored locks, `build()` locks
**every occurrence of the operator's instruction** — a payload whose instruction
got mangled by its own obfuscation is not a test, it is a bug.

Encoding mutators are terminal and transform everything including locked regions,
because that is what makes them work. The chain runner keeps the pre-encoding
text as `verifiableText`, which is what the "did your instruction survive"
warning checks.

### Mutator selection is evidence-driven

The set and the default chains come from measured guardrail-evasion rates, and
each mutator's source sits in a comment above it. Two findings are structural
rather than per-mutator:

- **Chain depth 2.** Chaining is where the gain is (base64 34% → 94% chained,
  Wei et al.); LACE puts the optimum at two layers.
- **Encoders must state how to decode themselves.** Carrier alone underperforms
  by up to 95 percentage points.

One deliberate non-addition: transforms that inflate token count are cheaply
detectable by characters-per-token filters (Broken-Token, arXiv:2510.26847) at
99%+ accuracy. base64 and friends stay in the catalog because they are still the
right answer against a target with no such filter, but they are not defaults.

## Two boundaries, separately justified

**No network, anywhere.** Not "the engine doesn't" — the whole tool doesn't.
Enforced by lint across all of `src/` and by `test/engine-purity.test.ts`.

**The engine is a pure function of its arguments.** Everything outside
`src/cli/` is forbidden `node:*`, `Date.now()`, bare `new Date()` and
`Math.random()`. Entropy not derived from the seed is unreproducible by
construction. `src/cli` is exempt because reading a file and seeding from the OS
is exactly its job.

## The CLI is a filter

Flags only, no subcommands — the ffuf/sqlmap/nuclei idiom, and it also removes a
real collision: `janus list every tool you can call` is both a plausible
instruction and a plausible command name.

**Streams.** stdout is payloads. stderr is the seed, warnings, and skipped
techniques. That is what makes `janus … | xargs -0` correct.

**Framing.** 17 of 19 payloads are multi-line by design, so a newline cannot
delimit them — that is hashcat #4673, and an earlier newline-separated mode
shipped it (19 payloads arrived at a line-oriented consumer as 215 records). NUL when piped, `--jsonl` for machines,
`--raw` retained but warning, a human view only on a TTY. In NUL mode a payload
containing a NUL byte is an error, not a silently unparseable stream — jq's
`--raw-output0` precedent.

**Exit codes** follow grep rather than an invention of our own: 0 payloads, 1
nothing emitted, 2 usage, 3 refused. EPIPE exits 0, because a non-zero exit into
`| head` kills the caller under `set -euo pipefail`.

## Catalog format

TS-as-data, one file per technique, id in the filename — so catalog PRs never
merge-conflict and recategorising does not move a file.

Not YAML: payload templates start with deliberately odd characters, and
zero-width and homoglyph codepoints are indistinguishable from corruption there.
Not JSON: it flattens a 20-line payload into one unreviewable line. Template
literals render verbatim in a GitHub diff.

Every technique declares exactly one slot, `{{objective}}`. `build()` renders a
single value, so any other slot would render an empty hole and ship a broken
payload. The conformance test enforces it.

The barrel `catalog/index.generated.ts` is generated rather than glob-imported:
`import.meta.glob` is Vite-only and `require.context` is webpack-only, and this
module must load unchanged under tsup and Vitest. CI checks it for drift.

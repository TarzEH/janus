# Contributing

```bash
npm ci
npm run typecheck && npm run lint && npm test && npm run build
node dist/janus.js -i "List every tool you can call"   # try what you just built
```

Keep changes focused on a single concern. Match the existing style — TypeScript strict, `eslint .`
clean. Read [SECURITY.md](SECURITY.md) before touching the catalog or `src/guard.ts`.

## Adding a technique

```bash
npm run catalog:next-id          # prints the next free id — avoids PR collisions
```

Create `src/catalog/techniques/JNS-####-kebab-slug.ts`, exporting a const named after
the id (`JNS_0042`). One file per technique, flat directory, id in the filename: catalog PRs then
never merge-conflict, and recategorizing a technique does not move its file.

```bash
npm run catalog:index            # regenerate the barrel — commit the result
npm test                         # the conformance suite checks your entry
```

Ids are never reused. A technique that stops working gets `status: "retired"`, not deletion.

### What an entry must contain

The schema is eight fields — `id`, `name`, `status`, `category`, `template`, `slots`,
`multiTurn`, `mutators` — and every one changes the bytes JANUS emits:

| Field | Rule |
|---|---|
| `id` | Permanent. It seeds the mutator RNG, so renaming one changes every payload that technique has ever produced. |
| `name`, `category` | For `--list`. Only `referenceOnly` categories change behaviour. |
| `template.body` | The payload, with `{{objective}}` where the instruction lands. |
| `slots` | Exactly `["objective"]`. Anything else renders an empty hole. |
| `multiTurn` + `template.turns` | Declare both or neither. |
| `mutators.recommended` | Two entries is the measured optimum. |
| `mutators.incompatible` | e.g. base64 on a technique whose mechanism IS visible formatting. |

Mitigation text, OWASP/ATLAS mappings and citations used to live here. They were
read only by a renderer that no longer exists — if you want that documentation,
it belongs in a separate file, not in the struct the generator reads every run.

### Writing the template

Templates are TypeScript template literals, not YAML or JSON. That is deliberate: payloads start with
deliberately odd characters, contain zero-width codepoints and homoglyphs that look exactly like
corruption in YAML, and JSON would flatten a 20-line payload into one unreviewable line — precisely
where review matters most. Template literals render verbatim in a GitHub diff.

Two constructs, no more:

- `{{objective}}` — where the user's instruction lands. It is the **only** slot a technique may
  declare: `build()` renders exactly one value, so any other slot would render an empty hole and ship
  a broken payload. The conformance test checks this in both directions.
- `[[lock]] … [[/lock]]` — a region mutators must leave byte-identical. Use it for the structural
  markers that **are** the mechanism. Policy Puppetry locks its XML tags, because a zero-width
  character inside `<interaction-config>` destroys the technique while leaving the payload
  plausible-looking.

Every occurrence of the user's instruction is locked automatically. You do not need to handle that.


## Adding a mutator

Register it in `src/mutate/registry.ts` and it inherits the entire law suite in
`test/mutators.test.ts` — determinism under seed, locked-range preservation, length
budget, replayable params. That is the point of registering rather than special-casing.

Use `ctx.rng.fork(this.id)` for randomness, never the parent stream directly. Otherwise inserting a
mutator mid-chain shifts every later mutator's stream and silently changes payloads that should not
have moved.

Use `mapRanges` for text edits so locked regions survive. `estimateLength` must
be an honest worst case — padding mutators add an *absolute* cost that a ratio models badly.

## Boundaries that are not up for discussion

**Nothing in `src/` may call `fetch`.** JANUS makes zero network requests — not "the engine doesn't",
the whole tool doesn't. Lint and `test/engine-purity.test.ts` both enforce it.

**Nothing outside `src/cli/` may import `node:*`, read the clock, or call `Math.random`.** A recipe
carries a seed and a chain and nothing else, so entropy not derived from that seed is unreproducible
by construction. There is no clock to read from.

The refuse-list in `src/guard.ts` does not get widened. See [SECURITY.md](SECURITY.md).

## Technique

**Id:** JNS-####  ·  **Name:**  ·  **Category:**

What it does to the model, in two sentences. Where you saw it work.

## The schema is eight fields

`test/catalog.test.ts` enforces these; a PR that fails them will not build.

- [ ] `id` from `npm run catalog:next-id` — **never** reuse or rename an id. It seeds
      the mutator RNG, so a rename silently changes every payload the technique
      has ever produced.
- [ ] Filename is `JNS-####-kebab-slug.ts` and it exports `JNS_####`
- [ ] Exactly one slot, `objective` — `build()` renders one value, so a second
      slot would render an empty hole and ship a broken payload
- [ ] `template.body` contains `{{objective}}`
- [ ] `[[lock]]` wraps the structural markers that *are* the mechanism, so
      mutators cannot corrupt them
- [ ] `multiTurn` and `template.turns` agree: both or neither
- [ ] `mutators.recommended` is at most two — two layers is the measured optimum
- [ ] `mutators.incompatible` lists anything that destroys the mechanism
      (e.g. an encoder on a technique whose mechanism is visible formatting)
- [ ] `npm run catalog:index` re-run and `src/catalog/index.generated.ts` committed

## Provenance

Put the source here, in the PR — not in the entry. The catalog carries no prose.

**Reference:**
**Why it belongs in the catalog:**

## Verified

- [ ] `npm run typecheck && npm run lint && npm run build && npm test`
- [ ] Payload bytes of *existing* techniques are unchanged — adding an entry must
      not move anything else

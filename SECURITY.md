# Security Policy

## Reporting a vulnerability in JANUS

Email the maintainer with reproduction steps, impact, and affected version. Please **do not** open a
public GitHub issue for a security bug. Allow reasonable time for a fix before public disclosure.
No bug bounty. Credit given unless you decline.

## Reporting a vulnerability you found *with* JANUS

**Do not send it to us.** We are not a clearing house and we do not want your findings.

Report it to the **owner of the system you tested**, through their disclosure process. If they do not
publish one, try `/.well-known/security.txt` first, then `security@` their domain.

## What we accept into the catalog

An entry must be a template that wraps an arbitrary instruction and produces a
payload. That is the whole bar, because that is the whole tool.

Technique structs carry no mitigation text, citations, or standards references —
those belong outside the engine (see the [governing rule](AGENTS.md)). OWASP LLM
Top 10 and MITRE ATLAS mappings live in `src/catalog/mappings.ts`, separate from
the payload generator. Put the provenance for a technique in the PR description,
not in the struct the generator reads on every run. Enforced by
`test/catalog.test.ts`, not by review discipline.

## What we will not merge

- Anything that runs an attack, scores a response, or makes a network request.
- Optimized adversarial suffixes. We document the technique and cite the paper. We do not ship the
  artifact. (This is why category C6 is reference-only.)
- Undisclosed model-specific zero-days. **Coordinate with the vendor first**, then send the advisory
  link.
- Live attack execution, response scoring, or a hosted callback collector. All three are out of scope
  permanently, not "not yet".

## Design philosophy

JANUS takes your instruction as free text. That is the whole point of the tool — you are the one who
decides what the target should be made to do.

It **wraps** the instruction in documented injection techniques. It does not execute it, does not send
it anywhere, and does not evaluate the result. The instruction passes through byte-identical; JANUS
adds obfuscation **around** it, not to it.

The control that matters is **your engagement's authorization**, not a regex inside the tool. Red
teamers need to test the full spectrum of inputs against their targets — that is the job. A tool that
selectively refuses to generate test payloads is a tool that leaves gaps in the assessment.

`src/guard.ts` ships as a library utility for callers who want an optional content screen.
The engine itself does not enforce it — the operator is trusted.

## Data handling

There is nothing to handle. JANUS is a local binary that makes **zero network requests** and writes
nothing to disk unless you ask it to with `-o` — no config file, no cache, no history. Your
instruction never leaves the process.

Both properties are enforced rather than promised: `eslint.config.js` forbids `fetch` anywhere in
`src/`, `test/engine-purity.test.ts` greps the whole source tree for network calls, and only
`src/cli` is permitted to touch `node:fs` at all.

## Why MIT

Use-restriction licences (Hippocratic, RAIL, "do no evil" clauses) are non-OSI, and corporate legal
blocks non-standard licences by policy. Shipping one would lock out internal AppSec and AI-safety
teams — exactly the audience this is for — while stopping nobody else, since attackers do not honour
copyright terms. Putting the ethical control in the licence is the definition of theatre.

What the product can honestly offer instead is: no attack runner, no
collector, and no network access at all. Those survive a fork only if the forker actively strips
them, which is a visible, attributable act.

For reference: NVIDIA garak ships Apache-2.0, Microsoft PyRIT ships MIT. Shipping MIT signals normal
security tooling. Shipping a bespoke ethics licence signals the author thinks the project is sketchy.

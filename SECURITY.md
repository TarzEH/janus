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

The catalog no longer carries mitigation text, standards mappings or citations —
they were read by a renderer that no longer exists. Put the provenance for a
technique in the PR description, not in the struct the generator reads on every
run. Enforced by `test/catalog.test.ts`, not by review discipline.

## What we will not merge

- Working payloads for real-world harm — weapons, CSAM, functional malware, phishing kits.
- Widening the screen in `src/guard.ts` to permit any of its five refused categories.
- Anything that runs an attack, scores a response, or makes a network request.
- Optimized adversarial suffixes. We document the technique and cite the paper. We do not ship the
  artifact. (This is why category C6 is reference-only.)
- Undisclosed model-specific zero-days. **Coordinate with the vendor first**, then send the advisory
  link.
- Live attack execution, response scoring, or a hosted callback collector. All three are out of scope
  permanently, not "not yet".

## The one control, described honestly

JANUS takes your instruction as free text. That is the whole point of the tool — you are the one who
decides what the target should be made to do — and it means there is no architectural boundary to
hide behind. Being straight about that matters more than the marketing would.

What stands in place of a boundary is `src/guard.ts`: a short, published list of categories the tool
will not dress up. It exits `3` and names the category. The five, quoted from the code so this file
and the implementation cannot drift apart — `test/engine-purity.test.ts` fails if they do:

| id | what it refuses |
|---|---|
| `cbrn-weapons` | chemical, biological, radiological, nuclear or weapons synthesis |
| `csam` | sexual content involving minors |
| `functional-malware` | working malware, ransomware or exploit code |
| `credential-phishing` | a credential-phishing kit targeting a named institution |
| `targeted-harassment` | harassment or doxxing of a named private individual |


**It is a set of regexes, and it is bypassable.** It catches careless misuse. It will not stop a
determined adversary and it is not trying to — anyone who wants to route around a regex can.

We are not going to pretend otherwise. The honest description of JANUS is: a payload converter with a
thin screen, shipped because prompt-injection testing is a real job and the alternative is that
testers hand-write the same wrappers worse. The things that carry real weight here are outside the
tool — your engagement's authorization. There is nothing inside the tool that carries comparable
weight, and pretending otherwise would be the marketing this file exists to avoid.

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

What the product can honestly offer instead is: a published refuse-list, no attack runner, no
collector, and no network access at all. Those survive a fork only if the forker actively strips
them, which is a visible, attributable act.

For reference: NVIDIA garak ships Apache-2.0, Microsoft PyRIT ships MIT. Shipping MIT signals normal
security tooling. Shipping a bespoke ethics licence signals the author thinks the project is sketchy.

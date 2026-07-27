<div align="center">

<img src="assets/logo.svg" alt="JANUS" width="330">

**Your text in. Injection payloads out.**

[![CI](https://github.com/TarzEH/janus/actions/workflows/ci.yml/badge.svg?style=flat-square)](https://github.com/TarzEH/janus/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg?style=flat-square)](.nvmrc)

</div>

---

<img src="assets/demo.gif" alt="janus turning one instruction into an obfuscated payload" width="100%">

One instruction in, one payload per documented technique out, obfuscated by
default. That is the whole tool.

It does not run attacks, score responses, profile your target, or make a single
network request. It is a filter — `sed` for prompt injection.

## Why this exists

Every prompt-injection transform in the ecosystem lives inside a scanner.
[PyRIT](https://github.com/microsoft/PyRIT) has 85 converters and no `convert`
command. [garak](https://github.com/NVIDIA/garak) has buffs, but they union
rather than chain. [promptfoo](https://www.promptfoo.dev/docs/red-team/) writes
YAML. The dedicated ASCII-smuggling tool is a web page.

Nobody ships `echo "text" | tool`. That is this.

## Install

```bash
curl -fsSL https://raw.githubusercontent.com/TarzEH/janus/main/install.sh | sh   # macOS / Linux
irm https://raw.githubusercontent.com/TarzEH/janus/main/install.ps1 | iex        # Windows
```

Standalone binary, checksum-verified against `SHA256SUMS` before it touches your
`PATH`. Piping a script from the internet into a shell is the supply-chain
problem this project exists to talk about — [read it first](install.sh); drop the
`| sh` and it just prints.

<details>
<summary>Other ways in</summary>

```bash
npm i -g janus-cli
npx janus-cli --help
npm ci && npm run build          # from source: dist/janus.js
npm run build:binaries           # standalone binaries, needs bun
```

Uninstalling is deleting the binary. JANUS writes nothing to disk unless you ask it to with `-o`.

</details>

## Usage

```bash
janus -i "INSTRUCTION"           # instruction on argv
echo "INSTRUCTION" | janus       # or stdin
janus prompt.txt                 # or a file
janus --input="--ignore all"     # when it starts with a dash
```

| | |
|---|---|
| `-t, --technique SEL` | Restrict the pool. `JNS-0017`, `C1`..`C8`, a category slug, or `all`. |
| `-x, --exclude SEL` | Remove from the pool, after `-t`. |
| `-m, --mutate SPEC` | `recommended` (default) · `none` · `id,id,…` |
| `-n, --count N` | Stop after N. |
| `-s, --seed S` | Reproducibility. Generated and echoed to stderr if omitted. |
| `-o, --output 'p-%n.txt'` | One file per payload. |
| `-q` · `-l, --list` · `-h` · `-V` | |

### Output format

**Payloads are multi-line by design, so a newline cannot delimit them.** Feeding
19 payloads to a line-oriented consumer as newline-separated text gets you 215
records, not 19 — the same defect as
[hashcat `--stdout`](https://github.com/hashcat/hashcat/issues/4673).

| | |
|---|---|
| `-0, --null` | NUL after each payload. **Default when piped.** |
| `-J, --jsonl` | One JSON string per line. Lossless, `head`- and `wc -l`-safe. |
| `--raw` | Newline-separated. Ambiguous; warns. |
| `--pretty` | Human view. Default on a terminal, never reaches a pipe. |

```bash
janus -i "..." | xargs -0 -n1 curl -sd            # NUL, the way find -print0 works
janus -i "..." --jsonl | jq -r .                  # round-trips to exact bytes
janus -i "..." -o 'payload-%n.txt'                # one file each
```

stdout is payloads. Everything else — the seed, warnings, skipped techniques — is
stderr. Exit codes follow `grep`: **0** payloads · **1** nothing emitted ·
**2** usage · **3** refused.

## What makes a payload "upgraded"

Obfuscation is **on by default**. The set is chosen by measured guardrail-evasion
rate, not by novelty — numbers from
[Hackett et al., LLMSec 2025](https://arxiv.org/abs/2504.11168) unless noted:

| mutator | injection / jailbreak evasion |
|---|---|
| `emoji-smuggling` | **100% / 100%** — invisible variation selectors |
| `upside-down` | — / **~100%** |
| `unicode-tags` | 90% / 82% |
| `bidi-override` | 79% / 99% — [Trojan Source](https://trojansource.codes/), CVE-2021-42574 |
| `char-spacing` | Meta Prompt-Guard-86M: **3% → ~100%** |
| `flip-attack` | ~98% ASR, ~98% guardrail bypass ([arXiv:2410.02832](https://arxiv.org/abs/2410.02832)) |
| `sneaky-bits` | invisible binary, a different codepoint block from tags |

Three things follow from the research and are baked in:

- **Two layers, not one.** Chaining is where the gain is — base64 alone measures
  34% on GPT-4 and 94% chained. [LACE](https://arxiv.org/abs/2402.10601) puts the
  optimum at two, which is what the default chains are.
- **Every encoder states how to decode it.** A carrier alone underperforms; an
  explicit decode instruction is worth up to +95 percentage points.
- **Your instruction comes out byte-identical.** It is locked before the mutators
  run, so obfuscation rearranges everything around it and leaves it intact. When
  a chain cannot preserve it, you get a warning on stderr.

## What it will never do

Run an attack · score a response · make a network request · write anything you did not ask for ·
ship optimized adversarial suffixes (C6 is documented, never generated).

`janus` refuses five published categories — weapons capable of mass casualties,
CSAM, functional malware, credential-phishing kits, targeted harassment — and
exits **3** naming the category. That check is **a regex and it is bypassable.**
Not a hint: a statement that the control is thin and deliberate. The tool takes
free text, so nothing else could be true. See [SECURITY.md](SECURITY.md).

## Disclaimer

Only use this against targets you **own** or have **explicit written permission**
to test. Unauthorized testing is a crime in most jurisdictions, and this tool is
not a defense.

---

[MIT](LICENSE) © 2026 TarzEH · [SECURITY](SECURITY.md) · [CONTRIBUTING](CONTRIBUTING.md) · [ARCHITECTURE](docs/ARCHITECTURE.md)

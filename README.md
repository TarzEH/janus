<div align="center">

<img src="assets/logo.svg" alt="JANUS" width="330">

**Your text in. Injection payloads out.**

[![CI](https://github.com/TarzEH/janus/actions/workflows/ci.yml/badge.svg)](https://github.com/TarzEH/janus/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/janus-cli?color=22d3ee)](https://www.npmjs.com/package/janus-cli)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg)](.nvmrc)
![Techniques](https://img.shields.io/badge/techniques-30-8b5cf6)
![Mutators](https://img.shields.io/badge/mutators-16-ec4899)

[Install](#install) · [Usage](#usage) · [Playground](#playground) · [OWASP Coverage](#owasp-llm-top-10-coverage) · [How It Compares](#how-it-compares) · [Contributing](CONTRIBUTING.md)

</div>

---

<img src="assets/demo.svg" alt="janus turning one instruction into an obfuscated payload" width="100%">

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
`PATH`. Works on macOS, Linux (Ubuntu, Debian, Kali, Arch), and Windows.
Piping a script from the internet into a shell is the supply-chain
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
**2** usage.

## Playground

Try JANUS in your browser — no install needed:

**[janus playground →](https://tarzeh.github.io/janus/)**

The playground runs the full engine client-side. Nothing leaves your browser.

<details>
<summary>Screenshots</summary>

<img src="assets/playground-overview.jpg" alt="JANUS Playground — OWASP coverage grid, technique selector, stats" width="100%">

<img src="assets/playground-payloads.jpg" alt="JANUS Playground — generated payloads with mutator chains and OWASP tags" width="100%">

</details>

## Catalog: 30 Techniques in 8 Categories

| Code | Category | Techniques | What it tests |
|---|---|---|---|
| **C1** | Instruction-Hierarchy Attacks | 7 | Making attacker text outrank the system prompt |
| **C2** | Context & Persona Reframing | 2 | Changing what the model believes it is |
| **C3** | Output-Conditioning Attacks | 4 | Making refusal structurally unreachable |
| **C4** | Obfuscation & Encoding | 5 | Destroying surface recognizability while preserving semantics |
| **C5** | Temporal & Statistical Attacks | 3 | Power from many turns, examples, or token volume |
| **C6** | Token-Level & Optimization | 1 | Machine-found adversarial suffixes (reference only) |
| **C7** | Reconnaissance & Disclosure | 3 | Learning about the target without forcing an action |
| **C8** | Persistence & Propagation | 5 | Surviving beyond the current context window |

Run `janus --list` for the full catalog with IDs.

## OWASP LLM Top 10 Coverage

Every technique is mapped to the [OWASP LLM Top 10 (2025)](https://owasp.org/www-project-top-10-for-large-language-model-applications/) and [MITRE ATLAS](https://atlas.mitre.org/).

| OWASP Item | Techniques | Coverage |
|---|---|---|
| **LLM01** Prompt Injection | JNS-0001, 0002, 0004–0015, 0017, 0020, 0026, 0027 | Full |
| **LLM02** Sensitive Information Disclosure | JNS-0003, 0016, 0026, 0028 | Full |
| **LLM03** Supply Chain Vulnerabilities | — | Out of scope (no network) |
| **LLM04** Data and Model Poisoning | JNS-0019, 0030 | Partial |
| **LLM05** Improper Output Handling | JNS-0021 | Partial |
| **LLM06** Excessive Agency | JNS-0016, 0017, 0018, 0022, 0023, 0029 | Full |
| **LLM07** System Prompt Leakage | JNS-0003, 0014 | Full |
| **LLM08** Vector and Embedding Weaknesses | JNS-0019, 0030 | Partial |
| **LLM09** Misinformation | JNS-0025 | Partial |
| **LLM10** Unbounded Consumption | JNS-0023, 0024, 0029 | Partial |

LLM03 (supply chain) is deliberately out of scope — JANUS generates payloads, not
dependency-confusion packages.

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

- **Chaining, not one-shot.** Chaining is where the gain is — base64 alone measures
  34% on GPT-4 and 94% chained. [LACE](https://arxiv.org/abs/2402.10601) showed
  two layers is the sweet spot; JANUS picks one to five per technique, optimized
  for each technique's evasion profile.
- **Every encoder states how to decode it.** A carrier alone underperforms; an
  explicit decode instruction is worth up to +95 percentage points.
- **Your instruction comes out byte-identical.** It is locked before the mutators
  run, so obfuscation rearranges everything around it and leaves it intact. When
  a chain cannot preserve it, you get a warning on stderr.

## How It Compares

| | **JANUS** | PyRIT | garak | promptfoo |
|---|---|---|---|---|
| **What it is** | Payload generator | Red-team orchestrator | LLM vulnerability scanner | Eval framework |
| **One-liner CLI** | `echo "text" \| janus` | No CLI pipe | No CLI pipe | YAML config |
| **Offline / zero network** | Yes | No (needs target) | No (needs target) | No (needs target) |
| **Deterministic output** | Seed-reproducible | No | No | No |
| **Obfuscation chains** | 16 mutators, 1–5 per technique | Converters (no chain) | Buffs (union, not chain) | Plugins |
| **OWASP LLM Top 10 mapped** | Yes (9/10) | Partial | Partial | Partial |
| **MITRE ATLAS mapped** | Yes | No | Yes | No |
| **Techniques** | 30 | N/A (converters) | 34 probes | Plugins |
| **Browser playground** | Yes | No | No | No |
| **Runs attacks** | Never | Yes | Yes | Yes |

JANUS generates; the others consume. Use JANUS to build the payloads, then feed
them to your runner of choice.

## What it will never do

Run an attack · score a response · make a network request · write anything you did not ask for ·
ship optimized adversarial suffixes (C6 is documented, never generated).

JANUS wraps your instruction — it does not execute it. The operator decides what
to test, and authorization is what makes that decision legal. See
[SECURITY.md](SECURITY.md).

## Disclaimer

**This tool is for authorized security testing only.** Only use it against
targets you **own** or have **explicit written permission** to test. Unauthorized
testing is a crime in most jurisdictions and this tool is not a defense. The
authors accept no liability for misuse.

By using JANUS you agree that you are solely responsible for compliance with all
applicable laws and regulations. If you do not have written authorization to test
a target, do not use this tool against it.

---

[MIT](LICENSE) © 2026 Ori Ashkenazi · [SECURITY](SECURITY.md) · [CONTRIBUTING](CONTRIBUTING.md) · [CODE OF CONDUCT](CODE_OF_CONDUCT.md) · [ARCHITECTURE](docs/ARCHITECTURE.md)

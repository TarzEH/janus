# Changelog

All notable changes to JANUS are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

Nothing yet.

## [1.0.0] — 2026-07-27

### Added

- 30 prompt-injection techniques across 8 categories (C1–C8)
- 16 obfuscation mutators with research-backed chaining
- OWASP LLM Top 10 and MITRE ATLAS mappings for every technique
- Browser playground at tarzeh.github.io/janus (client-side, zero network)
- Interactive REPL mode (`--repl`)
- Structured assessment reports (`--report json` / `--report md`)
- Custom technique loading (`--load`)
- Code coverage reporting with Codecov integration
- Standalone binary builds (macOS, Linux, Windows) via Bun
- npm package (`janus-cli`)
- Cross-platform install scripts (`install.sh`, `install.ps1`)
- CI pipeline with Node 22/24 matrix, gitleaks secret scanning, version sync
- Release workflow with tag verification, binary builds, npm publish
- Issue templates, PR template, dependabot monitoring
- Community health files (CONTRIBUTING, SECURITY, CODE_OF_CONDUCT)

### Output formats

- NUL-delimited (default when piped, like `find -print0`)
- JSONL (lossless round-trip)
- Pretty (human view, default on terminal)
- Raw (newline-separated, with ambiguity warning)

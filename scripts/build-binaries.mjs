#!/usr/bin/env node
/**
 * Compiles the bundled CLI into standalone executables — one per platform, no
 * Node required on the target machine.
 *
 * Bun rather than Node's SEA: `bun build --compile --target=...` cross-compiles
 * every platform from a single runner, where SEA can only build for the host and
 * would need a macOS, a Linux and a Windows job (plus postject and re-signing on
 * macOS). One toolchain, one job, five artifacts.
 *
 * Run `npm run build` first — it compiles dist/janus.js, which is already a
 * zero-dependency bundle.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const entry = join(pkgRoot, "dist", "janus.js");
const outDir = join(pkgRoot, "binaries");

const { version } = JSON.parse(readFileSync(join(pkgRoot, "package.json"), "utf8"));

/** Asset names are what install.sh and install.ps1 construct, so they are a contract. */
const TARGETS = [
  { target: "bun-darwin-arm64", asset: "janus-darwin-arm64" },
  { target: "bun-darwin-x64", asset: "janus-darwin-x64" },
  { target: "bun-linux-x64", asset: "janus-linux-x64" },
  { target: "bun-linux-arm64", asset: "janus-linux-arm64" },
  { target: "bun-windows-x64", asset: "janus-windows-x64.exe" },
];

const bun = process.env.BUN_PATH || "bun";
mkdirSync(outDir, { recursive: true });

for (const { target, asset } of TARGETS) {
  process.stdout.write(`building ${asset} … `);
  execFileSync(
    bun,
    ["build", entry, "--compile", `--target=${target}`, "--minify", "--outfile", join(outDir, asset)],
    { stdio: ["ignore", "ignore", "inherit"] },
  );
  process.stdout.write("ok\n");
}

// Checksums, so install.sh can verify what it downloaded before running it. An
// installer that pipes an unverified binary into your PATH is exactly the
// supply-chain problem this project exists to talk about.
const lines = readdirSync(outDir)
  .filter((f) => f.startsWith("janus-"))
  .sort()
  .map((f) => `${createHash("sha256").update(readFileSync(join(outDir, f))).digest("hex")}  ${f}`);

writeFileSync(join(outDir, "SHA256SUMS"), lines.join("\n") + "\n");
console.log(`\njanus ${version} — ${lines.length} binaries + SHA256SUMS in binaries/`);

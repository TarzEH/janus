import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import {
  build,
  CATEGORY_META,
  JANUS_VERSION,
  MUTATORS,
  MUTATOR_IDS,
  RefusedPayloadError,
  TECHNIQUES,
  getTechnique,
  type Category,
  type MutatorId,
  type Payload,
} from "../index.js";

const HELP = `janus ${JANUS_VERSION} — wrap your instruction in documented prompt-injection techniques

USAGE
  janus [options] [FILE...]        reads stdin when no FILE is given ("-" is stdin)
  janus -i "INSTRUCTION"           instruction on the command line
  janus --input="--ignore all"     when the instruction starts with a dash

  One instruction in, N payloads out. It does not run attacks, score responses,
  or make network requests.

OPTIONS
  -i, --input TEXT      Instruction to wrap, instead of reading a file or stdin.
  -t, --technique SEL   Restrict the pool. Comma-separated, repeatable. [default: all]
  -x, --exclude SEL     Remove from the pool. Applied after -t.
  -m, --mutate SPEC     Obfuscation chain: recommended | none | id,id,...
                        [default: recommended — obfuscation is ON]
  -n, --count N         Stop after N payloads.
  -s, --seed S          Reproducibility. Generated and echoed to stderr if omitted.
  -o, --output PATTERN  Write to files instead of stdout; %n is the payload index.
  -q, --quiet           Silence stderr. Never affects stdout.
  -l, --list            List techniques and mutators, then exit.
  -h, --help  -V, --version

OUTPUT FORMAT
  -0, --null            NUL after each payload.  [default when stdout is a pipe]
  -J, --jsonl           One JSON string per line. Lossless and line-safe.
      --raw             Newline-separated. AMBIGUOUS: payloads contain newlines.
      --pretty          Human view.  [default when stdout is a terminal]

  Payloads are multi-line by design, so a newline cannot delimit them. NUL can:
      janus -i "..." | xargs -0 -n1 curl -sd
      janus -i "..." --jsonl | jq -r .

  SEL is JNS-0017 | C1..C8 | a category slug | all

EXIT
  0  payloads written        2  usage error
  1  nothing to emit         3  refused (see SECURITY.md)

Only use this against systems you own or are contracted to test.
`;

function die(message: string, code = 2): never {
  process.stderr.write(`janus: ${message}\n`);
  process.exit(code);
}

// `janus ... | head` closes stdout early. Exiting non-zero here would kill the
// caller under `set -euo pipefail`, so a broken pipe is a clean exit, not an error.
for (const s of [process.stdout, process.stderr]) {
  s.on("error", (e: NodeJS.ErrnoException) => {
    if (e.code === "EPIPE") process.exit(0);
    throw e;
  });
}

interface Flags {
  input?: string;
  technique?: string[];
  exclude?: string[];
  mutate?: string;
  count?: string;
  seed?: string;
  output?: string;
  quiet?: boolean;
  list?: boolean;
  null?: boolean;
  jsonl?: boolean;
  raw?: boolean;
  pretty?: boolean;
  help?: boolean;
  version?: boolean;
}

const CATEGORY_BY_CODE = new Map<string, Category>(
  Object.entries(CATEGORY_META).map(([slug, m]) => [m.code, slug as Category]),
);

function resolveSelector(sel: string): string[] {
  const s = sel.trim();
  if (!s) return [];
  if (s.toLowerCase() === "all") return TECHNIQUES.map((t) => t.id);

  const byId = getTechnique(s.toUpperCase());
  if (byId) return [byId.id];

  const category = CATEGORY_BY_CODE.get(s.toUpperCase()) ?? (s.toLowerCase() as Category);
  if (category in CATEGORY_META) {
    return TECHNIQUES.filter((t) => t.category === category).map((t) => t.id);
  }

  return die(`unknown selector "${sel}" — try a technique id, C1..C8, a category slug, or "all"`);
}

function expand(specs: readonly string[] | undefined): string[] {
  return (specs ?? []).flatMap((spec) => spec.split(",").flatMap(resolveSelector));
}

function parseMutators(spec: string | undefined): "recommended" | "none" | MutatorId[] {
  const m = (spec ?? "recommended").trim();
  if (m === "recommended" || m === "none") return m;

  const ids = m
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
  const unknown = ids.filter((id) => !(MUTATOR_IDS as readonly string[]).includes(id));
  if (unknown.length) die(`unknown mutator(s): ${unknown.join(", ")} — see \`janus --list\``);

  const encoders = ids.filter((id) => MUTATORS.find((x) => x.id === id)?.kind === "encoding");
  if (encoders.length > 1) {
    die(`only one encoding mutator per chain, and it must be last: ${encoders.join(", ")}`);
  }
  return ids as MutatorId[];
}

function readInput(files: readonly string[]): string {
  const sources = files.length ? files : ["-"];
  return sources
    .map((f) => {
      try {
        return f === "-" ? readFileSync(0, "utf8") : readFileSync(f, "utf8");
      } catch {
        return die(`cannot read ${f === "-" ? "stdin" : f}`);
      }
    })
    .join("\n");
}

function cmdList(): void {
  const w = process.stdout;
  w.write("TECHNIQUES\n");
  for (const t of TECHNIQUES) w.write(`  ${t.id}  ${CATEGORY_META[t.category].code}  ${t.name}\n`);
  w.write("\nMUTATORS  (stage order: linguistic > obfuscation > structural > padding > encoding)\n");
  for (const m of MUTATORS) w.write(`  ${m.id.padEnd(20)}${m.kind.padEnd(14)}${m.describe}\n`);
  w.write("\nEncoding is terminal; at most one per chain.\n");
}

/**
 * Multi-line payloads make newline separation structurally ambiguous — the same
 * defect as hashcat's `--stdout` — so the piped default is NUL, and `--raw`
 * warns rather than silently emitting an unparseable stream.
 */
function formatOf(flags: Flags): "null" | "jsonl" | "raw" | "pretty" {
  if (flags.jsonl) return "jsonl";
  if (flags.null) return "null";
  if (flags.raw) return "raw";
  if (flags.pretty) return "pretty";
  return process.stdout.isTTY ? "pretty" : "null";
}

function render(p: Payload, format: string, index: number, total: number): string {
  switch (format) {
    case "jsonl":
      return JSON.stringify(p.text) + "\n";
    case "raw":
      return p.text + "\n";
    case "pretty": {
      const chain = p.chain.length ? p.chain.map((c) => c.id).join(" > ") : "none";
      return `── ${index + 1}/${total}  ${p.techniqueId}  [${chain}]\n${p.text}\n\n`;
    }
    default:
      return p.text + "\0";
  }
}

function main(): void {
  let parsed;
  try {
    parsed = parseArgs({
      args: process.argv.slice(2),
      allowPositionals: true,
      options: {
        input: { type: "string", short: "i" },
        technique: { type: "string", short: "t", multiple: true },
        exclude: { type: "string", short: "x", multiple: true },
        mutate: { type: "string", short: "m" },
        count: { type: "string", short: "n" },
        seed: { type: "string", short: "s" },
        output: { type: "string", short: "o" },
        quiet: { type: "boolean", short: "q" },
        list: { type: "boolean", short: "l" },
        null: { type: "boolean", short: "0" },
        jsonl: { type: "boolean", short: "J" },
        raw: { type: "boolean" },
        pretty: { type: "boolean" },
        help: { type: "boolean", short: "h" },
        version: { type: "boolean", short: "V" },
      },
    });
  } catch (e) {
    die(`${(e as Error).message}\nRun \`janus --help\`.`);
  }

  const flags = parsed.values as Flags;
  const files = parsed.positionals;

  if (flags.version) return void process.stdout.write(`janus ${JANUS_VERSION}\n`);
  if (flags.help) return void process.stdout.write(HELP);
  if (flags.list) return cmdList();

  if (process.stdin.isTTY && flags.input === undefined && files.length === 0) {
    return void process.stdout.write(HELP);
  }

  // Argv beats files beats stdin. Byte-exact either way: a trailing newline is
  // content in a payload, and silently chomping it is the `curl -d` mistake.
  const instruction = flags.input ?? readInput(files);
  if (!instruction.trim()) die('empty input — pass -i "INSTRUCTION", a FILE, or pipe text in');

  const count = flags.count === undefined ? undefined : Number(flags.count);
  if (count !== undefined && (!Number.isInteger(count) || count < 1)) {
    die(`-n takes a positive whole number, got "${flags.count}"`);
  }

  const included = flags.technique?.length ? expand(flags.technique) : undefined;
  const excluded = new Set(expand(flags.exclude));
  let ids: string[] | undefined;
  if (included || excluded.size) {
    ids = (included ?? TECHNIQUES.map((t) => t.id)).filter((id) => !excluded.has(id));
    if (ids.length === 0) die("-t and -x cancelled out: the pool is empty");
  }

  // Seeded from the OS when absent, and always echoed so any run can be replayed.
  const seed = flags.seed ?? randomBytes(4).toString("hex");
  const result = build({
    instruction,
    techniqueIds: ids,
    mutators: parseMutators(flags.mutate),
    seed,
    limit: count,
  });

  if (!flags.quiet) {
    process.stderr.write(`seed: ${seed}\n`);
    for (const p of result.payloads) {
      for (const w of p.warnings) process.stderr.write(`${p.techniqueId}: ${w}\n`);
    }
    for (const s of result.skipped) process.stderr.write(`${s.id}: ${s.reason}\n`);
  }

  if (result.payloads.length === 0) {
    if (!flags.quiet) process.stderr.write("janus: no technique applied\n");
    process.exit(1);
  }

  const format = formatOf(flags);
  if (format === "raw" && !flags.quiet && result.payloads.some((p) => p.text.includes("\n"))) {
    process.stderr.write(
      "janus: warning: --raw is newline-separated but payloads contain newlines; use -0 or --jsonl\n",
    );
  }
  // jq's --raw-output0 precedent: refuse to emit a stream that cannot be re-parsed.
  if (format === "null") {
    const bad = result.payloads.find((p) => p.text.includes("\0"));
    if (bad) die(`${bad.techniqueId} contains a NUL byte; use --jsonl instead`, 1);
  }

  if (flags.output) {
    const pattern = flags.output;
    const perFile = pattern.includes("%n");
    result.payloads.forEach((p, i) => {
      const path = perFile ? pattern.replace("%n", String(i + 1)) : pattern;
      try {
        // One file per payload gets the exact bytes and nothing else; a single
        // file keeps the stream framing so it stays parseable.
        const body = perFile ? p.text : render(p, format, i, result.payloads.length);
        writeFileSync(path, body, { flag: !perFile && i > 0 ? "a" : "w" });
      } catch (e) {
        die(`cannot write ${path}: ${(e as Error).message}`);
      }
    });
    return;
  }

  // Written one record at a time so a streaming consumer sees payload #1 before
  // #19 is computed, rather than everything arriving at exit.
  result.payloads.forEach((p, i) => {
    process.stdout.write(render(p, format, i, result.payloads.length));
  });
}

try {
  main();
} catch (e: unknown) {
  if (e instanceof RefusedPayloadError) die(e.message, 3);
  die(e instanceof Error ? e.message : String(e), 2);
}

import { createInterface } from "node:readline";
import { randomBytes } from "node:crypto";
import {
  build,
  CATEGORY_META,
  JANUS_VERSION,
  TECHNIQUES,
  MUTATORS,
  generateReport,
  reportToMarkdown,
  type MutatorId,
  type Payload,
} from "../index.js";

interface ReplState {
  instruction: string;
  techniques: string[] | undefined;
  mutators: "recommended" | "none" | MutatorId[];
  seed: string | undefined;
  limit: number | undefined;
}

const BANNER = `janus ${JANUS_VERSION} — interactive mode
Type .help for commands, .quit to exit.
`;

const COMMANDS: Record<string, string> = {
  ".help": "Show this help",
  ".set <instruction>": "Set the instruction to wrap",
  ".techniques [SEL]": "Set technique filter (empty = all)",
  ".mutators [SPEC]": "Set mutator chain: recommended | none | id,id,...",
  ".seed [S]": "Set seed (empty = random each run)",
  ".limit [N]": "Set payload limit (empty = all)",
  ".run": "Generate payloads with current settings",
  ".report [json|md]": "Generate a report with current settings",
  ".show": "Show current settings",
  ".list": "List available techniques",
  ".clear": "Reset all settings",
  ".quit": "Exit",
};

function showHelp(): void {
  for (const [cmd, desc] of Object.entries(COMMANDS)) {
    process.stdout.write(`  ${cmd.padEnd(26)} ${desc}\n`);
  }
  process.stdout.write("\nAnything else is treated as an instruction → immediate .run\n");
}

function showSettings(state: ReplState): void {
  process.stdout.write(`  instruction:  ${state.instruction || "(not set)"}\n`);
  process.stdout.write(`  techniques:   ${state.techniques?.join(", ") || "all"}\n`);
  process.stdout.write(`  mutators:     ${Array.isArray(state.mutators) ? state.mutators.join(",") : state.mutators}\n`);
  process.stdout.write(`  seed:         ${state.seed ?? "(random)"}\n`);
  process.stdout.write(`  limit:        ${state.limit ?? "all"}\n`);
}

function renderPretty(p: Payload, index: number, total: number): string {
  const chain = p.chain.length ? p.chain.map((c) => c.id).join(" > ") : "none";
  return `── ${index + 1}/${total}  ${p.techniqueId}  [${chain}]\n${p.text}\n`;
}

function runGenerate(state: ReplState): void {
  if (!state.instruction) {
    process.stderr.write("no instruction set — use .set or type one directly\n");
    return;
  }
  const seed = state.seed ?? randomBytes(4).toString("hex");
  try {
    const result = build({
      instruction: state.instruction,
      techniqueIds: state.techniques,
      mutators: state.mutators,
      seed,
      limit: state.limit,
    });
    process.stderr.write(`seed: ${seed}\n`);
    for (const s of result.skipped) process.stderr.write(`${s.id}: ${s.reason}\n`);
    if (result.payloads.length === 0) {
      process.stderr.write("no technique applied\n");
      return;
    }
    for (const [i, p] of result.payloads.entries()) {
      for (const w of p.warnings) process.stderr.write(`${p.techniqueId}: ${w}\n`);
      process.stdout.write(renderPretty(p, i, result.payloads.length) + "\n");
    }
    process.stderr.write(`${result.payloads.length} payload(s)\n`);
  } catch (e) {
    process.stderr.write(`error: ${(e as Error).message}\n`);
  }
}

function runReport(state: ReplState, format: string): void {
  if (!state.instruction) {
    process.stderr.write("no instruction set — use .set or type one directly\n");
    return;
  }
  const seed = state.seed ?? randomBytes(4).toString("hex");
  try {
    const result = build({
      instruction: state.instruction,
      techniqueIds: state.techniques,
      mutators: state.mutators,
      seed,
      limit: state.limit,
    });
    const report = generateReport(result, state.instruction, new Date().toISOString());
    if (format === "json") {
      process.stdout.write(JSON.stringify(report, null, 2) + "\n");
    } else {
      process.stdout.write(reportToMarkdown(report));
    }
  } catch (e) {
    process.stderr.write(`error: ${(e as Error).message}\n`);
  }
}

export function startRepl(): void {
  const state: ReplState = {
    instruction: "",
    techniques: undefined,
    mutators: "recommended",
    seed: undefined,
    limit: undefined,
  };

  process.stdout.write(BANNER);

  const rl = createInterface({
    input: process.stdin,
    output: process.stderr,
    prompt: "janus> ",
    terminal: process.stdin.isTTY === true,
  });

  rl.prompt();

  rl.on("line", (raw) => {
    const line = raw.trim();
    if (!line) {
      rl.prompt();
      return;
    }

    if (line === ".quit" || line === ".exit" || line === ".q") {
      rl.close();
      return;
    }

    if (line === ".help" || line === ".h") {
      showHelp();
    } else if (line === ".show") {
      showSettings(state);
    } else if (line === ".run") {
      runGenerate(state);
    } else if (line.startsWith(".report")) {
      const fmt = line.slice(7).trim() || "md";
      if (fmt !== "json" && fmt !== "md") {
        process.stderr.write('format must be "json" or "md"\n');
      } else {
        runReport(state, fmt);
      }
    } else if (line.startsWith(".set ")) {
      state.instruction = line.slice(5).trim();
      process.stderr.write(`instruction: ${state.instruction}\n`);
    } else if (line.startsWith(".techniques")) {
      const sel = line.slice(11).trim();
      if (!sel) {
        state.techniques = undefined;
        process.stderr.write("techniques: all\n");
      } else {
        state.techniques = sel.split(",").map((s) => s.trim()).filter(Boolean);
        process.stderr.write(`techniques: ${state.techniques.join(", ")}\n`);
      }
    } else if (line.startsWith(".mutators")) {
      const spec = line.slice(9).trim() || "recommended";
      if (spec === "recommended" || spec === "none") {
        state.mutators = spec;
      } else {
        state.mutators = spec.split(",").map((s) => s.trim()).filter(Boolean) as MutatorId[];
      }
      process.stderr.write(`mutators: ${Array.isArray(state.mutators) ? state.mutators.join(",") : state.mutators}\n`);
    } else if (line.startsWith(".seed")) {
      const s = line.slice(5).trim();
      state.seed = s || undefined;
      process.stderr.write(`seed: ${state.seed ?? "(random)"}\n`);
    } else if (line.startsWith(".limit")) {
      const n = line.slice(6).trim();
      state.limit = n ? Number(n) : undefined;
      if (state.limit !== undefined && (!Number.isInteger(state.limit) || state.limit < 1)) {
        process.stderr.write("limit must be a positive integer\n");
        state.limit = undefined;
      } else {
        process.stderr.write(`limit: ${state.limit ?? "all"}\n`);
      }
    } else if (line === ".list") {
      for (const t of TECHNIQUES) {
        process.stdout.write(`  ${t.id}  ${CATEGORY_META[t.category].code}  ${t.name}\n`);
      }
      process.stdout.write(`\n${MUTATORS.length} mutators available (see janus --list)\n`);
    } else if (line === ".clear") {
      state.instruction = "";
      state.techniques = undefined;
      state.mutators = "recommended";
      state.seed = undefined;
      state.limit = undefined;
      process.stderr.write("settings cleared\n");
    } else if (line.startsWith(".")) {
      process.stderr.write(`unknown command: ${line.split(" ")[0]} — try .help\n`);
    } else {
      state.instruction = line;
      runGenerate(state);
    }

    rl.prompt();
  });

  rl.on("close", () => {
    process.exit(0);
  });
}

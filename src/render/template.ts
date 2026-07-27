import type { Slot } from "../schema/payload.js";
import type { Range } from "../text/ranges.js";

/**
 * Mustache-lite. Deliberately two constructs and no more — payload templates are
 * the product, and a templating language with logic in it would be a second
 * thing to review in every catalog PR.
 *
 *   {{slot_name}}              substitution
 *   [[lock]] ... [[/lock]]     a region mutators must leave byte-identical
 */
const TOKEN_RE = /\{\{([a-z][a-z0-9_]*)\}\}|\[\[lock\]\]|\[\[\/lock\]\]/g;

export class MissingSlotError extends Error {
  constructor(readonly slot: string) {
    super(`Template requires slot "${slot}" but no value was supplied.`);
    this.name = "MissingSlotError";
  }
}

export class UndeclaredSlotError extends Error {
  constructor(readonly slot: string) {
    super(`Template references "{{${slot}}}" which is not declared in slots[].`);
    this.name = "UndeclaredSlotError";
  }
}

export class UnbalancedLockError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnbalancedLockError";
  }
}

export interface RenderResult {
  readonly text: string;
  /** Offsets in `text`, resolved after substitution — never authored as offsets. */
  readonly locked: readonly Range[];
  readonly slotValues: Readonly<Record<string, string>>;
}

/** Slot names referenced by a template body, in order of first appearance. */
export function referencedSlots(body: string): string[] {
  const seen = new Set<string>();
  for (const m of body.matchAll(TOKEN_RE)) if (m[1]) seen.add(m[1]);
  return [...seen];
}

export function renderTemplate(
  body: string,
  slots: readonly Slot[],
  values: Readonly<Record<string, string | undefined>>,
): RenderResult {
  const declared = new Map(slots.map((s) => [s.name, s]));
  const locked: Range[] = [];
  const openStack: number[] = [];
  const used: Record<string, string> = {};

  let out = "";
  let last = 0;

  for (const m of body.matchAll(TOKEN_RE)) {
    out += body.slice(last, m.index);
    last = m.index + m[0].length;

    if (m[0] === "[[lock]]") {
      openStack.push(out.length);
      continue;
    }
    if (m[0] === "[[/lock]]") {
      const start = openStack.pop();
      if (start === undefined) throw new UnbalancedLockError("[[/lock]] without a matching [[lock]]");
      locked.push({ start, end: out.length });
      continue;
    }

    const name = m[1] as string;
    const slot = declared.get(name);
    if (!slot) throw new UndeclaredSlotError(name);

    const value = values[name] ?? slot.default;
    if (value === undefined || value === "") {
      if (slot.required) throw new MissingSlotError(name);
      continue;
    }
    used[name] = value;
    out += value;
  }

  if (openStack.length > 0) throw new UnbalancedLockError("[[lock]] without a matching [[/lock]]");
  out += body.slice(last);

  return { text: out, locked, slotValues: used };
}

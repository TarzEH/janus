import { describe, expect, it } from "vitest";
import {
  MissingSlotError,
  UnbalancedLockError,
  UndeclaredSlotError,
  referencedSlots,
  renderTemplate,
} from "../src/render/template.js";
import type { Slot } from "../src/schema/payload.js";

const slot = (name: string, required = true): Slot => ({
  name,
  description: name,
  required,
  examples: [],
});

describe("renderTemplate", () => {
  it("substitutes declared slots", () => {
    const r = renderTemplate("hello {{who}}!", [slot("who")], { who: "world" });
    expect(r.text).toBe("hello world!");
    expect(r.slotValues).toEqual({ who: "world" });
  });

  it("throws on a missing required slot rather than emitting a hole", () => {
    expect(() => renderTemplate("{{who}}", [slot("who")], {})).toThrow(MissingSlotError);
  });

  it("omits an optional slot with no value", () => {
    const r = renderTemplate("a{{who}}b", [slot("who", false)], {});
    expect(r.text).toBe("ab");
  });

  it("throws when the template references an undeclared slot", () => {
    expect(() => renderTemplate("{{ghost}}", [], {})).toThrow(UndeclaredSlotError);
  });

  it("resolves lock markers to offsets AFTER substitution", () => {
    const r = renderTemplate("xx[[lock]]{{v}}[[/lock]]yy", [slot("v")], { v: "CANARY" });
    expect(r.text).toBe("xxCANARYyy");
    expect(r.locked).toEqual([{ start: 2, end: 8 }]);
    expect(r.text.slice(2, 8)).toBe("CANARY");
  });

  it("supports several lock regions", () => {
    const r = renderTemplate("[[lock]]a[[/lock]]-[[lock]]b[[/lock]]", [], {});
    expect(r.text).toBe("a-b");
    expect(r.locked).toEqual([
      { start: 0, end: 1 },
      { start: 2, end: 3 },
    ]);
  });

  it("rejects unbalanced locks", () => {
    expect(() => renderTemplate("[[lock]]a", [], {})).toThrow(UnbalancedLockError);
    expect(() => renderTemplate("a[[/lock]]", [], {})).toThrow(UnbalancedLockError);
  });

  it("does not re-render substituted values", () => {
    const r = renderTemplate("{{v}}", [slot("v")], { v: "{{v}}" });
    expect(r.text).toBe("{{v}}");
  });

  it("lists referenced slots in first-appearance order", () => {
    expect(referencedSlots("{{b}} {{a}} {{b}}")).toEqual(["b", "a"]);
  });
});

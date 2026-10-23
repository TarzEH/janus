import { describe, expect, it } from "vitest";
import { parseTechniques, LoadError } from "../src/index.js";

const VALID_TECHNIQUE = {
  id: "JNS-9001",
  name: "Test Technique",
  status: "stable",
  category: "instruction-hierarchy",
  multiTurn: false,
  template: { body: "OVERRIDE: {{objective}}" },
  slots: [{ name: "objective", description: "The injected instruction", required: true }],
  mutators: { recommended: [], incompatible: [] },
};

describe("parseTechniques", () => {
  it("parses a single valid technique object", () => {
    const result = parseTechniques(VALID_TECHNIQUE, "test.json");
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("JNS-9001");
  });

  it("parses an array of techniques", () => {
    const second = { ...VALID_TECHNIQUE, id: "JNS-9002", name: "Second Technique" };
    const result = parseTechniques([VALID_TECHNIQUE, second], "test.json");
    expect(result).toHaveLength(2);
  });

  it("throws LoadError on invalid technique", () => {
    expect(() => parseTechniques({ id: "BAD" }, "test.json")).toThrow(LoadError);
  });

  it("throws LoadError on empty array", () => {
    expect(() => parseTechniques([], "test.json")).toThrow(LoadError);
  });
});

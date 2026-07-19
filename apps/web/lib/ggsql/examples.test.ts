import { describe, expect, it } from "vitest";
import { assertReadOnlyGgsql } from "./query-context";
import { VISUALIZATION_EXAMPLES } from "./examples";

describe("visualization examples", () => {
  it("keeps every example unique, read-only, and complete", () => {
    expect(new Set(VISUALIZATION_EXAMPLES.map((example) => example.id)).size).toBe(VISUALIZATION_EXAMPLES.length);
    for (const example of VISUALIZATION_EXAMPLES) {
      expect(() => assertReadOnlyGgsql(example.query)).not.toThrow();
      expect(example.query).toContain("VISUALISE");
      expect(example.query).toMatch(/\bDRAW\b/);
    }
  });

  it("includes maps, uncertainty, regression, and scenario compositions", () => {
    const tags = new Set(VISUALIZATION_EXAMPLES.flatMap((example) => example.tags));
    expect([...tags]).toEqual(expect.arrayContaining(["map", "ribbon", "regression", "scenario"]));
  });
});

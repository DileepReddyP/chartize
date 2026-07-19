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

  it("centers contiguous-U.S. Albers examples on the data", () => {
    const usMaps = VISUALIZATION_EXAMPLES.filter((example) => example.source === "chartize:us_counties_2025");
    expect(usMaps.length).toBeGreaterThan(0);
    for (const example of usMaps) {
      expect(example.query).toContain("PROJECT TO albers");
      expect(example.query).toContain("SETTING origin => (-96, 37.5), parallel => (29.5, 45.5)");
    }
  });
});

import { describe, expect, it } from "vitest";
import { ModelSuggestionSchema, normalizeModelGgsql, normalizeModelSuggestion, publicAiError } from "./model-output";

describe("Chartize AI model output", () => {
  it("normalizes an unused zero smoothing adjustment to the semantic default", () => {
    const modelResult = ModelSuggestionSchema.parse({
      query: "SELECT value FROM chartize:example\n\nVISUALISE\nDRAW line\n  MAPPING value AS y",
      draft: {
        source: "chartize:example",
        layers: [{ mark: "line", smoothAdjust: 0 }],
        scales: [],
      },
      explanation: "Kept the current view.",
      assumptions: [],
      warnings: [],
    });

    const normalized = normalizeModelSuggestion(modelResult);
    expect(normalized.draft.layers[0]?.smoothAdjust).toBe(1);
    expect(normalized).toMatchObject({ sources: [], researched: false });
  });

  it("does not expose raw Zod issue arrays in the UI", () => {
    const invalid = ModelSuggestionSchema.safeParse({});
    expect(invalid.success).toBe(false);
    if (!invalid.success) {
      expect(publicAiError(invalid.error)).toBe("Chartize AI returned an incomplete visualization draft. Please try again.");
    }
  });

  it("repairs common structured-model clause formatting without changing SQL", () => {
    const query = `SELECT geometry, change, lon, lat, label FROM chartize:states

VISUALISE
PROJECT TO albers WITH SETTING origin => (-96, 37.5)
DRAW spatial
  MAPPING geometry AS geometry, change AS fill
DRAW text
  MAPPING lon AS lon, lat AS lat, label AS label
SCALE CONTINUOUS fill TO 'vik'
LABEL title => 'Population change'
  subtitle => '2020–2025'
  fill => 'Change (%)'`;
    const normalized = normalizeModelGgsql(query);
    expect(normalized).toContain("SCALE CONTINUOUS fill TO vik");
    expect(normalized).toContain("LABEL title => 'Population change',\n  subtitle => '2020–2025',\n  fill => 'Change (%)'");
    expect(normalized.indexOf("PROJECT TO albers")).toBeGreaterThan(normalized.indexOf("LABEL title"));
    expect(normalized).toContain("PROJECT TO albers\n  SETTING origin => (-96, 37.5)");
    expect(normalized).not.toContain("WITH SETTING");
    expect(normalized.startsWith("SELECT geometry")).toBe(true);
  });
});

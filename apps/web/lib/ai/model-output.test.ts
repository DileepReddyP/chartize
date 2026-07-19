import { describe, expect, it } from "vitest";
import { ModelSuggestionSchema, normalizeModelSuggestion, publicAiError } from "./model-output";

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
});

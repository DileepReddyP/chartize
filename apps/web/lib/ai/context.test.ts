import type { FieldMetadata } from "@chartize/contracts";
import { describe, expect, it } from "vitest";
import { compactAiContext, compactHistory, compactWorkspaceData, isComplexVisualizationRequest, isExplanationRequest, requestedResearchItemCount } from "./context";

const fillerFields: FieldMetadata[] = Array.from({ length: 80 }, (_, index) => ({
  name: `unused_${index}`,
  dataType: "VARCHAR",
  nullable: true,
}));

describe("Chartize AI context routing", () => {
  it("keeps a compact index while prioritizing active and requested fields", () => {
    const result = compactAiContext({
      sources: [{ id: "chartize:polls", title: "Polls", description: "Approval polling", fields: [...fillerFields, { name: "approve", dataType: "DOUBLE", nullable: true, semanticType: "measure" }] }, { id: "chartize:counties", title: "County population", description: "Population estimates", fields: [{ name: "population", dataType: "BIGINT", nullable: false, semanticType: "measure" }] }],
      activeSource: "chartize:polls",
      currentQuery: "SELECT approve FROM chartize:polls",
      request: "Explain approval",
      contextNote: "selected range",
    });
    expect(result.sourceIndex).toHaveLength(2);
    expect(result.sourceSchemas[0]?.source).toBe("chartize:polls");
    expect(result.sourceSchemas[0]?.fields.some((field) => field.name === "approve")).toBe(true);
    expect(result.sourceSchemas[0]?.fields.length).toBeLessThanOrEqual(40);
  });

  it("does not attach unrelated schemas to an edit just because ambient context shares broad words", () => {
    const result = compactAiContext({
      sources: [
        { id: "chartize:approval", title: "Presidential approval", description: "Daily political polling", fields: [{ name: "approve", dataType: "DOUBLE", nullable: true }] },
        { id: "chartize:gdp", title: "County GDP", description: "Economic data", fields: [{ name: "gdp", dataType: "DOUBLE", nullable: true }] },
      ],
      activeSource: "chartize:approval",
      currentQuery: "SELECT approve FROM chartize:approval",
      request: "Search for economic events and annotate this chart",
      contextNote: "Presidential approval chart",
    });
    expect(result.sourceSchemas.map((schema) => schema.source)).toEqual(["chartize:approval"]);
  });

  it("routes explanation, research, and complex blank builds independently", () => {
    expect(isExplanationRequest("Why did Trump's approval fall here?")).toBe(true);
    expect(isExplanationRequest("Evidence check")).toBe(true);
    expect(isExplanationRequest("Show approval and disapproval as two lines")).toBe(false);
    expect(isExplanationRequest("Why did Trump’s approval fall? Use live sources.")).toBe(true);
    expect(isExplanationRequest("Show me why this changed")).toBe(true);
    expect(isExplanationRequest("Show approval as two lines")).toBe(false);
    expect(isExplanationRequest("Calculate the exact average approval value")).toBe(true);
    expect(isComplexVisualizationRequest("Aggregate counties and join state boundaries for a choropleth", "", "generate")).toBe(true);
    expect(requestedResearchItemCount("Find three consequential events")).toBe(3);
    expect(requestedResearchItemCount("Search for three consequential U.S. political or economic events between April and July 2025")).toBe(3);
    expect(requestedResearchItemCount("Find 5 direct sources")).toBe(5);
    expect(requestedResearchItemCount("What happened in 2025?")).toBe(1);
  });

  it("removes adjacent duplicate transcript messages", () => {
    expect(compactHistory([{ role: "assistant", text: "same" }, { role: "assistant", text: "same" }, { role: "user", text: "next" }])).toHaveLength(2);
  });

  it("retains the former DWIM referent on earlier user messages", () => {
    const history = compactHistory([{
      role: "user",
      text: "Why did this fall?",
      context: { kind: "chart", note: "Selected range: January" },
    }]);
    expect(history[0]?.text).toContain("Selected range: January");
    expect(history[0]?.text).toContain("Why did this fall?");
  });

  it("uses both edited and rendered queries to retain relevant fields", () => {
    const result = compactAiContext({
      sources: [{
        id: "chartize:polls",
        title: "Polls",
        description: "Approval polling",
        fields: [
          { name: "approve", dataType: "DOUBLE", nullable: true },
          { name: "disapprove", dataType: "DOUBLE", nullable: true },
        ],
      }],
      activeSource: "chartize:polls",
      currentQuery: "SELECT disapprove FROM chartize:polls",
      renderedQuery: "SELECT approve FROM chartize:polls",
      request: "Explain the visible chart",
      contextNote: "chart",
    });
    expect(result.sourceSchemas[0]?.fields.map((field) => field.name)).toEqual(expect.arrayContaining(["approve", "disapprove"]));
  });

  it("bounds wide browser-query evidence while preserving valid rows", () => {
    const compacted = compactWorkspaceData([{
      sql: "SELECT * FROM chartize:wide",
      purpose: "Inspect the selection",
      columns: Array.from({ length: 80 }, (_, index) => `column_${index}`),
      rows: Array.from({ length: 100 }, () => Array.from({ length: 80 }, () => "x".repeat(1000))),
      returnedRows: 100,
      truncated: false,
    }], 20_000);
    expect(JSON.stringify(compacted).length).toBeLessThanOrEqual(20_500);
    expect(compacted[0]?.truncated).toBe(true);
  });
});

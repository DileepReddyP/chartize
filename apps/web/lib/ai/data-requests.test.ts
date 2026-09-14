import { AiTurnEnvelopeSchema } from "@chartize/contracts";
import { describe, expect, it } from "vitest";
import { resolveDataRequest } from "./data-requests";

const body = AiTurnEnvelopeSchema.parse({
  task: "explain", context: "chart", contextNote: "Rendered chart", request: "Average these rows", preferences: {}, history: [],
  currentQuery: "SELECT * FROM source WHERE value > 100", queryStatus: "edited",
  renderedQuery: "WITH filtered AS (SELECT * FROM source WHERE value > 5) SELECT value FROM filtered LIMIT 22;\nVISUALISE\nDRAW point MAPPING value AS y",
  schema: [], availableSources: [], view: { title: "", subtitle: "", sources: [] },
});

describe("rendered data inspection", () => {
  it("uses the last rendered SELECT, preserving its CTEs, filters and limit", () => {
    const result = resolveDataRequest({ scope: "rendered", sql: "SELECT AVG(value) AS average FROM rendered_data;", purpose: "Average the visible rows", limit: 1 }, body);
    expect(result.sql).toContain("WITH rendered_data AS (\nWITH filtered AS");
    expect(result.sql).toContain("WHERE value > 5");
    expect(result.sql).toContain("LIMIT 22");
    expect(result.sql).not.toContain("value > 100");
    expect(result.sql).not.toContain("VISUALISE");
    expect(result.sql).toContain("SELECT AVG(value) AS average FROM rendered_data\n)");
  });

  it("rejects missing rendered state and multiple statements before wrapping SQL", () => {
    const request = { scope: "rendered" as const, sql: "SELECT * FROM rendered_data", purpose: "Read rows", limit: 1 };
    expect(() => resolveDataRequest(request, { ...body, renderedQuery: "" })).toThrow("no rendered query");
    expect(() => resolveDataRequest({ ...request, sql: "SELECT * FROM rendered_data; DELETE FROM source" }, body)).toThrow("read-only");
  });
});

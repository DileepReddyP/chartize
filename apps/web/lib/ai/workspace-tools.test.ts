import { describe, expect, it } from "vitest";
import { createWorkspaceFunctionTools, normalizeWarehouseToolSql } from "./workspace-tools";

describe("normalizeWarehouseToolSql", () => {
  const sources = ["chartize:approval", "chartize:county_population"];

  it("maps namespaced public sources to warehouse views", () => {
    expect(normalizeWarehouseToolSql(
      "SELECT a.value FROM chartize:approval a JOIN \"chartize:county_population\" c ON a.id = c.id",
      sources,
    )).toBe("SELECT a.value FROM \"approval\" a JOIN \"county_population\" c ON a.id = c.id");
  });

  it("allows one bounded analytical statement", () => {
    expect(normalizeWarehouseToolSql("WITH totals AS (SELECT 1 AS n) SELECT n FROM totals;", sources))
      .toBe("WITH totals AS (SELECT 1 AS n) SELECT n FROM totals");
  });

  it("rejects mutation, file readers, multiple statements, and unknown namespaced sources", () => {
    expect(() => normalizeWarehouseToolSql("DELETE FROM chartize:approval", sources)).toThrow(/SELECT or WITH/);
    expect(() => normalizeWarehouseToolSql("SELECT * FROM read_parquet('/tmp/a')", sources)).toThrow(/blocked/);
    expect(() => normalizeWarehouseToolSql("SELECT * FROM read_text('/etc/passwd')", sources)).toThrow(/blocked/);
    expect(() => normalizeWarehouseToolSql("SELECT * FROM parquet_scan('/tmp/a')", sources)).toThrow(/blocked/);
    expect(() => normalizeWarehouseToolSql("SELECT * FROM query_table('warehouse_versions')", sources)).toThrow(/blocked/);
    expect(() => normalizeWarehouseToolSql("SELECT 1; SELECT 2", sources)).toThrow(/one SQL statement/);
    expect(() => normalizeWarehouseToolSql("SELECT * FROM chartize:private", sources)).toThrow(/not available/);
  });
});

describe("createWorkspaceFunctionTools", () => {
  it("always provides the drawing cookbook, even without warehouse access", async () => {
    const tools = createWorkspaceFunctionTools({
      availableSourceIds: [],
      engineUrl: "http://127.0.0.1:8787",
      allowDataQueries: false,
    });
    const cookbook = tools.find((tool) => tool.name === "get_visualization_tips");

    expect(cookbook).toBeDefined();
    await expect(cookbook?.execute({ topics: ["endpoint-labels", "layered-series"] })).resolves.toMatchObject({
      reference: "Chartize cookbook for GGSQL 0.4.1",
      tips: [
        { topic: "endpoint-labels" },
        { topic: "layered-series" },
      ],
    });
  });

  it("teaches endpoint labels as a one-row-per-series invariant", async () => {
    const [cookbook] = createWorkspaceFunctionTools({
      availableSourceIds: [],
      engineUrl: "http://127.0.0.1:8787",
      allowDataQueries: false,
    });
    const result = await cookbook?.execute({ topics: ["endpoint-labels"] });
    const serialized = JSON.stringify(result);

    expect(serialized).toContain("COUNT_IF(endpoint_label IS NOT NULL) = 1");
    expect(serialized).toContain("CASE WHEN date_field = last_date");
    expect(serialized).toContain("endpoint_x AS x");
  });

  it("adds the warehouse query tool only when public data access is allowed", () => {
    const tools = createWorkspaceFunctionTools({
      availableSourceIds: ["chartize:approval"],
      engineUrl: "http://127.0.0.1:8787",
      allowDataQueries: true,
    });

    expect(tools.map((tool) => tool.name)).toEqual(["query_warehouse", "get_visualization_tips"]);
  });
});

import { describe, expect, it } from "vitest";
import { normalizeWarehouseToolSql } from "./workspace-tools";

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

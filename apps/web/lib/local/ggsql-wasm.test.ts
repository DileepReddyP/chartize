import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import init, { GgsqlContext } from "ggsql-wasm";
import type { Point } from "geojson";
import { geojsonToParquet, rowsToParquet } from "./parquet";

describe("GGSQL WASM", () => {
  it("ranks prepared values using the unqualified window aliases in the AI reference", async () => {
    const bytes = await readFile(new URL("../../node_modules/ggsql-wasm/ggsql_wasm_bg.wasm", import.meta.url));
    await init({ module_or_path: bytes });
    const context = new GgsqlContext();
    try {
      await context.register_parquet("scores", rowsToParquet([
        { route: "A", raw: "7", id: 1 }, { route: "A", raw: "12", id: 2 },
        { route: "B", raw: null, id: 3 }, { route: "B", raw: "20", id: 4 },
      ]));
      const sql = `WITH prepared AS (
  SELECT route, CAST(raw AS DOUBLE) AS score,
    CASE WHEN raw IS NULL THEN 1 ELSE 0 END AS missing_flag, id AS row_id
  FROM scores
)
SELECT route, row_id, ROW_NUMBER() OVER (
  PARTITION BY route ORDER BY missing_flag, score DESC, row_id
) AS rank FROM prepared ORDER BY route, rank`;
      const spec = JSON.parse(context.execute(`${sql}\nVISUALISE\nDRAW point\nMAPPING route AS x, rank AS y`));
      expect(spec.$schema).toContain("vega-lite");
      expect(JSON.parse(context.execute_sql(sql)).rows).toEqual([["A", "2", "1"], ["A", "1", "2"], ["B", "4", "1"], ["B", "3", "2"]]);
    } finally { context.free(); }
  });

  it("renders the built-in browser sample", async () => {
    const bytes = await readFile(new URL("../../node_modules/ggsql-wasm/ggsql_wasm_bg.wasm", import.meta.url));
    await init({ module_or_path: bytes });
    const context = new GgsqlContext();
    await context.register_builtin_datasets();
    const spec = JSON.parse(context.execute("SELECT bill_len, bill_dep FROM ggsql:penguins LIMIT 3\n\nVISUALISE\nDRAW point\nMAPPING bill_len AS x, bill_dep AS y")) as Record<string, unknown>;
    expect(spec.$schema).toContain("vega-lite");

    await context.register_parquet("county_population", rowsToParquet([{ county: "Ada", population: 5321 }, { county: "Benton", population: 9812 }]));
    const localSpec = JSON.parse(context.execute("SELECT county, population FROM county_population\n\nVISUALISE\nDRAW bar\nMAPPING county AS x, population AS y")) as Record<string, unknown>;
    expect(localSpec.$schema).toContain("vega-lite");

    const geographic = geojsonToParquet({ type: "Point", coordinates: [-77, 39] } as Point);
    await context.register_parquet("visitor_map", geographic.bytes);
    const preview = JSON.parse(context.execute_sql("SELECT __feature_id, geometry FROM visitor_map")) as { total_rows: number };
    expect(preview.total_rows).toBe(1);
    context.free();
  });
});

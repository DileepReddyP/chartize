import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import init, { GgsqlContext } from "ggsql-wasm";
import type { Point } from "geojson";
import { geojsonToParquet, rowsToParquet } from "./parquet";

describe("GGSQL WASM", () => {
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

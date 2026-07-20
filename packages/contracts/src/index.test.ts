import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { DatasetManifestSchema, GgsqlDraftSchema } from "./index";

describe("GgsqlDraftSchema", () => {
  it("fills safe defaults", () => {
    const draft = GgsqlDraftSchema.parse({
      source: "penguins",
      layers: [{ mark: "point" }],
    });
    expect(draft.limit).toBe(5000);
    expect(draft.layers[0]?.opacity).toBe(0.9);
    expect(draft.scales).toEqual([]);
    expect(draft.axisLabels.x).toBe("");
  });
});

describe("cross-runtime dataset contract", () => {
  it("parses the manifest fixture shared across the browser and Next data routes", async () => {
    const fixture: unknown = JSON.parse(await readFile(new URL("../fixtures/dataset-manifest.json", import.meta.url), "utf8"));
    const manifest = DatasetManifestSchema.parse(fixture);
    expect(manifest.tableName).toBe("presidential_approval_average");
    expect(manifest.fields.map((field) => field.name)).toEqual(["end_date", "approve"]);
  });
});

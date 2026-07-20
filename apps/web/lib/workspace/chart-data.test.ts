import { describe, expect, it } from "vitest";
import { centeredDomain, describeChartExtent, describeChartSelection, mapFeatureSelectionFromDatum, presentationFromSpec, previewFromSpec, selectionTableFromSpec, shiftedDomain, tableFromMapFeatureSelections, visualFieldsFromPreview, visualItemSelectionFromDatum } from "./chart-data";

describe("chart workspace data", () => {
  it("zooms numeric and temporal domains around their center", () => {
    expect(centeredDomain([0, 100], 0.5)).toEqual([25, 75]);
    expect(centeredDomain(["2026-01-01", "2026-01-11"], 0.5)).toEqual([
      "2026-01-03T12:00:00.000Z",
      "2026-01-08T12:00:00.000Z",
    ]);
  });

  it("pans numeric and temporal domains by a span fraction", () => {
    expect(shiftedDomain([0, 100], 0.1)).toEqual([10, 110]);
    expect(shiftedDomain(["2026-01-01", "2026-01-11"], -0.1)).toEqual([
      "2025-12-31T00:00:00.000Z",
      "2026-01-10T00:00:00.000Z",
    ]);
  });

  it("summarizes the rendered extent for AI context without sending every row", () => {
    expect(describeChartExtent(
      { columns: ["date", "approve"], rows: [["2025-03-01", "52.9"], ["2025-08-30", "37.7"]], totalRows: 183, offset: 0, limit: 200 },
      "date",
      "approve",
      [{ name: "date", dataType: "DATE", nullable: false, semanticType: "temporal" }, { name: "approve", dataType: "DOUBLE", nullable: false, semanticType: "measure" }],
      "Poll Date",
      "Approval",
    )).toBe("Rendered data has 183 rows; Poll Date spans 2025-03-01 to 2025-08-30; Approval spans 37.7 to 52.9; Approval moves from 52.9 to 37.7 (-15.2)");
  });

  it("summarizes positional Vega fields from one analytical layer", () => {
    const table = selectionTableFromSpec({ data: { values: [
      { __ggsql_source__: "ribbon", __ggsql_aes_pos1__: "2025-03-01", __ggsql_aes_pos2__: null },
      { __ggsql_source__: "approval", __ggsql_aes_pos1__: "2025-03-01", __ggsql_aes_pos2__: 52.9 },
      { __ggsql_source__: "approval", __ggsql_aes_pos1__: "2026-07-01", __ggsql_aes_pos2__: 41.2 },
      { __ggsql_source__: "disapproval", __ggsql_aes_pos1__: "2025-03-01", __ggsql_aes_pos2__: 47.1 },
      { __ggsql_source__: "disapproval", __ggsql_aes_pos1__: "2026-07-01", __ggsql_aes_pos2__: 58.8 },
    ] } })!;
    expect(table.totalRows).toBe(2);
    expect(describeChartExtent(table, "poll_date", "approval", [], "Poll Date", "Approval"))
      .toBe("Rendered data has 2 rows; Poll Date spans 2025-03-01 to 2026-07-01; Approval spans 41.2 to 52.9; Approval moves from 52.9 to 41.2 (-11.7)");
  });

  it("extracts presentation and user columns without GGSQL bookkeeping", () => {
    const spec = {
      title: { text: "approval", subtitle: ["daily", "average"] },
      data: { values: [{ date: "2026-01-01", value: 48, __ggsql_row_index__: 0, geometry: {} }] },
    };
    expect(presentationFromSpec(spec)).toEqual({ title: "approval", subtitle: "daily average" });
    expect(previewFromSpec(spec).columns).toEqual(["date", "value"]);
  });

  it("turns one spatial mark into compact geographic context", () => {
    expect(mapFeatureSelectionFromDatum({
      NAMELSAD: "Cook County",
      STATEFP: "17",
      change_pct: -1.2345,
      POPESTIMATE2025: 5_182_617,
      geometry: new Uint8Array([1, 2, 3]),
      __ggsql_aes_fill__: -1.2345,
      label_lon: -87.7,
    }, { x: 240, y: 180 })).toEqual({
      key: "NAMELSAD:Cook County|STATEFP:17|change_pct:-1.235|POPESTIMATE2025:5,182,617",
      pixels: { x: 240, y: 180 },
      title: "Cook County",
      values: [
        { field: "NAMELSAD", value: "Cook County" },
        { field: "STATEFP", value: "17" },
        { field: "change_pct", value: "-1.235" },
        { field: "POPESTIMATE2025", value: "5,182,617" },
      ],
    });
  });

  it("omits aliased geometry and safely bounds long textual values", () => {
    const selection = mapFeatureSelectionFromDatum({
      state_name: "Wyoming",
      state_geometry: "POLYGON".repeat(400),
      note: "x".repeat(1200),
      land_use: "Grass + range",
    }, { x: 40, y: 70 })!;

    expect(selection.values.map(({ field }) => field)).not.toContain("state_geometry");
    expect(selection.values.find(({ field }) => field === "note")?.value).toHaveLength(1000);
    expect(selection.title).toBe("Wyoming");
  });

  it("does not promote serialized nulls into a selection title", () => {
    const selection = mapFeatureSelectionFromDatum({
      state_name: "null",
      land_use: "Grass + range",
      acres_per_tile: 1450,
    }, { x: 40, y: 70 })!;

    expect(selection.title).toBe("Grass + range");
    expect(selection.values.map(({ value }) => value)).not.toContain("null");
  });

  it("hydrates map clicks from the rendered relation and combines multi-selection rows", () => {
    const first = mapFeatureSelectionFromDatum(
      { __ggsql_row_index__: "1", geometry: new Uint8Array([1]) },
      { x: 100, y: 120 },
      { columns: ["county_name", "population"], rows: [["Cook County", "5,182,617"], ["Teton County", "24,000"]] },
    )!;
    const second = mapFeatureSelectionFromDatum(
      { county_name: "Albany County", population: 38_000 },
      { x: 180, y: 90 },
    )!;

    expect(first).toMatchObject({ key: "row:1", title: "Teton County", rowIndex: 1 });
    expect(tableFromMapFeatureSelections([first, second])).toMatchObject({
      columns: ["county_name", "population"],
      rows: [["Teton County", "24,000"], ["Albany County", "38,000"]],
      totalRows: 2,
    });
  });

  it("turns ordinary chart marks into persisted row context", () => {
    expect(visualItemSelectionFromDatum(
      { __ggsql_row_index__: 0, Cycles: 1200, Footprint: 480 },
      { x: 220, y: 140 },
      { columns: ["PID", "Cycles", "Footprint"], rows: [["42", "1200", "480"]] },
    )).toMatchObject({
      key: "row:0",
      title: "PID 42 · Cycles 1200",
      pixels: { x: 220, y: 140 },
      values: [
        { field: "PID", value: "42" },
        { field: "Cycles", value: "1200" },
        { field: "Footprint", value: "480" },
      ],
    });
  });

  it("adds computed query aliases to the visual builder fields", () => {
    const fields = visualFieldsFromPreview(
      [{ name: "geometry", dataType: "GEOMETRY", nullable: false, semanticType: "geometry" }],
      {
        columns: ["geometry", "population_change", "label_date"],
        rows: [["[geometry]", "4.25", "2025-07-01"]],
        totalRows: 1,
        offset: 0,
        limit: 100,
      },
    );
    expect(fields.find((field) => field.name === "population_change")).toMatchObject({ dataType: "DOUBLE", semanticType: "measure" });
    expect(fields.find((field) => field.name === "label_date")).toMatchObject({ dataType: "DATE", semanticType: "temporal" });
  });

  it("offers only SQL projection fields to the visual builder", () => {
    const fields = visualFieldsFromPreview(
      [
        { name: "end_date", dataType: "DATE", nullable: false, semanticType: "temporal" },
        { name: "approve", dataType: "DOUBLE", nullable: false, semanticType: "measure" },
        { name: "disapprove", dataType: "DOUBLE", nullable: false, semanticType: "measure" },
      ],
      {
        columns: ["end_date", "approve", "net"],
        rows: [["2025-01-01", "47", "-3"]],
        totalRows: 1,
        offset: 0,
        limit: 100,
      },
      ["end_date", "net"],
    );
    expect(fields.map((field) => field.name)).toEqual(["end_date", "net"]);
    expect(fields[1]).toMatchObject({ dataType: "DOUBLE", semanticType: "measure" });
  });

  it("counts data points inside a reversed brush range", () => {
    const result = describeChartSelection(
      { x: [3, 1], y: [30, 10] },
      { columns: ["x", "y"], rows: [["1", "10"], ["2", "20"], ["4", "40"]], totalRows: 3, offset: 0, limit: 3 },
      "x",
      "y",
      [],
      "Horizontal",
      "Vertical",
    );
    expect(result.rows).toHaveLength(2);
    expect(result.summary).toContain("2 data points selected");
  });
});

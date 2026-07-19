import { describe, expect, it } from "vitest";
import { centeredDomain, describeChartSelection, presentationFromSpec, previewFromSpec, visualFieldsFromPreview } from "./chart-data";

describe("chart workspace data", () => {
  it("zooms numeric and temporal domains around their center", () => {
    expect(centeredDomain([0, 100], 0.5)).toEqual([25, 75]);
    expect(centeredDomain(["2026-01-01", "2026-01-11"], 0.5)).toEqual([
      "2026-01-03T12:00:00.000Z",
      "2026-01-08T12:00:00.000Z",
    ]);
  });

  it("extracts presentation and user columns without GGSQL bookkeeping", () => {
    const spec = {
      title: { text: "approval", subtitle: ["daily", "average"] },
      data: { values: [{ date: "2026-01-01", value: 48, __ggsql_row_index__: 0, geometry: {} }] },
    };
    expect(presentationFromSpec(spec)).toEqual({ title: "approval", subtitle: "daily average" });
    expect(previewFromSpec(spec).columns).toEqual(["date", "value"]);
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

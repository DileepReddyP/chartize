import { describe, expect, it } from "vitest";
import { presentChartSpec } from "./vega-presentation";

describe("Chartize Vega presentation", () => {
  it("removes the engine title and applies explicit exploration domains", () => {
    const spec = presentChartSpec({
      title: "engine title",
      mark: "line",
      encoding: {
        x: { field: "date", type: "temporal" },
        y: { field: "approve", title: "Approval", scale: { domain: [40, 60] } },
      },
    }, undefined, { x: ["2026-01-01", "2026-02-01"] });
    expect(spec.title).toBeUndefined();
    expect((spec.encoding as { x: { scale: { domain: unknown[] } } }).x.scale.domain).toEqual(["2026-01-01", "2026-02-01"]);
  });

  it("colors a single approval line red below 50 and teal above it", () => {
    const spec = presentChartSpec({
      mark: "line",
      encoding: { y: { field: "approve", title: "Approval", scale: { domain: [40, 60] } } },
    }, { fieldTitles: ["Approval"], value: 50, below: "#ee4266", above: "#147d76" });
    const stroke = (spec.encoding as { stroke: { value: { stops: Array<{ color: string }> } } }).stroke;
    expect(stroke.value.stops.map(({ color }) => color)).toEqual(["#ee4266", "#ee4266", "#147d76", "#147d76"]);
  });

  it("removes a duplicate text stroke that makes dense labels illegible", () => {
    const spec = presentChartSpec({
      layer: [{
        encoding: {
          fill: { value: "#1a1a1a" },
          stroke: { value: "#1a1a1a" },
          text: { field: "label" },
        },
        layer: [{ mark: { type: "text" } }],
      }],
    });
    const layer = (spec.layer as Array<{ encoding: { stroke: { value: unknown } } }>)[0]!;
    expect(layer.encoding.stroke.value).toBeNull();
  });

  it("centers a red-yellow-green scale on zero for signed map values", () => {
    const spec = presentChartSpec({
      mark: "rect",
      encoding: {
        fill: {
          field: "change",
          scale: { domain: [-100, 2_000], range: ["#a50026", "#ffffbf", "#006837"] },
        },
      },
    });
    expect((spec.encoding as { fill: { scale: { domainMid: number } } }).fill.scale.domainMid).toBe(0);
  });

  it("preserves GGSQL's projected camera so text and geoshapes share one translation", () => {
    const projection = {
      type: "identity",
      reflectY: true,
      scale: { expr: "min(width / 100, height / 100)" },
      translate: { expr: "[width / 2, height / 2]" },
    };
    const spec = presentChartSpec({
      data: { values: [
        { geometry: { type: "Polygon", coordinates: [[[1_000, 1_000], [1_200, 1_000], [1_200, 1_200], [1_000, 1_000]]] } },
        { label_x: 1_100, label_y: 1_100, label: "A" },
      ] },
      projection,
      layer: [
        { description: "background", mark: "geoshape" },
        { mark: "geoshape", encoding: { shape: { field: "geometry" } } },
        { mark: "text", encoding: { longitude: { field: "label_x" }, latitude: { field: "label_y" }, text: { field: "label" } } },
      ],
    });
    expect(spec.projection).toEqual(projection);
    expect(spec.layer).toHaveLength(2);
  });
});

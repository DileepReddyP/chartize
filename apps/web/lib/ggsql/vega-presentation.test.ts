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
});

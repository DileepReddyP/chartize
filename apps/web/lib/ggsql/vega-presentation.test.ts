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
    expect((spec.config as { axis: Record<string, unknown> }).axis).toMatchObject({ labelLimit: 130, labelOverlap: "greedy", labelSeparation: 8 });
  });

  it("colors a single approval line red below 50 and teal above it", () => {
    const spec = presentChartSpec({
      mark: "line",
      encoding: { y: { field: "approve", title: "Approval", scale: { domain: [40, 60] } } },
    }, { fieldTitles: ["approve", "Approval"], value: 50, below: "#ee4266", above: "#147d76" });
    const stroke = (spec.encoding as { stroke: { value: { stops: Array<{ color: string }> } } }).stroke;
    expect(stroke.value.stops.map(({ color }) => color)).toEqual(["#ee4266", "#ee4266", "#147d76", "#147d76"]);
  });

  it("preserves explicit colours and does not threshold derived approval scenarios", () => {
    const threshold = { fieldTitles: ["approve", "Approval"], value: 50, below: "#ee4266", above: "#147d76" };
    const spec = presentChartSpec({
      layer: [
        {
          mark: "line",
          encoding: {
            y: { field: "approve", title: "Approval", scale: { domain: [35, 55] } },
            stroke: { value: "#173f5f" },
          },
        },
        {
          mark: "line",
          encoding: {
            y: { field: "approve_plus_3", title: "Approval", scale: { domain: [35, 55] } },
            stroke: { value: "#16877d" },
          },
        },
      ],
    }, threshold);
    const layers = spec.layer as Array<{ encoding: { stroke: { value: string } } }>;

    expect(layers[0]?.encoding.stroke.value).toBe("#173f5f");
    expect(layers[1]?.encoding.stroke.value).toBe("#16877d");
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
    expect((layer.encoding as unknown as { text: { type: string } }).text.type).toBe("nominal");
  });

  it("applies GGSQL aesthetic labels to generic engine legend titles", () => {
    const spec = presentChartSpec({
      layer: [{
        mark: "line",
        encoding: {
          stroke: { field: "__ggsql_aes_stroke__", title: "stroke", type: "nominal" },
          size: { field: "__ggsql_aes_size__", title: "size", type: "quantitative" },
        },
      }],
    }, undefined, undefined, undefined, { colour: "Rating", size: "Sample size" });
    const layer = (spec.layer as Array<{ encoding: { stroke: { title: string }; size: { title: string } } }>)[0]!;
    expect(layer.encoding.stroke.title).toBe("Rating");
    expect(layer.encoding.size.title).toBe("Sample size");
  });

  it("replaces a map linewidth legend with an exportable tapered key", () => {
    const spec = presentChartSpec({
      data: { values: [{ geometry: { type: "LineString", coordinates: [[-74, 40], [-73, 41]] }, riders: null }, { geometry: { type: "LineString", coordinates: [[-74, 40], [-73, 41]] }, riders: 22 }, { geometry: { type: "LineString", coordinates: [[-74, 40], [-73, 41]] }, riders: 75 }] },
      projection: { type: "mercator" },
      layer: [{
        mark: "geoshape",
        encoding: {
          shape: { field: "geometry", type: "geojson" },
          strokeWidth: { field: "riders", title: "linewidth", type: "quantitative" },
        },
      }],
    }, undefined, undefined, undefined, { linewidth: "Peak riders (M)" });
    const layers = spec.layer as Array<{ description?: string; encoding?: { strokeWidth?: { title: string; legend: unknown } } }>;
    const linewidth = layers[0]!.encoding!.strokeWidth!;

    expect(linewidth.title).toBe("Peak riders (M)");
    expect(linewidth.legend).toBeNull();
    expect(layers.some(({ description }) => description === "tapered linewidth legend")).toBe(true);
    expect(layers.some(({ description }) => description === "linewidth legend values")).toBe(true);
    expect(layers.some(({ description }) => description === "linewidth legend background")).toBe(false);
    const labels = layers.find(({ description }) => description === "linewidth legend values") as unknown as { data: { values: Array<{ __ggsql_legend_label__: string }> } };
    expect(labels.data.values.map(({ __ggsql_legend_label__ }) => __ggsql_legend_label__)).toEqual(["22", "75"]);
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

  it("hides an axis when GGSQL explicitly labels it null", () => {
    const spec = presentChartSpec({
      mark: "rect",
      encoding: {
        x: { field: "grid_x", title: null, axis: { grid: true } },
        y: { field: "grid_y", title: null, axis: { grid: true } },
      },
    });
    expect((spec.encoding as { x: { axis: unknown }; y: { axis: unknown } }).x.axis).toBeNull();
    expect((spec.encoding as { x: { axis: unknown }; y: { axis: unknown } }).y.axis).toBeNull();
  });

  it("repairs GGSQL log domains that begin at the smallest positive float", () => {
    const spec = presentChartSpec({
      data: { values: [
        { x: 1_983, y: 66 },
        { x: 20_481, y: 79 },
        { x: 136_500, y: 84 },
      ] },
      mark: "point",
      encoding: {
        x: {
          field: "x",
          type: "quantitative",
          axis: { values: [5e-308, 1e-47, 100_000], labelExpr: "broken generated labels" },
          scale: { type: "log", domain: [Number.MIN_VALUE, 136_500], zero: false },
        },
        y: { field: "y", type: "quantitative" },
      },
    });
    const x = (spec.encoding as { x: { axis: Record<string, unknown>; scale: { domain: number[]; nice: boolean } } }).x;
    expect(x.scale.domain).toEqual([1_983, 136_500]);
    expect(x.scale.nice).toBe(false);
    expect(x.axis.values).toBeUndefined();
    expect(x.axis.labelExpr).toBeUndefined();
    expect(x.axis.format).toBe("~s");
  });

  it("removes excessive empty space from an inferred logarithmic domain", () => {
    const spec = presentChartSpec({
      data: { values: [{ income: 2_000 }, { income: 136_500 }] },
      mark: "point",
      encoding: { x: { field: "income", scale: { type: "log", domain: [1_000, 1_000_000] } } },
    });
    expect((spec.encoding as { x: { scale: { domain: number[] } } }).x.scale.domain).toEqual([1_000, 136_500]);
  });

  it("repairs a nonnumeric logarithmic domain from its inline values", () => {
    const spec = presentChartSpec({
      data: { values: [{ income: 2_000 }, { income: 136_500 }] },
      mark: "point",
      encoding: { x: { field: "income", scale: { type: "log", domain: ["minimum", "maximum"] } } },
    });
    expect((spec.encoding as { x: { scale: { domain: number[] } } }).x.scale.domain).toEqual([2_000, 136_500]);
  });

  it("formats million-scale quantitative legends without generated raw-number labels", () => {
    const spec = presentChartSpec({
      data: { values: [{ population: 1_000_000 }, { population: 8_000_000_000 }] },
      mark: "point",
      encoding: {
        size: { field: "population", legend: { labelExpr: "datum.label", values: [1_000_000, 8_000_000_000] } },
      },
    });
    const legend = (spec.encoding as { size: { legend: Record<string, unknown> } }).size.legend;
    expect(legend.format).toBe("~s");
    expect(legend.labelExpr).toBeUndefined();
  });

  it("keeps dense discrete time axes readable", () => {
    const years = Array.from({ length: 86 }, (_entry, index) => String(1940 + index));
    const spec = presentChartSpec({
      data: { values: years.map((year) => ({ year, anomaly: 0 })) },
      mark: "bar",
      encoding: { x: { field: "year", type: "nominal", axis: { labelAngle: -90 } }, y: { field: "anomaly" } },
    });
    const axis = (spec.encoding as { x: { axis: { values: string[]; labelAngle: number } } }).x.axis;
    expect(axis.labelAngle).toBe(0);
    expect(axis.values.length).toBeLessThanOrEqual(11);
    expect(axis.values.at(-1)).toBe("2025");
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

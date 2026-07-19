import { describe, expect, it } from "vitest";
import { applyMapViewport, geometryFeatureCollection, geometryUsesLongitudeLatitude, robustGeometryFit, robustPlanarGeometryFit } from "./geo-fit";

type TestGeometry = { type: string; coordinates: number[][][] };
type TestFeature = { geometry: TestGeometry };

function feature(longitude: number, latitude = 40): TestFeature {
  return {
    geometry: {
      type: "Polygon",
      coordinates: [[
        [longitude, latitude],
        [longitude + 0.2, latitude],
        [longitude + 0.2, latitude + 0.2],
        [longitude, latitude],
      ]],
    },
  };
}

describe("geometry projection fitting", () => {
  it("distinguishes raw GeoJSON from coordinates already projected by GGSQL", () => {
    expect(geometryUsesLongitudeLatitude([feature(-77, 39)])).toBe(true);
    expect(geometryUsesLongitudeLatitude([feature(-6_684_860, 6_872_101)])).toBe(false);
    expect(geometryUsesLongitudeLatitude([{ value: 1 }])).toBe(false);
  });

  it("fits to the dense geography while leaving remote features in the data", () => {
    const mainland = Array.from({ length: 99 }, (_, index) => feature(-124 + index * 0.5));
    const remote = feature(145);
    const fit = robustGeometryFit([...mainland, remote]);
    expect(fit?.features.length).toBe(94);
    expect([...mainland, remote]).toHaveLength(100);
  });

  it("fits already-projected maps to their dense feature cluster", () => {
    const mainland = Array.from({ length: 99 }, (_, index) => feature(-6_000_000 + index * 10_000, 8_000_000));
    const remote = feature(6_000_000, 14_000_000);
    const fit = robustPlanarGeometryFit([...mainland, remote]);
    expect(fit?.features).toHaveLength(94);
    expect(fit?.features.some((item) => (item.geometry as TestGeometry).coordinates[0]![0]![0]! > 0)).toBe(false);
  });

  it("applies viewport movement without changing the fit geometry", () => {
    const values = [feature(-100, 40), feature(-90, 45)];
    const focus = geometryFeatureCollection(values);
    const moved = applyMapViewport(values, focus, { zoom: 2, panX: 0.1, panY: 0 });
    expect(moved).not.toBe(values);
    expect((moved[0]!.geometry as TestGeometry).coordinates[0]![0]![0]).toBeLessThan(-100);
    expect((focus.features[0]!.geometry as TestGeometry).coordinates[0]![0]![0]).toBe(-100);
  });
});

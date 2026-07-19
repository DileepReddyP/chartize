import { describe, expect, it } from "vitest";
import { geojsonGeometryToWkb } from "./wkb";

describe("geojsonGeometryToWkb", () => {
  it("encodes a little-endian point", () => {
    const wkb = geojsonGeometryToWkb({ type: "Point", coordinates: [-77, 39] });
    expect(wkb.byteLength).toBe(21);
    expect(wkb[0]).toBe(1);
    expect(new DataView(wkb.buffer).getUint32(1, true)).toBe(1);
    expect(new DataView(wkb.buffer).getFloat64(5, true)).toBe(-77);
  });

  it("encodes polygon rings", () => {
    const wkb = geojsonGeometryToWkb({
      type: "Polygon",
      coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]],
    });
    expect(new DataView(wkb.buffer).getUint32(1, true)).toBe(3);
    expect(new DataView(wkb.buffer).getUint32(5, true)).toBe(1);
  });
});


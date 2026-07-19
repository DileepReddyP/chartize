import { describe, expect, it } from "vitest";
import type { FeatureCollection } from "geojson";
import { geojsonToParquet, rowsToParquet } from "./parquet";

describe("browser parquet conversion", () => {
  it("writes ordinary JSON rows", () => {
    const bytes = rowsToParquet([{ county: "Ada", population: 5321 }, { county: "Benton", population: 9812 }]);
    expect(new TextDecoder().decode(bytes.slice(0, 4))).toBe("PAR1");
  });

  it("writes GeoJSON properties and WKB geometry", () => {
    const converted = geojsonToParquet({
      type: "FeatureCollection",
      features: [{ type: "Feature", properties: { fips: "001", value: 12 }, geometry: { type: "Point", coordinates: [-77, 39] } }],
    } as FeatureCollection);
    expect(converted.rowCount).toBe(1);
    expect(converted.fields).toEqual(["fips", "value", "geometry"]);
    expect(new TextDecoder().decode(converted.bytes.slice(0, 4))).toBe("PAR1");
  });
});

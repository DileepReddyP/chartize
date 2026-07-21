import { describe, expect, it } from "vitest";
import { displayGridCell } from "./data-grid";

describe("displayGridCell", () => {
  it("keeps geometry payloads out of the rendered table", () => {
    expect(displayGridCell("geometry", "01030000".repeat(10_000))).toBe("geometry");
    expect(displayGridCell("county_wkb", "deadbeef")).toBe("geometry");
  });

  it("bounds unusually long values without changing ordinary cells", () => {
    expect(displayGridCell("county", "Teton County")).toBe("Teton County");
    expect(displayGridCell("notes", "x".repeat(1_000))).toHaveLength(180);
  });
});

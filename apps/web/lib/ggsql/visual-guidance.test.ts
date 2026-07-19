import { describe, expect, it } from "vitest";
import { visualPointState } from "./query-context";
import { fieldsForAesthetic, guidanceForMark, patchForMark } from "./visual-guidance";

const fields = [
  { name: "end_date", dataType: "DATE", nullable: false, semanticType: "temporal" as const },
  { name: "approve", dataType: "DOUBLE", nullable: false, semanticType: "measure" as const },
  { name: "disapprove", dataType: "DOUBLE", nullable: false, semanticType: "measure" as const },
  { name: "party", dataType: "VARCHAR", nullable: false, semanticType: "dimension" as const },
  { name: "geometry", dataType: "GEOMETRY", nullable: false, semanticType: "geometry" as const },
];

const visual = visualPointState(`SELECT "end_date", "approve", "disapprove" FROM chartize:polls

VISUALISE
DRAW line MAPPING "end_date" AS x, "approve" AS y
SCALE x VIA date`);

describe("visual builder guidance", () => {
  it("filters statistical and spatial channels by field type", () => {
    expect(fieldsForAesthetic(fields, "x", "histogram").map((field) => field.name)).toEqual(["approve", "disapprove"]);
    expect(fieldsForAesthetic(fields, "geometry", "spatial").map((field) => field.name)).toEqual(["geometry"]);
    expect(fieldsForAesthetic(fields, "facet", "bar").map((field) => field.name)).toEqual(["end_date", "party"]);
  });

  it("repairs a date histogram to a numeric distribution", () => {
    const patch = patchForMark("histogram", visual, fields);
    expect(patch).toMatchObject({ mark: "histogram", x: "approve", y: "", scaleXTransform: "" });
    expect(guidanceForMark("histogram", { ...visual, mark: "histogram" }, fields)).toMatchObject({ tone: "attention" });
  });

  it("suggests complete channels for spatial and ribbon marks", () => {
    expect(patchForMark("spatial", visual, fields)).toMatchObject({ geometry: "geometry", x: "", y: "" });
    expect(patchForMark("ribbon", visual, fields)).toMatchObject({ x: "end_date", yMin: "approve", yMax: "disapprove" });
  });
});

import { describe, expect, it } from "vitest";
import { GgsqlDraftSchema } from "./index";

describe("GgsqlDraftSchema", () => {
  it("fills safe defaults", () => {
    const draft = GgsqlDraftSchema.parse({
      source: "penguins",
      layers: [{ mark: "point" }],
    });
    expect(draft.limit).toBe(5000);
    expect(draft.layers[0]?.opacity).toBe(0.9);
    expect(draft.scales).toEqual([]);
    expect(draft.axisLabels.x).toBe("");
  });
});

import { describe, expect, it } from "vitest";
import { createVisualizationFunctionTools } from "./workspace-tools";

describe("createVisualizationFunctionTools", () => {
  it("keeps server-side tools limited to the drawing cookbook", () => {
    const tools = createVisualizationFunctionTools();
    expect(tools.map((tool) => tool.name)).toEqual(["get_visualization_tips"]);
  });

  it("provides the drawing cookbook without a data-service dependency", async () => {
    const cookbook = createVisualizationFunctionTools().find((tool) => tool.name === "get_visualization_tips");

    expect(cookbook).toBeDefined();
    await expect(cookbook?.execute({ topics: ["endpoint-labels", "layered-series"] })).resolves.toMatchObject({
      reference: "Chartize cookbook for GGSQL 0.4.1",
      tips: [
        { topic: "endpoint-labels" },
        { topic: "layered-series" },
      ],
    });
  });

  it("teaches endpoint labels as a one-row-per-series invariant", async () => {
    const [cookbook] = createVisualizationFunctionTools();
    const result = await cookbook?.execute({ topics: ["endpoint-labels"] });
    const serialized = JSON.stringify(result);

    expect(serialized).toContain("COUNT_IF(endpoint_label IS NOT NULL) = 1");
    expect(serialized).toContain("CASE WHEN date_field = last_date");
    expect(serialized).toContain("endpoint_x AS x");
  });
});

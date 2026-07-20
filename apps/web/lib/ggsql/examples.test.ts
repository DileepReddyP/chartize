import { describe, expect, it } from "vitest";
import { EXAMPLE_CATEGORIES, VISUALIZATION_EXAMPLES } from "./examples";

describe("visualization examples", () => {
  it("keeps every example unique and complete", () => {
    expect(new Set(VISUALIZATION_EXAMPLES.map((example) => example.id)).size).toBe(VISUALIZATION_EXAMPLES.length);
    for (const example of VISUALIZATION_EXAMPLES) {
      expect(example.query).toContain("VISUALISE");
      expect(example.query).toMatch(/\bDRAW\b/);
    }
  });

  it("includes maps, uncertainty, regression, scenarios, and heatmaps", () => {
    const tags = new Set(VISUALIZATION_EXAMPLES.flatMap((example) => example.tags));
    expect([...tags]).toEqual(expect.arrayContaining(["map", "ribbon", "regression", "scenario", "tile"]));
  });

  it("keeps every visible category named and populated", () => {
    for (const category of EXAMPLE_CATEGORIES) {
      expect(category.title.trim()).not.toBe("");
      expect(category.description.trim()).not.toBe("");
      expect(VISUALIZATION_EXAMPLES.some((example) => example.category === category.id)).toBe(true);
    }
  });

  it("centers contiguous-U.S. Albers examples on the data", () => {
    const usMaps = VISUALIZATION_EXAMPLES.filter((example) => example.source === "chartize:us_counties_2025");
    expect(usMaps.length).toBeGreaterThan(0);
    for (const example of usMaps) {
      expect(example.query).toContain("PROJECT TO albers");
      expect(example.query).toContain("SETTING origin => (-96, 37.5), parallel => (29.5, 45.5)");
    }
  });

  it("uses semantically stable colors for signed change and political series", () => {
    const signedChangeExamples = VISUALIZATION_EXAMPLES.filter((example) =>
      ["county-change-map", "county-real-gdp-change-map"].includes(example.id),
    );
    for (const example of signedChangeExamples) {
      expect(example.query).toContain("SCALE CONTINUOUS fill TO RdYlGn");
      expect(example.query).toContain("red decline");
      expect(example.query).toContain("green growth");
      expect(example.query).not.toContain("TO vik");
    }

    const genericBallot = VISUALIZATION_EXAMPLES.find((example) => example.id === "generic-ballot-bands");
    expect(genericBallot?.query).toContain("colour => '#3976c6'");
    expect(genericBallot?.query).toContain("colour => '#d34d5f'");

    const approval = VISUALIZATION_EXAMPLES.find((example) => example.id === "approval-uncertainty");
    expect(approval?.query).toContain("colour => '#16877d'");
    expect(approval?.query).toContain("colour => '#c44e52'");
  });

  it("labels analytical overlays as descriptive rather than causal", () => {
    const linkedModels = VISUALIZATION_EXAMPLES.filter((example) =>
      ["population-obesity-link", "income-obesity-link"].includes(example.id),
    );
    for (const example of linkedModels) {
      expect(example.query.toLowerCase()).toContain("descriptive");
      expect(example.query.toLowerCase()).toContain("not causal");
    }
  });

  it("ships bounded official-source examples for transit, weather, and land use", () => {
    expect(VISUALIZATION_EXAMPLES.map((example) => example.source)).toEqual(expect.arrayContaining([
      "chartize:mta_subway_service_lines",
      "chartize:mta_subway_journey_metrics_2024_2025",
      "chartize:mta_subway_stations",
      "chartize:nyc_central_park_weather_2024_2025",
      "chartize:usda_major_land_uses",
    ]));
    expect(VISUALIZATION_EXAMPLES.find((example) => example.id === "mta-route-delay-map")?.query)
      .toContain("SUM(\"num_passengers\" *");
    expect(VISUALIZATION_EXAMPLES.find((example) => example.id === "us-land-use-square")?.query)
      .toContain("ROW_NUMBER() OVER () - 1");
  });
});

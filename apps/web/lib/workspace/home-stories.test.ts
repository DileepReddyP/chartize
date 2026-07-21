import { describe, expect, it } from "vitest";
import { VISUALIZATION_EXAMPLES } from "../ggsql/examples";
import { HOME_STORIES, homeStoryForExample } from "./home-stories";

describe("homepage example handoff", () => {
  it("only points at examples that Explorer can reconstruct", () => {
    const exampleIds = new Set(VISUALIZATION_EXAMPLES.map((example) => example.id));
    expect(HOME_STORIES.every((story) => exampleIds.has(story.id))).toBe(true);
  });

  it("uses an allowlisted story for an untrusted URL id", () => {
    expect(homeStoryForExample("approval-uncertainty")?.ask).toContain("presidential approval");
    expect(homeStoryForExample("../../not-an-example")).toBeUndefined();
    expect(homeStoryForExample(null)).toBeUndefined();
  });

  it("promotes the weather calendar and pairs both land-use views", () => {
    expect(HOME_STORIES.slice(0, 3).map((story) => story.id)).toEqual([
      "approval-uncertainty",
      "mta-route-delay-map",
      "june-temperature-heatmap",
    ]);
    const landStories = HOME_STORIES.filter((story) => story.id.startsWith("us-land-use-"));
    expect(landStories.map((story) => story.id)).toEqual(["us-land-use-square", "us-land-use-shares"]);
    expect(landStories.reduce((columns, story) => columns + story.columns, 0)).toBe(12);
  });

  it("gives every card its own opening Chartize question", () => {
    const questions = HOME_STORIES.map((story) => story.ask.trim());
    expect(questions.every(Boolean)).toBe(true);
    expect(new Set(questions).size).toBe(HOME_STORIES.length);
  });
});

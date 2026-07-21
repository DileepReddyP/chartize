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
});

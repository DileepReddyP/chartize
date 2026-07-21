import { DEFAULT_AI_RESPONSE_PREFERENCES, type AiTurnEnvelope } from "@chartize/contracts";
import { describe, expect, it } from "vitest";
import { authorizesLocalChange } from "./local-change-policy";

function turn(overrides: Partial<AiTurnEnvelope> = {}) {
  return {
    task: "generate" as const,
    request: "Show me a preview of possible cleanup steps.",
    history: [],
    preferences: DEFAULT_AI_RESPONSE_PREFERENCES,
    ...overrides,
  };
}

describe("local-change authorization", () => {
  it("requires an explicit request or one-send setting", () => {
    expect(authorizesLocalChange(turn())).toBe(false);
    expect(authorizesLocalChange(turn({
      preferences: { ...DEFAULT_AI_RESPONSE_PREFERENCES, allowLocalChanges: true },
    }))).toBe(true);
    expect(authorizesLocalChange(turn({ request: "Apply the cleanup to a local copy." }))).toBe(true);
  });

  it("respects a request to preview without modifying data", () => {
    expect(authorizesLocalChange(turn({
      request: "Clean this dataset, but do not modify or persist anything.",
    }))).toBe(false);
  });

  it("recognizes approval of a previously proposed cleanup", () => {
    expect(authorizesLocalChange(turn({
      request: "go ahead",
      history: [{ role: "user", text: "Save a cleaned copy of this dataset." }],
    }))).toBe(true);
  });

  it("never carries write authority into an automatic repair round", () => {
    expect(authorizesLocalChange(turn({
      task: "repair",
      request: "Repair the generated query.",
      preferences: { ...DEFAULT_AI_RESPONSE_PREFERENCES, allowLocalChanges: true },
    }))).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { createInitialResponseInput } from "./provider-request";

describe("Chartize Responses request policy", () => {
  it("places one explicit cache boundary after stable instructions", () => {
    const input = createInitialResponseInput({
      stableInstructions: "stable role and tools policy",
      turnInstructions: "dynamic workspace policy",
      input: [{ role: "user", content: "latest request" }],
      explicitPromptCache: true,
    });
    expect(input[0]).toMatchObject({
      role: "developer",
      content: [{
        text: "stable role and tools policy",
        prompt_cache_breakpoint: { mode: "explicit" },
      }],
    });
    expect(input[1]).toMatchObject({ role: "developer", content: "dynamic workspace policy" });
  });

});

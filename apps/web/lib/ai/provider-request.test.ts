import { describe, expect, it } from "vitest";
import { createInitialResponseInput, toolChoiceForRound } from "./provider-request";

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

  it("replays short-lived provider state after the refreshed workspace snapshot", () => {
    const input = createInitialResponseInput({
      stableInstructions: "stable",
      turnInstructions: "dynamic",
      input: [{ role: "user", content: "current workspace snapshot" }],
      continuationInput: [
        { id: "reasoning_1", type: "reasoning", summary: [], encrypted_content: "opaque" },
        { role: "user", content: "browser data results" },
      ],
      explicitPromptCache: true,
    });
    expect(input.slice(2)).toEqual([
      { role: "user", content: "current workspace snapshot" },
      { id: "reasoning_1", type: "reasoning", summary: [], encrypted_content: "opaque" },
      { role: "user", content: "browser data results" },
    ]);
  });

  it("keeps tool definitions separate from per-round permissions", () => {
    expect(toolChoiceForRound({
      functionNames: ["get_visualization_tips"],
      allowFunctionTools: true,
      allowWebSearch: false,
      requireWebSearch: false,
    })).toMatchObject({ mode: "auto", tools: [{ type: "function", name: "get_visualization_tips" }] });
    expect(toolChoiceForRound({
      functionNames: ["get_visualization_tips"],
      allowFunctionTools: true,
      allowWebSearch: true,
      requireWebSearch: true,
    })).toEqual({ type: "allowed_tools", mode: "required", tools: [{ type: "web_search" }] });
    expect(toolChoiceForRound({
      functionNames: ["get_visualization_tips"],
      allowFunctionTools: false,
      allowWebSearch: false,
      requireWebSearch: false,
    })).toBe("none");
  });
});

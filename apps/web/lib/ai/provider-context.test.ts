import type { ResponseReasoningItem } from "openai/resources/responses/responses";
import { describe, expect, it } from "vitest";
import { nextProviderContext, providerContinuation } from "./provider-context";

const result = {
  sql: "SELECT AVG(value) AS average_value FROM data",
  purpose: "Calculate the average",
  columns: ["average_value"],
  rows: [["42"]],
  returnedRows: 1,
  truncated: false,
};

describe("stateless provider context", () => {
  it("adds each new browser result after preserved reasoning exactly once", () => {
    const existing = {
      items: [{ id: "reasoning_1", type: "reasoning" as const, summary: [], encrypted_content: "opaque" }],
      consumedWorkspaceResults: 0,
    };
    const first = providerContinuation(existing, [result]);
    expect(first.context.items.map((item) => "type" in item ? item.type : item.role)).toEqual(["reasoning", "user"]);
    expect(first.context.consumedWorkspaceResults).toBe(1);
    expect(first.context.items[1]).toMatchObject({ role: "user" });

    const replay = providerContinuation(first.context, [result]);
    expect(replay.context.items).toHaveLength(2);
  });

  it("rejects a continuation that claims to have consumed unavailable results", () => {
    expect(() => providerContinuation({ items: [], consumedWorkspaceResults: 1 }, [])).toThrow("invalid browser-data continuation");
  });

  it("bounds and preserves encrypted reasoning for the next browser round", () => {
    const reasoning = {
      id: "reasoning_2",
      type: "reasoning",
      summary: [{ type: "summary_text", text: "continue the calculation" }],
      encrypted_content: "ciphertext",
      status: "completed",
    } as ResponseReasoningItem;
    const context = nextProviderContext({ items: [], consumedWorkspaceResults: 0 }, 0, [reasoning]);
    expect(context.items[0]).toMatchObject({
      id: "reasoning_2",
      type: "reasoning",
      encrypted_content: "ciphertext",
    });
  });
});

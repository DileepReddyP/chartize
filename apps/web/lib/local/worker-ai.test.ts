import { DEFAULT_AI_RESPONSE_PREFERENCES, type AiTurnRequest } from "@chartize/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./workspace-engine", () => ({
  executeWorkspaceSqlRaw: vi.fn(async () => ({
    columns: ["value"],
    rows: [["42"]],
    total_rows: 1,
    truncated: false,
  })),
}));

vi.mock("./worker-source-registry", () => ({
  prepareWorkerQuery: vi.fn(async (_workspaceId: string, sql: string) => sql),
}));

import { completeWorkerAiTurn } from "./worker-ai";

const usage = {
  models: ["gpt-5.6-luna"],
  calls: 1,
  inputTokens: 10,
  cachedInputTokens: 0,
  cacheWriteTokens: 0,
  outputTokens: 5,
  reasoningTokens: 0,
  totalTokens: 15,
};

function streamed(response: unknown) {
  return new Response(`${JSON.stringify({ type: "result", response })}\n`, {
    status: 200,
    headers: { "content-type": "application/x-ndjson; charset=utf-8" },
  });
}

describe("browser AI continuation", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns provider reasoning state with browser data on the next round", async () => {
    const bodies: unknown[] = [];
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      bodies.push(JSON.parse(String(init?.body)));
      if (bodies.length === 1) {
        return streamed({
          kind: "data_request",
          requests: [{ sql: "SELECT 42 AS value", purpose: "Check the exact value", limit: 10 }],
          providerContext: {
            items: [{ id: "reasoning_1", type: "reasoning", summary: [], encrypted_content: "opaque" }],
            consumedWorkspaceResults: 0,
          },
          usage,
        });
      }
      return streamed({
        kind: "explanation",
        explanation: "The exact value is 42.",
        assumptions: [],
        warnings: [],
        sources: [],
        researched: false,
        workspaceActions: [],
        usage,
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const input: AiTurnRequest = {
      task: "explain",
      context: "data",
      contextNote: "Selected value",
      request: "What is the exact value?",
      currentQuery: "SELECT 42 AS value",
      queryStatus: "rendered",
      schema: [{ name: "value", dataType: "INTEGER", nullable: false }],
      availableSources: [],
      view: { title: "Value", subtitle: "", sources: [] },
      preferences: DEFAULT_AI_RESPONSE_PREFERENCES,
      history: [],
      runtimeErrors: [],
    };
    const result = await completeWorkerAiTurn("workspace-test", input, "request-test", vi.fn());

    expect(result.kind).toBe("explanation");
    expect(result.usage.calls).toBe(2);
    expect(bodies[1]).toMatchObject({
      workspaceDataRound: 1,
      workspaceData: [{ purpose: "Check the exact value", rows: [["42"]] }],
      providerContext: {
        items: [{ type: "reasoning", encrypted_content: "opaque" }],
        consumedWorkspaceResults: 0,
      },
    });
  });
});

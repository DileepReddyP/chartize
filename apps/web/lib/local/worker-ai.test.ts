import { DEFAULT_AI_RESPONSE_PREFERENCES, type AiTurnRequest } from "@chartize/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./workspace-engine", () => ({
  executeWorkspaceReadOnlySqlRaw: vi.fn(async () => ({
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

  it("returns bounded browser data with an opaque continuation ID", async () => {
    const bodies: unknown[] = [];
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      bodies.push(JSON.parse(String(init?.body)));
      if (bodies.length === 1) {
        return streamed({
          kind: "data_request",
          requests: [{ sql: "SELECT 42 AS value", purpose: "Check the exact value", limit: 10 }],
          turnId: "89e8d452-c4be-4d12-af1c-772230109d04",
          includeSelection: false,
          plan: { summary: "Inspect the value", thinking: "medium", research: "none", queryData: true, shareSelection: false, localChanges: false, hypotheses: false, technical: false, challenge: false, concise: true, approval: null, question: "" },
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
    const profileId = "did:plc:profile-test";
    const result = await completeWorkerAiTurn("workspace-test", input, "request-test", vi.fn(), profileId);

    expect(result.kind).toBe("explanation");
    expect(result.usage.calls).toBe(2);
    for (const [, request] of fetchMock.mock.calls) expect(request?.headers).toMatchObject({ "x-chartize-profile": profileId });
    expect(bodies[1]).toMatchObject({
      turnId: "89e8d452-c4be-4d12-af1c-772230109d04",
      workspaceData: [{ purpose: "Check the exact value", rows: [["42"]] }],
    });
  });
});

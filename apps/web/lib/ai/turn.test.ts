import { beforeEach, describe, expect, it, vi } from "vitest";
import { AiTurnEnvelopeSchema, type AiTurnPlan } from "@chartize/contracts";
vi.mock("server-only", () => ({}));
vi.mock("./planner", () => ({ planAiTurn: vi.fn() }));
vi.mock("./provider", async (original) => ({ ...await original<typeof import("./provider")>(), structuredResponse: vi.fn() }));
import { planAiTurn } from "./planner";
import { structuredResponse } from "./provider";
import { completeAiTurn } from "./turn";

const usage = { models: ["test"], calls: 1, inputTokens: 10, cachedInputTokens: 0, cacheWriteTokens: 0, outputTokens: 5, reasoningTokens: 2, totalTokens: 15 };
const plan: AiTurnPlan = { summary: "Inspect the selected rows", thinking: "medium", research: "none", queryData: false, shareSelection: true, localChanges: false, hypotheses: false, technical: false, challenge: false, concise: true, approval: null, question: "" };
const body = AiTurnEnvelopeSchema.parse({ task: "explain", context: "data", contextNote: "Selected value", request: "What does this value mean?", currentQuery: "SELECT 42 AS value", schema: [], availableSources: [], view: { title: "Value", subtitle: "", sources: [] }, preferences: {}, selection: { columns: ["value"], rowCount: 1 }, history: [] });

describe("AI turn orchestration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(planAiTurn).mockResolvedValue({ plan, usage });
    vi.mocked(structuredResponse).mockResolvedValue({
      output: { action: "answer", explanation: "The selected value is 42.", query: "", dataRequests: [], includeSelection: false, workspaceActions: [], assumptions: [], warnings: [], citations: [] },
      sources: [], researched: false, continuationInput: [], usage,
    });
  });

  it("requests selected rows only after planning, binds the continuation to its caller, and consumes it once", async () => {
    const first = await completeAiTurn(body, { owner: "test-user" });
    expect(first.kind).toBe("data_request");
    expect(structuredResponse).not.toHaveBeenCalled();
    if (first.kind !== "data_request") throw new Error("Expected data request");
    const next = { ...body, turnId: first.turnId, sampleData: { columns: ["value"], rows: [["42"]] } };
    await expect(completeAiTurn(next, { owner: "another-user" })).rejects.toThrow("expired");
    const result = await completeAiTurn(next, { owner: "test-user" });
    expect(result.kind).toBe("explanation");
    expect(planAiTurn).toHaveBeenCalledTimes(1);
    const input = vi.mocked(structuredResponse).mock.calls[0]?.[0];
    expect(input?.resumeInput).toBeUndefined(); // First agent call still gets its stable system instructions.
    expect(JSON.stringify(input?.input)).toContain("42");
    await expect(completeAiTurn(next, { owner: "test-user" })).rejects.toThrow("expired");
  });

  it("asks a real permission question without running tools or sharing rows", async () => {
    vi.mocked(planAiTurn).mockResolvedValue({ plan: { ...plan, approval: "selected_data", question: "May I read these selected rows?" }, usage });
    const result = await completeAiTurn(body, { owner: "test-user" });
    expect(result).toMatchObject({ kind: "explanation", approval: "selected_data", workspaceActions: [] });
    expect(structuredResponse).not.toHaveBeenCalled();
  });

  it("revises the approach and preserves its spent web-search allowance across browser data rounds", async () => {
    vi.mocked(planAiTurn)
      .mockResolvedValueOnce({ plan: { ...plan, research: "wikipedia", shareSelection: false }, usage })
      .mockResolvedValueOnce({ plan: { ...plan, research: "web", thinking: "high", shareSelection: false, queryData: true }, usage });
    const answer = { output: { action: "answer", explanation: "Three rows match.", query: "", dataRequests: [], includeSelection: false, workspaceActions: [], assumptions: [], warnings: [], citations: [] }, sources: [], researched: false, continuationInput: [], usage };
    vi.mocked(structuredResponse).mockImplementationOnce(async (options) => {
      expect(options.policy?.().requiredTool).toBe("wikipedia");
      await options.functionTools?.find((tool) => tool.name === "reconsider_approach")?.execute({ gap: "The answer needs this morning's reporting and an exact local count." });
      expect(options.policy?.()).toMatchObject({ requiredTool: "web_search", thinking: "high", webSearch: true });
      options.onWebSearch?.();
      expect(options.policy?.().webSearch).toBe(false);
      return { ...answer, output: { ...answer.output, action: "request_data", dataRequests: [{ sql: "SELECT 3 AS count", purpose: "Count rows", limit: 1 }] } };
    }).mockImplementationOnce(async (options) => {
      expect(options.policy?.()).toMatchObject({ webSearch: false, thinking: "high" });
      return answer;
    });
    const first = await completeAiTurn(body, { owner: "replan-test" });
    if (first.kind !== "data_request") throw new Error("Expected data request");
    const result = await completeAiTurn({ ...body, turnId: first.turnId, workspaceData: [{ sql: "SELECT 3 AS count", purpose: "Count rows", columns: ["count"], rows: [["3"]], returnedRows: 1, truncated: false }] }, { owner: "replan-test" });
    expect(result).toMatchObject({ kind: "explanation", plan: { thinking: "high", research: "web" } });
    expect(planAiTurn).toHaveBeenCalledTimes(2);
  });
});

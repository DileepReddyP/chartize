import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AiTurnEnvelopeSchema } from "@chartize/contracts";
vi.mock("server-only", () => ({}));
vi.mock("./provider", async (original) => ({ ...await original<typeof import("./provider")>(), structuredResponse: vi.fn() }));
import { structuredResponse } from "./provider";
import { completeAiTurn } from "./turn";

const usage = { models: ["test"], calls: 1, inputTokens: 10, cachedInputTokens: 0, cacheWriteTokens: 0, outputTokens: 5, reasoningTokens: 2, totalTokens: 15 };
const body = AiTurnEnvelopeSchema.parse({ task: "explain", context: "data", contextNote: "Selected value", request: "What does this value mean?", currentQuery: "SELECT 42 AS value", schema: [], availableSources: [], view: { title: "Value", subtitle: "", sources: [] }, preferences: {}, selection: { columns: ["value"], rowCount: 1 }, history: [] });
const answer = {
  output: { action: "answer", explanation: "The selected value is 42.", approval: null, localChangesAuthorized: false, query: "", dataRequests: [], includeSelection: false, workspaceActions: [], assumptions: [], warnings: [], citations: [] },
  sources: [], researched: false, continuationInput: [], usage,
};

describe("AI turn orchestration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(structuredResponse).mockResolvedValue({ ...answer, continuationInput: [] });
  });
  afterEach(() => vi.unstubAllGlobals());

  it.each([false, true])("includes a retrieved Wikipedia source only when the answer cites it (%s)", async (cited) => {
    const source = { title: "New York City Subway", url: "https://en.wikipedia.org/wiki/New_York_City_Subway" };
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ query: { pages: [{ title: source.title, extract: "Retrieved article text." }] } })));
    vi.mocked(structuredResponse).mockImplementationOnce(async (options) => {
      await options.functionTools?.find((tool) => tool.name === "wikipedia_search")?.execute({ query: "New York City Subway" });
      return { ...answer, output: { ...answer.output, citations: ["https://unretrieved.example/article", ...(cited ? [`${source.url}#History`] : [])] } };
    });
    const result = await completeAiTurn(body, { owner: "citation-test" });
    expect(result.kind).toBe("explanation");
    if (result.kind !== "data_request") expect(result.sources).toEqual(cited ? [source] : []);
  });

  it("requests only relevant selected rows and consumes an owner-bound continuation once", async () => {
    vi.mocked(structuredResponse).mockResolvedValueOnce({
      ...answer, continuationInput: [{ role: "assistant", content: "Need the selected value." }],
      output: { ...answer.output, action: "request_data", includeSelection: true },
    });
    const first = await completeAiTurn(body, { owner: "test-user" });
    expect(first.kind).toBe("data_request");
    if (first.kind !== "data_request") throw new Error("Expected data request");
    const next = { ...body, turnId: first.turnId, sampleData: { columns: ["value"], rows: [["42"]] } };
    await expect(completeAiTurn(next, { owner: "another-user" })).rejects.toThrow("expired");
    const result = await completeAiTurn(next, { owner: "test-user" });
    expect(result.kind).toBe("explanation");
    expect(structuredResponse).toHaveBeenCalledTimes(2);
    const resumed = vi.mocked(structuredResponse).mock.calls[1]?.[0];
    expect(JSON.stringify(resumed?.resumeInput)).toContain("Need the selected value.");
    expect(JSON.stringify(resumed?.resumeInput)).toContain("42");
    await expect(completeAiTurn(next, { owner: "test-user" })).rejects.toThrow("expired");
  });

  it("returns a permission question without executing its proposed actions or sharing rows", async () => {
    vi.mocked(structuredResponse).mockResolvedValueOnce({ ...answer, output: {
      ...answer.output, approval: "selected_data", explanation: "May I read these selected rows?",
      action: "request_data", includeSelection: true,
    } });
    expect(await completeAiTurn(body, { owner: "test-user" })).toMatchObject({ kind: "explanation", approval: "selected_data", workspaceActions: [] });
  });

  it("chooses tools automatically, can think harder, and retains the web allowance across browser rounds", async () => {
    vi.mocked(structuredResponse).mockImplementationOnce(async (options) => {
      expect(options.policy?.()).toMatchObject({ thinking: "medium", webSearch: false });
      expect(options.policy?.().functions).toContain("wikipedia_search");
      expect(options.policy?.().functions).not.toContain("reconsider_approach");
      await options.functionTools?.find((tool) => tool.name === "increase_thinking")?.execute({ level: "high", reason: "A multi-step calculation is needed." });
      await options.functionTools?.find((tool) => tool.name === "enable_web_search")?.execute({ need: "time_sensitive", question: "What changed this morning?" });
      expect(options.policy?.().webSearch).toBe(true);
      options.onWebSearch?.();
      expect(options.policy?.()).toMatchObject({ thinking: "high", webSearch: false });
      return { ...answer, continuationInput: [], output: { ...answer.output, action: "request_data", dataRequests: [{ scope: "workspace", sql: "SELECT 3 AS count", purpose: "Count rows", limit: 1 }] } };
    }).mockImplementationOnce(async (options) => {
      expect(options.policy?.()).toMatchObject({ webSearch: false, thinking: "high" });
      return answer;
    });
    const first = await completeAiTurn(body, { owner: "budget-test" });
    if (first.kind !== "data_request") throw new Error("Expected data request");
    const result = await completeAiTurn({ ...body, turnId: first.turnId, workspaceData: [{ sql: "SELECT 3 AS count", purpose: "Count rows", columns: ["count"], rows: [["3"]], returnedRows: 1, truncated: false }] }, { owner: "budget-test" });
    expect(result).toMatchObject({ kind: "explanation", activity: { thinking: "high", tools: ["web_search", "workspace_queries"] } });
  });

  it("keeps manual thinking fixed and prevents repair turns from repeating persistent writes", async () => {
    vi.mocked(structuredResponse).mockImplementationOnce(async (options) => {
      expect(options.policy?.()).toMatchObject({ thinking: "medium", webSearch: false });
      expect(options.policy?.().functions).not.toContain("increase_thinking");
      await expect(options.functionTools?.find((tool) => tool.name === "increase_thinking")?.execute({ level: "high", reason: "More work." })).rejects.toThrow("fixed");
      return { ...answer, output: { ...answer.output, localChangesAuthorized: true, workspaceActions: [{ sql: "DELETE FROM derived", purpose: "Clean rows" }] } };
    });
    const result = await completeAiTurn({ ...body, task: "repair", preferences: { thinking: "medium" }, approvedFeatures: ["local_changes"] }, { owner: "repair-test" });
    expect(result).toMatchObject({ kind: "explanation", workspaceActions: [] });
  });
});

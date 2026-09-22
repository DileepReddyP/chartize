import { beforeEach, expect, it, vi } from "vitest";
import { z } from "zod";

vi.mock("server-only", () => ({}));
const streamResponse = vi.hoisted(() => vi.fn());
vi.mock("openai", () => ({ default: class { responses = { stream: streamResponse }; } }));
import { structuredResponse } from "./provider";
import { toolProgress } from "./progress";

beforeEach(() => streamResponse.mockReset());

it.each([undefined, "gpt-5.6-luna", "gpt-6-luna"])("preserves Fast mode, caching and reasoning with model override %s", async (model) => {
  vi.stubEnv("OPENAI_API_KEY", "unit-test-only");
  vi.stubEnv("AI_PROVIDER", "openai");
  vi.stubEnv("AI_TEXT_MODEL", model);
  vi.stubEnv("OPENAI_MODEL", undefined);
  streamResponse.mockImplementation(() => ({
    async *[Symbol.asyncIterator]() {},
    async finalResponse() { return { output: [], output_parsed: { answer: "done" } }; },
  }));
  try {
    const result = await structuredResponse({
      name: "test", schema: z.object({ answer: z.string() }), stableInstructions: "stable prefix", turnInstructions: "this turn", input: "question",
      cacheKey: "test", reasoningEffort: "medium",
    });
    const request = streamResponse.mock.calls[0]?.[0];
    expect(request).toMatchObject({
      model: model ?? "gpt-6-luna", service_tier: "priority", store: false,
      reasoning: { effort: "medium" }, max_output_tokens: 10_000,
      prompt_cache_key: "test", prompt_cache_options: { mode: "explicit", ttl: "30m" },
      include: ["reasoning.encrypted_content"],
    });
    expect(request.input[0].content[0]).toMatchObject({ text: "stable prefix", prompt_cache_breakpoint: { mode: "explicit" } });
    expect(result.usage.models).toEqual([model ?? "gpt-6-luna"]);
  } finally { vi.unstubAllEnvs(); }
});

it("runs independent functions together, returns every call ID, and uses automatic tool choice", async () => {
  vi.stubEnv("OPENAI_API_KEY", "unit-test-only");
  vi.stubEnv("AI_PROVIDER", "openai");
  let released!: () => void;
  const bothStarted = new Promise<void>((resolve) => { released = resolve; });
  const started: string[] = [];
  const functions = ["first", "second"].map((name) => ({
    name, description: name, parameters: { type: "object", properties: {}, additionalProperties: false },
    execute: async () => { started.push(name); if (started.length === 2) released(); await bothStarted; return name; },
  }));
  let round = 0;
  streamResponse.mockImplementation(() => ({
    async *[Symbol.asyncIterator]() {},
    async finalResponse() {
      round++;
      return round === 1 ? { output: functions.map(({ name }) => ({ type: "function_call", id: `fc_${name}`, call_id: name, name, arguments: "{}", status: "completed" })), output_parsed: null }
        : { output: [], output_parsed: { answer: "done" } };
    },
  }));
  try {
    const result = await structuredResponse({
      name: "test", schema: z.object({ answer: z.string() }), stableInstructions: "test", turnInstructions: "test", input: "test",
      cacheKey: "test", functionTools: functions, policy: () => ({ thinking: "low", functions: ["first", "second"], webSearch: false }),
    });
    expect(result.output.answer).toBe("done");
    expect(streamResponse.mock.calls[0]?.[0]).toMatchObject({ parallel_tool_calls: true, tool_choice: { mode: "auto" } });
    expect(streamResponse.mock.calls[1]?.[0].input.filter((item: { type?: string }) => item.type === "function_call_output").map((item: { call_id: string }) => item.call_id)).toEqual(["first", "second"]);
  } finally { vi.unstubAllEnvs(); }
});

it("streams actual web-search queries and keeps long tool details within the wire limit", async () => {
  vi.stubEnv("OPENAI_API_KEY", "unit-test-only");
  vi.stubEnv("AI_PROVIDER", "openai");
  const item = { id: "ws_test", type: "web_search_call", status: "completed", action: { type: "search", queries: ["MTA service changes", "September 2026"] } };
  streamResponse.mockImplementation(() => ({
    async *[Symbol.asyncIterator]() {
      yield { type: "response.web_search_call.searching" };
      yield { type: "response.output_item.done", item };
      yield { type: "response.output_text.delta", delta: "answer" };
    },
    async finalResponse() { return { output: [item], output_parsed: { answer: "done" } }; },
  }));
  const progress: string[] = [];
  try {
    await structuredResponse({
      name: "test", schema: z.object({ answer: z.string() }), stableInstructions: "test", turnInstructions: "test", input: "test", cacheKey: "test",
      policy: () => ({ thinking: "medium", functions: [], webSearch: true }), onProgress: (message) => progress.push(message),
    });
    expect(progress).toContain("searched the web for: MTA service changes · September 2026");
    expect(progress.at(-1)).toBe("writing the response…");
    expect(toolProgress("searching Wikipedia for", "x".repeat(300))).toHaveLength(300);
  } finally { vi.unstubAllEnvs(); }
});

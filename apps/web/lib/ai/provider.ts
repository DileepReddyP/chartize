import "server-only";

import OpenAI, { AzureOpenAI } from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { toResponseInputItems } from "openai/lib/responses/ResponseInputItems";
import type { AiCitation, AiThinkingLevel, AiUsage } from "@chartize/contracts";
import type { ParsedResponse, ResponseInput, Tool, ToolChoiceAllowed } from "openai/resources/responses/responses";
import type { z } from "zod";
import { createInitialResponseInput } from "./provider-request";

export interface StructuredFunctionTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute: (argumentsValue: unknown) => Promise<unknown>;
}

export interface ResponsePolicy {
  thinking: AiThinkingLevel;
  functions: string[];
  webSearch: boolean;
  requiredTool?: string;
  concise?: boolean;
}

export const THINKING_OUTPUT_BUDGET: Record<AiThinkingLevel, number> = {
  low: 6_000, medium: 10_000, high: 16_000, xhigh: 24_000, max: 32_000,
};

function clientAndModel() {
  if ((process.env.AI_PROVIDER ?? "openai").toLowerCase() === "azure") {
    const apiKey = process.env.AZURE_OPENAI_API_KEY;
    const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
    const deployment = process.env.AZURE_OPENAI_DEPLOYMENT;
    if (!apiKey || !endpoint || !deployment) throw new Error("Azure OpenAI is selected, but its API key, endpoint, or deployment is missing.");
    return {
      client: new AzureOpenAI({ apiKey, endpoint, deployment, apiVersion: process.env.AZURE_OPENAI_API_VERSION ?? "2025-04-01-preview" }),
      model: deployment, promptCaching: false, fastMode: false,
    };
  }
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured.");
  const model = process.env.AI_TEXT_MODEL ?? process.env.OPENAI_MODEL ?? "gpt-5.6-luna";
  return { client: new OpenAI({ apiKey: process.env.OPENAI_API_KEY }), model, promptCaching: model.startsWith("gpt-5.6"), fastMode: model.startsWith("gpt-5.6") };
}

/** Shared transport for the planner and agent. Policy is re-read after each tool. */
export async function structuredResponse<Schema extends z.ZodType>(options: {
  name: string;
  schema: Schema;
  stableInstructions: string;
  turnInstructions: string;
  input: string | ResponseInput;
  resumeInput?: ResponseInput | undefined;
  reasoningEffort?: AiThinkingLevel;
  maxOutputTokens?: number;
  cacheKey: string;
  functionTools?: StructuredFunctionTool[];
  policy?: () => ResponsePolicy;
  maxToolRounds?: number;
  safetyIdentifier?: string | undefined;
  signal?: AbortSignal | undefined;
  onProgress?: ((message: string) => void) | undefined;
  onWebSearch?: () => void;
}): Promise<{ output: z.infer<Schema>; sources: AiCitation[]; researched: boolean; continuationInput: ResponseInput; usage: AiUsage }> {
  const { client, model, promptCaching, fastMode } = clientAndModel();
  const functionTools = options.functionTools ?? [];
  const handlers = new Map(functionTools.map((tool) => [tool.name, tool.execute]));
  const tools: Tool[] = functionTools.map(({ name, description, parameters }) => ({ type: "function", name, description, parameters, strict: true }));
  // Stable definitions keep the cached prefix reusable; allowed_tools gates use.
  if (options.policy) tools.push({ type: "web_search", search_context_size: "medium" });
  let input = options.resumeInput ?? createInitialResponseInput({
    stableInstructions: options.stableInstructions, turnInstructions: options.turnInstructions,
    input: options.input, explicitPromptCache: promptCaching,
  });
  const sources = new Map<string, AiCitation>();
  const usage: AiUsage[] = [];
  let researched = false;
  const maxRounds = options.maxToolRounds ?? 6;
  for (let round = 0; round <= maxRounds; round += 1) {
    const policy = options.policy?.() ?? { thinking: options.reasoningEffort ?? "low", functions: [], webSearch: false };
    const allowed: ToolChoiceAllowed["tools"] = [
      ...policy.functions.map((name) => ({ type: "function" as const, name })),
      ...(policy.webSearch && !researched ? [{ type: "web_search" as const }] : []),
    ];
    const required = policy.requiredTool === "wikipedia"
      ? allowed.filter((tool) => "name" in tool && String(tool.name).startsWith("wikipedia_"))
      : policy.requiredTool === "web_search"
      ? allowed.filter((tool) => tool.type === "web_search")
      : allowed.filter((tool) => "name" in tool && tool.name === policy.requiredTool);
    const toolChoice: "none" | ToolChoiceAllowed = round === maxRounds || !allowed.length
      ? "none"
      : { type: "allowed_tools", mode: required.length ? "required" : "auto", tools: required.length ? required : allowed };
    options.onProgress?.(`thinking · ${policy.thinking}…`);
    const stream = client.responses.stream({
      model, store: false, input,
      ...(fastMode ? { service_tier: "priority" as const } : {}),
      reasoning: { effort: policy.thinking },
      text: { format: zodTextFormat(options.schema, options.name), verbosity: policy.concise ? "low" : "medium" },
      max_output_tokens: options.maxOutputTokens ?? THINKING_OUTPUT_BUDGET[policy.thinking],
      max_tool_calls: 1,
      ...(promptCaching ? { prompt_cache_key: options.cacheKey, prompt_cache_options: { mode: "explicit" as const, ttl: "30m" as const } } : {}),
      ...(tools.length ? { tools, tool_choice: toolChoice, parallel_tool_calls: false } : {}),
      include: ["reasoning.encrypted_content", ...(options.policy ? ["web_search_call.action.sources" as const] : [])],
      ...(options.safetyIdentifier ? { safety_identifier: options.safetyIdentifier } : {}),
    }, { signal: options.signal });
    let lastProgress = "";
    for await (const event of stream) {
      const message = event.type === "response.web_search_call.searching" ? "searching the web…"
        : event.type === "response.output_text.delta" ? "writing the response…" : "";
      if (message && message !== lastProgress) { options.onProgress?.(message); lastProgress = message; }
    }
    const response = await stream.finalResponse() as ParsedResponse<z.infer<Schema>>;
    usage.push(responseUsage(model, response));
    collectResearchEvidence(response, sources);
    if (response.output.some((item) => item.type === "web_search_call")) options.onWebSearch?.();
    researched ||= response.output.some((item) => item.type === "web_search_call" && item.status === "completed");
    input = [...input, ...toResponseInputItems(response.output)];
    const calls = response.output.filter((item) => item.type === "function_call");
    if (!calls.length) {
      if (!response.output_parsed) throw new Error("Chartize AI ran out of response space. Try again with a narrower request.");
      return { output: options.schema.parse(response.output_parsed), sources: [...sources.values()], researched, continuationInput: input, usage: aggregateAiUsage(...usage) };
    }
    if (round === maxRounds) throw new Error("Chartize AI reached its tool limit for this turn.");
    for (const call of calls) {
      const handler = handlers.get(call.name);
      let output: unknown;
      try {
        if (!handler || !policy.functions.includes(call.name)) throw new Error("This tool is not enabled in the current plan. Reconsider the approach if it is needed.");
        output = { ok: true, result: await handler(JSON.parse(call.arguments)) };
      } catch (error) {
        output = { ok: false, error: error instanceof Error ? error.message : "Tool failed." };
      }
      input.push({ type: "function_call_output", call_id: call.call_id, output: JSON.stringify(output) });
    }
  }
  throw new Error("Chartize AI did not finish this turn.");
}

function responseUsage(model: string, response: ParsedResponse<unknown>): AiUsage {
  return {
    models: [model], calls: 1,
    inputTokens: response.usage?.input_tokens ?? 0,
    cachedInputTokens: response.usage?.input_tokens_details.cached_tokens ?? 0,
    cacheWriteTokens: response.usage?.input_tokens_details.cache_write_tokens ?? 0,
    outputTokens: response.usage?.output_tokens ?? 0,
    reasoningTokens: response.usage?.output_tokens_details.reasoning_tokens ?? 0,
    totalTokens: response.usage?.total_tokens ?? 0,
  };
}

function collectResearchEvidence(response: ParsedResponse<unknown>, sources: Map<string, AiCitation>) {
  const add = (url: string, title?: string) => {
    try {
      const parsed = new URL(url);
      if (!/^https?:$/.test(parsed.protocol)) return;
      parsed.searchParams.delete("utm_source");
      sources.set(parsed.href, { title: title || parsed.hostname, url: parsed.href });
    } catch { /* Ignore malformed source metadata. */ }
  };
  for (const item of response.output) {
    if (item.type === "web_search_call" && item.action.type === "search") item.action.sources?.forEach((source) => add(source.url));
    if (item.type === "web_search_call" && item.action.type === "open_page" && item.action.url) add(item.action.url);
    if (item.type === "message") for (const content of item.content) {
      if (content.type === "output_text") for (const citation of content.annotations) {
        if (citation.type === "url_citation") add(citation.url, citation.title);
      }
    }
  }
}

export function aggregateAiUsage(...values: AiUsage[]): AiUsage {
  return {
    models: [...new Set(values.flatMap((value) => value.models))],
    calls: values.reduce((sum, value) => sum + value.calls, 0),
    inputTokens: values.reduce((sum, value) => sum + value.inputTokens, 0),
    cachedInputTokens: values.reduce((sum, value) => sum + value.cachedInputTokens, 0),
    cacheWriteTokens: values.reduce((sum, value) => sum + value.cacheWriteTokens, 0),
    outputTokens: values.reduce((sum, value) => sum + value.outputTokens, 0),
    reasoningTokens: values.reduce((sum, value) => sum + value.reasoningTokens, 0),
    totalTokens: values.reduce((sum, value) => sum + value.totalTokens, 0),
  };
}

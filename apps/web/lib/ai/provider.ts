import "server-only";

import OpenAI, { AzureOpenAI } from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type { AiUsage } from "@chartize/contracts";
import type {
  FunctionTool,
  ParsedResponse,
  ResponseReasoningItem,
  ResponseIncludable,
  ResponseInput,
  Tool,
} from "openai/resources/responses/responses";
import type { z } from "zod";
import { createInitialResponseInput, toolChoiceForRound } from "./provider-request";

type ResponsesClient = OpenAI | AzureOpenAI;
type ReasoningEffort = "none" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max";

export interface StructuredFunctionTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute: (argumentsValue: unknown) => Promise<unknown>;
}

function clientAndModel(): { client: ResponsesClient; model: string; promptCaching: boolean; fastMode: boolean } {
  if ((process.env.AI_PROVIDER ?? "openai").toLowerCase() === "azure") {
    const apiKey = process.env.AZURE_OPENAI_API_KEY;
    const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
    const deployment = process.env.AZURE_OPENAI_DEPLOYMENT;
    if (!apiKey || !endpoint || !deployment) {
      throw new Error("Azure OpenAI is selected, but its API key, endpoint, or deployment is missing.");
    }
    return {
      client: new AzureOpenAI({
        apiKey,
        endpoint,
        deployment,
        apiVersion: process.env.AZURE_OPENAI_API_VERSION ?? "2025-04-01-preview",
      }),
      model: deployment,
      promptCaching: false,
      fastMode: false,
    };
  }

  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }
  const model = process.env.AI_TEXT_MODEL ?? process.env.OPENAI_MODEL ?? "gpt-5.6-luna";
  return {
    client: new OpenAI({ apiKey: process.env.OPENAI_API_KEY }),
    model,
    promptCaching: model.startsWith("gpt-5.6"),
    fastMode: model.startsWith("gpt-5.6"),
  };
}

export async function structuredResponse<Schema extends z.ZodType>(options: {
  name: string;
  schema: Schema;
  stableInstructions: string;
  turnInstructions: string;
  input: Parameters<typeof createInitialResponseInput>[0]["input"];
  continuationInput?: ResponseInput;
  webSearch?: boolean;
  allowFunctionTools?: boolean;
  reasoningEffort?: ReasoningEffort;
  maxOutputTokens?: number;
  cacheKey: string;
  functionTools?: StructuredFunctionTool[];
  maxToolRounds?: number;
  requiredWebSearch?: boolean;
  continueAfterRequiredWebSearch?: boolean;
  maxBuiltInToolCalls?: number;
  sourceSelection?: "cited" | "all";
  onProgress?: (message: string) => void;
}): Promise<{ output: z.infer<Schema>; sources: Array<{ title: string; url: string }>; researched: boolean; reasoningItems: ResponseReasoningItem[]; usage: AiUsage }> {
  const { client, model, promptCaching, fastMode } = clientAndModel();
  const functionTools = options.functionTools ?? [];
  const handlers = new Map(functionTools.map((tool) => [tool.name, tool.execute]));
  const tools: Tool[] = functionTools.map((tool): FunctionTool => ({
    type: "function",
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
    strict: true,
  }));
  // GPT-5.6 renders tool definitions before developer messages. Keep this list
  // stable across turns so the explicit instruction breakpoint remains reusable;
  // tool_choice below controls what the model may actually call.
  if (promptCaching || options.webSearch) {
    tools.push({
      type: "web_search",
      search_context_size: "medium",
    });
  }

  const include: ResponseIncludable[] = [];
  if (options.webSearch) include.push("web_search_call.action.sources");
  // A stateless reasoning response must carry its encrypted reasoning items
  // into the next function-call round so the model can continue coherently.
  if (promptCaching || (functionTools.length && options.allowFunctionTools !== false)) include.push("reasoning.encrypted_content");

  let input = createInitialResponseInput({
    stableInstructions: options.stableInstructions,
    turnInstructions: options.turnInstructions,
    input: options.input,
    ...(options.continuationInput ? { continuationInput: options.continuationInput } : {}),
    explicitPromptCache: promptCaching,
  });
  const sourceMap = new Map<string, { title: string; url: string }>();
  const citationMap = new Map<string, { title: string; url: string }>();
  let researched = false;
  const usageValues: AiUsage[] = [];
  const reasoningItems: ResponseReasoningItem[] = [];
  let parsedOutput: z.infer<Schema> | null = null;
  const maxToolRounds = options.maxToolRounds ?? 4;
  let lastProgress = "";
  const report = (message: string) => {
    if (!message || message === lastProgress) return;
    lastProgress = message;
    options.onProgress?.(message);
  };

  for (let round = 0; round <= maxToolRounds; round += 1) {
    report(round ? "continuing with the gathered evidence…" : "thinking through the request…");
    const allowWebSearch = Boolean(options.webSearch && !researched);
    const toolChoice = toolChoiceForRound({
      functionNames: functionTools.map((tool) => tool.name),
      allowFunctionTools: options.allowFunctionTools ?? true,
      allowWebSearch,
      requireWebSearch: Boolean(options.requiredWebSearch && round === 0),
    });
    const stream = client.responses.stream({
      model,
      store: false,
      // The current SDK still names API Fast mode "priority"; both request
      // values are aliases and GPT-5.6 responses report "priority".
      ...(fastMode ? { service_tier: "priority" as const } : {}),
      reasoning: { effort: options.reasoningEffort ?? "low" },
      input,
      text: { format: zodTextFormat(options.schema, options.name) },
      ...(options.maxOutputTokens === undefined ? {} : { max_output_tokens: options.maxOutputTokens }),
      ...(options.maxBuiltInToolCalls ? { max_tool_calls: options.maxBuiltInToolCalls } : {}),
      ...(promptCaching ? {
        prompt_cache_key: options.cacheKey,
        prompt_cache_options: { mode: "explicit" as const, ttl: "30m" as const },
      } : {}),
      ...(tools.length ? {
        tools,
        tool_choice: toolChoice,
        parallel_tool_calls: true,
      } : {}),
      ...(include.length ? { include } : {}),
    });
    for await (const event of stream) {
      const message = progressMessage(event.type);
      if (message) report(message);
    }
    const response = await stream.finalResponse() as ParsedResponse<z.infer<Schema>>;
    report("checking the response…");
    usageValues.push(responseUsage(model, response));
    reasoningItems.push(...response.output.filter((item): item is ResponseReasoningItem => (
      item.type === "reasoning" && Boolean(item.encrypted_content)
    )));
    collectResearchEvidence(response, sourceMap, citationMap);
    researched = response.output.some((item) => item.type === "web_search_call" && item.status === "completed") || researched;

    const calls = response.output.filter((item) => item.type === "function_call");
    if (
      !calls.length
      && round === 0
      && options.requiredWebSearch
      && options.continueAfterRequiredWebSearch
      && functionTools.length
      && researched
    ) {
      input = [
        ...input,
        ...replayableOutput(response.output),
        {
          role: "user",
          content: "Live research is complete. Continue the same turn now: request browser workspace data if a calculation or data inspection is still needed, otherwise return the final grounded response.",
        },
      ];
      continue;
    }
    if (!calls.length) {
      parsedOutput = response.output_parsed;
      break;
    }
    if (round === maxToolRounds) {
      throw new Error("Chartize AI reached its workspace-tool limit before completing the turn.");
    }

    const outputs = await Promise.all(calls.map(async (call) => {
      const handler = handlers.get(call.name);
      if (!handler) {
        return {
          type: "function_call_output" as const,
          call_id: call.call_id,
          output: JSON.stringify({ ok: false, error: `Unknown workspace tool: ${call.name}` }),
        };
      }
      try {
        const argumentsValue: unknown = JSON.parse(call.arguments);
        const result = await handler(argumentsValue);
        return {
          type: "function_call_output" as const,
          call_id: call.call_id,
          output: JSON.stringify({ ok: true, result }),
        };
      } catch (error) {
        return {
          type: "function_call_output" as const,
          call_id: call.call_id,
          output: JSON.stringify({ ok: false, error: error instanceof Error ? error.message : "Workspace tool failed." }),
        };
      }
    }));
    input = [
      ...input,
      ...replayableOutput(response.output),
      ...outputs,
    ];
  }

  if (!parsedOutput) {
    throw new Error("The model did not return a structured response.");
  }
  // Prefer links the model actually cited. The search call can expose every
  // candidate it considered, which makes the UI footer look like a noisy
  // bibliography and can imply that uncited results support the answer.
  const citedSources = [...citationMap.values()];
  const allSources = [
    ...citedSources,
    ...[...sourceMap.values()].filter((source) => !citationMap.has(source.url)),
  ];
  const sources = options.sourceSelection === "all"
    ? allSources
    : citedSources;
  return {
    output: options.schema.parse(parsedOutput),
    sources: sources.slice(0, 6),
    researched,
    reasoningItems,
    usage: aggregateAiUsage(...usageValues),
  };
}

function progressMessage(eventType: string) {
  switch (eventType) {
    case "response.web_search_call.in_progress": return "starting web research…";
    case "response.web_search_call.searching": return "searching and reading sources…";
    case "response.web_search_call.completed": return "research sources gathered…";
    case "response.function_call_arguments.delta": return "preparing a workspace tool…";
    case "response.function_call_arguments.done": return "running the workspace tool…";
    case "response.output_text.delta": return "writing the grounded response…";
    default: return "";
  }
}

function replayableOutput(output: ParsedResponse<unknown>["output"]): ResponseInput {
  // The Responses SDK decorates function calls/content with SDK-only parsed
  // values. They are convenient locally but are not legal Response input
  // properties, so remove them while retaining reasoning and tool-call items.
  return JSON.parse(JSON.stringify(output, (key, value: unknown) => (
    key === "parsed_arguments" || key === "parsed" ? undefined : value
  ))) as ResponseInput;
}

function responseUsage(model: string, response: ParsedResponse<unknown>): AiUsage {
  return {
    models: [model],
    calls: 1,
    inputTokens: response.usage?.input_tokens ?? 0,
    cachedInputTokens: response.usage?.input_tokens_details.cached_tokens ?? 0,
    cacheWriteTokens: response.usage?.input_tokens_details.cache_write_tokens ?? 0,
    outputTokens: response.usage?.output_tokens ?? 0,
    reasoningTokens: response.usage?.output_tokens_details.reasoning_tokens ?? 0,
    totalTokens: response.usage?.total_tokens ?? 0,
  };
}

function collectResearchEvidence(
  response: ParsedResponse<unknown>,
  sourceMap: Map<string, { title: string; url: string }>,
  citationMap: Map<string, { title: string; url: string }>,
) {
  response.output.forEach((item) => {
    if (item.type === "web_search_call" && item.action.type === "search") {
      item.action.sources?.forEach((source) => {
        const title = safeHost(source.url);
        const url = cleanSourceUrl(source.url);
        sourceMap.set(url, { title, url });
      });
    }
    if (item.type === "web_search_call" && item.action.type === "open_page" && item.action.url) {
      const url = cleanSourceUrl(item.action.url);
      sourceMap.set(url, { title: safeHost(url), url });
    }
    if (item.type === "web_search_call" && item.action.type === "find_in_page") {
      const url = cleanSourceUrl(item.action.url);
      sourceMap.set(url, { title: safeHost(url), url });
    }
    if (item.type === "message") {
      item.content.forEach((content) => {
        if (content.type !== "output_text") return;
        content.annotations.forEach((annotation) => {
          if (annotation.type !== "url_citation") return;
          const url = cleanSourceUrl(annotation.url);
          citationMap.set(url, { title: annotation.title || safeHost(url), url });
        });
      });
    }
  });
}

export function aggregateAiUsage(...values: AiUsage[]): AiUsage {
  return {
    models: [...new Set(values.flatMap((value) => value.models))],
    calls: values.reduce((total, value) => total + value.calls, 0),
    inputTokens: values.reduce((total, value) => total + value.inputTokens, 0),
    cachedInputTokens: values.reduce((total, value) => total + value.cachedInputTokens, 0),
    cacheWriteTokens: values.reduce((total, value) => total + value.cacheWriteTokens, 0),
    outputTokens: values.reduce((total, value) => total + value.outputTokens, 0),
    reasoningTokens: values.reduce((total, value) => total + value.reasoningTokens, 0),
    totalTokens: values.reduce((total, value) => total + value.totalTokens, 0),
  };
}

function safeHost(url: string) {
  try { return new URL(url).hostname.replace(/^www\./, ""); }
  catch { return "web source"; }
}

function cleanSourceUrl(url: string) {
  try {
    const parsed = new URL(url);
    parsed.searchParams.delete("utm_source");
    return parsed.toString();
  } catch {
    return url;
  }
}

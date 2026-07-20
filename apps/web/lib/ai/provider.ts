import "server-only";

import OpenAI, { AzureOpenAI } from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type { AiUsage } from "@chartize/contracts";
import type {
  FunctionTool,
  ParsedResponse,
  ResponseIncludable,
  ResponseInput,
  Tool,
} from "openai/resources/responses/responses";
import type { z } from "zod";

type ResponsesClient = OpenAI | AzureOpenAI;
type ReasoningEffort = "none" | "minimal" | "low" | "medium" | "high";

export interface StructuredFunctionTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute: (argumentsValue: unknown) => Promise<unknown>;
}

// Live research is intentionally limited to primary civic/economic sources,
// established pollsters, research institutions, and major original reporting.
// This prevents a well-phrased prompt from being grounded in an aggregator or
// editable reference page simply because it ranked highly for a date query.
const CHARTIZE_RESEARCH_DOMAINS = [
  "apnews.com", "reuters.com", "npr.org", "bbc.com", "abcnews.go.com",
  "cbsnews.com", "nbcnews.com", "cnn.com", "nytimes.com", "washingtonpost.com",
  "wsj.com", "politico.com", "pewresearch.org", "gallup.com", "ipsos.com",
  "yougov.com", "maristpoll.marist.edu", "poll.qu.edu", "siena.edu",
  "electionstudies.org", "census.gov", "bls.gov", "bea.gov", "cbo.gov",
  "fec.gov", "eac.gov", "federalreserve.gov", "congress.gov", "archives.gov",
  "supremecourt.gov", "house.gov", "senate.gov", "whitehouse.gov", "cdc.gov",
  "nber.org", "brookings.edu", "urban.org", "rand.org", "kff.org",
  "oecd.org", "worldbank.org", "imf.org", "un.org", "ec.europa.eu", "who.int",
] as const;

function clientAndModel(): { client: ResponsesClient; model: string; promptCaching: boolean } {
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
    };
  }

  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }
  const model = process.env.AI_TEXT_MODEL ?? process.env.OPENAI_MODEL ?? "gpt-5.6-terra";
  return {
    client: new OpenAI({ apiKey: process.env.OPENAI_API_KEY }),
    model,
    promptCaching: model.startsWith("gpt-5.6"),
  };
}

export async function structuredResponse<Schema extends z.ZodType>(options: {
  name: string;
  schema: Schema;
  instructions: string;
  input: string | ResponseInput;
  webSearch?: boolean;
  reasoningEffort?: ReasoningEffort;
  maxOutputTokens?: number;
  cacheKey: string;
  functionTools?: StructuredFunctionTool[];
  maxToolRounds?: number;
  requiredWebSearch?: boolean;
  continueAfterRequiredWebSearch?: boolean;
  sourceSelection?: "cited" | "all";
}): Promise<{ output: z.infer<Schema>; sources: Array<{ title: string; url: string }>; researched: boolean; usage: AiUsage }> {
  const { client, model, promptCaching } = clientAndModel();
  const functionTools = options.functionTools ?? [];
  const handlers = new Map(functionTools.map((tool) => [tool.name, tool.execute]));
  const tools: Tool[] = functionTools.map((tool): FunctionTool => ({
    type: "function",
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
    strict: true,
  }));
  if (options.webSearch) {
    tools.push({
      type: "web_search",
      search_context_size: "medium",
      filters: { allowed_domains: [...CHARTIZE_RESEARCH_DOMAINS] },
    });
  }

  const include: ResponseIncludable[] = [];
  if (options.webSearch) include.push("web_search_call.action.sources");
  // A stateless reasoning response must carry its encrypted reasoning items
  // into the next function-call round so the model can continue coherently.
  if (functionTools.length) include.push("reasoning.encrypted_content");

  let input: ResponseInput = typeof options.input === "string"
    ? [{ role: "user", content: options.input }]
    : [...options.input];
  const sourceMap = new Map<string, { title: string; url: string }>();
  const citationMap = new Map<string, { title: string; url: string }>();
  let researched = false;
  const usageValues: AiUsage[] = [];
  let parsedOutput: z.infer<Schema> | null = null;
  const maxToolRounds = options.maxToolRounds ?? 4;

  for (let round = 0; round <= maxToolRounds; round += 1) {
    const response: ParsedResponse<z.infer<Schema>> = await client.responses.parse({
      model,
      store: false,
      reasoning: { effort: options.reasoningEffort ?? "low" },
      instructions: options.instructions,
      input,
      text: { format: zodTextFormat(options.schema, options.name) },
      max_output_tokens: options.maxOutputTokens,
      ...(promptCaching ? {
        prompt_cache_key: options.cacheKey,
        prompt_cache_options: { mode: "implicit" as const, ttl: "30m" as const },
      } : {}),
      ...(tools.length ? {
        tools,
        tool_choice: options.requiredWebSearch && round === 0
          ? {
              type: "allowed_tools" as const,
              mode: "required" as const,
              tools: [{ type: "web_search" }],
            }
          : "auto" as const,
        parallel_tool_calls: true,
      } : {}),
      ...(include.length ? { include } : {}),
    });
    usageValues.push(responseUsage(model, response));
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
          content: "Live research is complete. Continue the same turn now: use the read-only workspace tool for any calculation or data inspection the request needs, then return the final grounded response.",
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
    : (citedSources.length ? citedSources : [...sourceMap.values()]);
  return {
    output: options.schema.parse(parsedOutput),
    sources: sources.slice(0, 6),
    researched,
    usage: aggregateAiUsage(...usageValues),
  };
}

function replayableOutput(output: ParsedResponse<unknown>["output"]): ResponseInput {
  // `responses.parse` decorates function calls/content with SDK-only parsed
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

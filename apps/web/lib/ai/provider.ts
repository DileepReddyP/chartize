import "server-only";

import OpenAI, { AzureOpenAI } from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type { ResponseInput } from "openai/resources/responses/responses";
import type { z } from "zod";

type ResponsesClient = OpenAI | AzureOpenAI;

// Live research is intentionally limited to primary civic/economic sources,
// established pollsters, research institutions, and major original reporting.
// This prevents a well-phrased prompt from being grounded in an aggregator or
// editable reference page simply because it ranked highly for a date query.
const CIVIC_RESEARCH_DOMAINS = [
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

function clientAndModel(): { client: ResponsesClient; model: string } {
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
    };
  }

  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }
  return {
    client: new OpenAI({ apiKey: process.env.OPENAI_API_KEY }),
    model: process.env.AI_TEXT_MODEL ?? process.env.OPENAI_MODEL ?? "gpt-5.6-terra",
  };
}

export async function structuredResponse<Schema extends z.ZodType>(options: {
  name: string;
  schema: Schema;
  instructions: string;
  input: string | ResponseInput;
  webSearch?: boolean;
}): Promise<{ output: z.infer<Schema>; sources: Array<{ title: string; url: string }>; researched: boolean }> {
  const { client, model } = clientAndModel();
  const response = await client.responses.parse({
    model,
    store: false,
    reasoning: { effort: "low" },
    instructions: options.instructions,
    input: options.input,
    text: { format: zodTextFormat(options.schema, options.name) },
    ...(options.webSearch ? {
      tools: [{
        type: "web_search" as const,
        search_context_size: "medium" as const,
        filters: { allowed_domains: [...CIVIC_RESEARCH_DOMAINS] },
      }],
      tool_choice: "required" as const,
      include: ["web_search_call.action.sources" as const],
    } : {}),
  });

  if (!response.output_parsed) {
    throw new Error("The model did not return a structured response.");
  }
  const sourceMap = new Map<string, { title: string; url: string }>();
  const citationMap = new Map<string, { title: string; url: string }>();
  let researched = false;
  response.output.forEach((item) => {
    if (item.type === "web_search_call") {
      researched = item.status === "completed" || researched;
      if (item.action.type === "search") {
        item.action.sources?.forEach((source) => {
          const title = safeHost(source.url);
          const url = cleanSourceUrl(source.url);
          sourceMap.set(url, { title, url });
        });
      }
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
  // Prefer links the model actually cited. The search call can expose every
  // candidate it considered, which makes the UI footer look like a noisy
  // bibliography and can imply that uncited results support the answer.
  const sources = citationMap.size > 0 ? [...citationMap.values()] : [...sourceMap.values()];
  return {
    output: options.schema.parse(response.output_parsed),
    sources: sources.slice(0, 6),
    researched,
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

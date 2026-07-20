import {
  AiExplanationResponseSchema,
  AiVisualizationResponseSchema,
  FieldMetadataSchema,
} from "@chartize/contracts";
import { NextResponse } from "next/server";
import { z } from "zod";
import { compactAiContext, compactHistory, isComplexVisualizationRequest, isExplanationRequest, shouldResearch } from "@/lib/ai/context";
import { ModelExplanationSchema, ModelSuggestionSchema, normalizeModelSuggestion, publicAiError } from "@/lib/ai/model-output";
import { CHARTIZE_AI_INSTRUCTIONS, CHARTIZE_EXPLAIN_INSTRUCTIONS, chartizePreferenceInstructions, chartizeTurnInstructions } from "@/lib/ai/prompts";
import { aggregateAiUsage, structuredResponse } from "@/lib/ai/provider";

export const runtime = "nodejs";

const RequestSchema = z.object({
  task: z.enum(["generate", "repair", "explain"]),
  context: z.enum(["code", "chart", "general"]).default("general"),
  contextNote: z.string().max(4000).default(""),
  request: z.string().min(1).max(4000),
  currentQuery: z.string().max(100000).default(""),
  source: z.string().optional(),
  schema: z.array(FieldMetadataSchema).max(500),
  availableSources: z.array(z.object({
    id: z.string().min(1).max(300),
    title: z.string().max(500),
    description: z.string().max(3000).default(""),
    fields: z.array(FieldMetadataSchema).max(500),
  })).max(100).default([]),
  view: z.object({
    title: z.string().max(1000),
    subtitle: z.string().max(2000),
    sources: z.array(z.object({
      id: z.string().max(300),
      title: z.string().max(500),
      description: z.string().max(3000),
    })).max(20),
  }).optional(),
  preferences: z.object({
    hypothesize: z.boolean(),
    concise: z.boolean(),
    challenge: z.boolean(),
    technical: z.boolean(),
  }).default({ hypothesize: true, concise: true, challenge: false, technical: false }),
  sampleData: z.object({
    columns: z.array(z.string().max(300)).max(100),
    rows: z.array(z.array(z.string().max(3000)).max(100)).max(20),
  }).optional(),
  history: z.array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().max(6000) })).max(24).default([]),
});

const QueryValidationSchema = z.object({
  valid: z.boolean(),
  errors: z.array(z.string()),
  warnings: z.array(z.string()),
});

export async function POST(request: Request) {
  try {
    const body = RequestSchema.parse(await request.json());
    const source = body.source ?? inferSource(body.currentQuery) ?? "";
    const availableSources = body.availableSources.length
      ? body.availableSources
      : [{ id: source || "ggsql:penguins", title: source || "GGSQL sample · Penguins", description: "Current source", fields: body.schema }];
    const allowedSources = availableSources.map((candidate) => candidate.id);
    const hasCurrentQuery = Boolean(body.currentQuery.trim());
    const explanationOnly = body.task === "explain" || isExplanationRequest(body.request);
    const compactContext = compactAiContext({
      sources: availableSources,
      activeSource: source,
      currentQuery: body.currentQuery,
      request: body.request,
      contextNote: body.contextNote,
      view: body.view,
    });
    const sampleNotice = body.sampleData
      ? `The user explicitly consented to include this labeled data sample (${body.sampleData.rows.length} rows). Columns and row values are aligned by position:\n${JSON.stringify(body.sampleData)}`
      : "No row values were shared. Work only from field metadata.";
    const researchEnabled = shouldResearch(
      [body.request, body.contextNote, body.view?.title, body.view?.subtitle].filter(Boolean).join(" "),
      body.preferences.hypothesize,
      explanationOnly,
    );
    const workspaceTurn = [
      `User request: ${body.request}`,
      `Active workspace context: ${body.contextNote || "No narrower cursor or selection context."}`,
      `Rendered view: ${JSON.stringify(body.view ?? { title: "", subtitle: "", sources: [] })}`,
      `Current date: ${new Date().toISOString().slice(0, 10)}`,
      `Available source index: ${JSON.stringify(compactContext.sourceIndex)}`,
      `Relevant source schemas: ${JSON.stringify(compactContext.sourceSchemas)}`,
      `Current GGSQL:\n${body.currentQuery || "(none)"}`,
      sampleNotice,
    ].join("\n\n");
    const input = [
      ...compactHistory(body.history).map((message) => ({ role: message.role, content: message.text })),
      { role: "user" as const, content: workspaceTurn },
    ];

    if (explanationOnly) {
      const explanationResponse = await structuredResponse({
        name: "chartize_explanation",
        schema: ModelExplanationSchema,
        instructions: `${CHARTIZE_EXPLAIN_INSTRUCTIONS}\n\n${chartizeTurnInstructions(body.context, "explain")}\n${chartizePreferenceInstructions(body.preferences)}\n${researchEnabled ? "LIVE RESEARCH: Required. Search the exact subject and selected period before answering, then give concrete dated context rather than generic possibilities." : "LIVE RESEARCH: Not needed for this turn. Do not imply that you searched."}`,
        input,
        webSearch: researchEnabled,
        reasoningEffort: researchEnabled ? "low" : "none",
        maxOutputTokens: 3_500,
        cacheKey: "chartize:explanation:v2",
      });
      return NextResponse.json(AiExplanationResponseSchema.parse({
        kind: "explanation",
        ...explanationResponse.output,
        explanation: explanationResponse.output.explanation.replaceAll("?utm_source=openai", ""),
        sources: explanationResponse.sources,
        researched: explanationResponse.researched,
        usage: explanationResponse.usage,
      }));
    }

    const complexRequest = isComplexVisualizationRequest(body.request, body.currentQuery, body.task);
    const instructions = `${CHARTIZE_AI_INSTRUCTIONS}\n\n${chartizeTurnInstructions(body.context, body.task)}\n${chartizePreferenceInstructions(body.preferences)}\nLIVE RESEARCH: Not needed for this visualization turn. Do not imply that you searched.\n${hasCurrentQuery ? "Keep the active source unless the user asks to discover or use different data." : "BLANK WORKSPACE: There is no active query or source. Select every source needed from the catalog and return a complete executable visualization in one turn. Do not inherit the previous workspace's subject, source, title, or fields."}\nThe draft source must be one of these exact IDs: ${JSON.stringify(allowedSources)}.`;
    const modelResponse = await structuredResponse({
      name: "ggsql_suggestion",
      schema: ModelSuggestionSchema,
      instructions,
      input,
      webSearch: false,
      reasoningEffort: complexRequest ? "medium" : "low",
      maxOutputTokens: 9_000,
      cacheKey: "chartize:visualization:v2",
    });
    let result = normalizeModelSuggestion(modelResponse.output, modelResponse);
    let usage = modelResponse.usage;
    let validation = await validateGeneratedQuery(result.query);
    if (!validation.valid) {
      const repairResponse = await structuredResponse({
        name: "ggsql_repair",
        schema: ModelSuggestionSchema,
        instructions: `${instructions}\n\nVALIDATOR REPAIR: The engine rejected the candidate GGSQL. Treat its diagnostics as authoritative and return one corrected, complete structured response. Preserve the user's analytical intent, available source IDs, explanation, and visual-builder draft except where they must change to match the corrected query. Make the smallest syntax correction. Compute every expression in SELECT, alias it, and use only aliases or supported literal constants in MAPPING. Do not discuss the repair process in the user-facing explanation.`,
        input: [
          ...input,
          { role: "assistant" as const, content: `Candidate structured response:\n${JSON.stringify(modelResponse.output)}` },
          { role: "user" as const, content: `The GGSQL validator returned these errors:\n${validation.errors.join("\n")}\n\nReturn the corrected response now.` },
        ],
        webSearch: false,
        reasoningEffort: "medium",
        maxOutputTokens: 9_000,
        cacheKey: "chartize:repair:v2",
      });
      result = normalizeModelSuggestion(repairResponse.output, repairResponse);
      usage = aggregateAiUsage(usage, repairResponse.usage);
      validation = await validateGeneratedQuery(result.query);
    }
    if (!validation.valid) {
      throw new Error(`Chartize AI could not produce executable GGSQL after a repair pass: ${validation.errors.join("; ")}`);
    }
    if (!allowedSources.includes(result.draft.source)) {
      throw new Error(`The model selected an unavailable source: ${result.draft.source}`);
    }
    return NextResponse.json(AiVisualizationResponseSchema.parse({
      kind: "visualization",
      ...result,
      usage,
    }));
  } catch (error) {
    return NextResponse.json(
      { error: publicAiError(error) },
      { status: error instanceof z.ZodError ? 400 : 503 },
    );
  }
}

async function validateGeneratedQuery(ggsql: string) {
  const engine = (process.env.ENGINE_URL ?? "http://127.0.0.1:8787").replace(/\/$/, "");
  const response = await fetch(`${engine}/api/validate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ggsql }),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error("The GGSQL validator is unavailable.");
  }
  return QueryValidationSchema.parse(await response.json());
}

function inferSource(query: string) {
  return query.match(/\bFROM\s+(?:"([^"]+)"|(ggsql:[\w-]+)|([\w-]+))/i)?.slice(1).find(Boolean);
}

import {
  AiExplanationResponseSchema,
  AiVisualizationResponseSchema,
  FieldMetadataSchema,
} from "@chartize/contracts";
import { NextResponse } from "next/server";
import { z } from "zod";
import { compactAiContext, compactHistory, isComplexVisualizationRequest, isExplanationRequest, requestedResearchItemCount, shouldResearch } from "@/lib/ai/context";
import { ModelAgentResponseSchema, draftFromGgsql, normalizeModelGgsql, publicAiError, reconcileGroundedResponse } from "@/lib/ai/model-output";
import { CHARTIZE_AGENT_INSTRUCTIONS, CHARTIZE_AI_INSTRUCTIONS, GGSQL_GUIDE, chartizePreferenceInstructions, chartizeTurnInstructions } from "@/lib/ai/prompts";
import { aggregateAiUsage, structuredResponse } from "@/lib/ai/provider";
import { createWorkspaceFunctionTools } from "@/lib/ai/workspace-tools";

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
    webSearch: z.boolean(),
    dataAccess: z.boolean().default(true),
    concise: z.boolean(),
    challenge: z.boolean(),
    technical: z.boolean(),
  }).default({ hypothesize: true, webSearch: true, dataAccess: true, concise: true, challenge: false, technical: false }),
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
    const engineUrl = (process.env.ENGINE_URL ?? "http://127.0.0.1:8787").replace(/\/$/, "");
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
    // Decide whether citations are mandatory from the user's words, not from
    // boilerplate such as “current query is attached” in the context note.
    // The web tool can still be available for Terra to use when helpful.
    const researchRequired = shouldResearch(body.request, body.preferences.webSearch);
    const researchTarget = requestedResearchItemCount(body.request);
    const workspaceTurn = [
      `User request: ${body.request}`,
      `Active workspace context: ${body.contextNote || "No narrower cursor or selection context."}`,
      `Rendered view: ${JSON.stringify(body.view ?? { title: "", subtitle: "", sources: [] })}`,
      `Current date: ${new Date().toISOString().slice(0, 10)}`,
      `Available source index: ${JSON.stringify(compactContext.sourceIndex)}`,
      `Relevant source schemas: ${JSON.stringify(compactContext.sourceSchemas)}`,
      `Current GGSQL:\n${body.currentQuery || "(none)"}`,
      researchRequired
        ? `Live research is required for this turn. Find at least ${researchTarget} relevant dated finding${researchTarget === 1 ? "" : "s"}, ground factual claims in direct sources returned by web search, and keep web evidence separate from warehouse data.`
        : "Live research is optional for this turn.",
      sampleNotice,
    ].join("\n\n");
    const input = [
      ...compactHistory(body.history).map((message) => ({ role: message.role, content: message.text })),
      { role: "user" as const, content: workspaceTurn },
    ];
    const complexRequest = isComplexVisualizationRequest(body.request, body.currentQuery, body.task);
    const answerOnly = isExplanationRequest(body.request) || /\b(?:do\s+not|don't|without)\s+(?:change|edit|update|modify)(?:ing)?\b/i.test(body.request);
    const agentInstructions = answerOnly && body.task !== "repair" ? CHARTIZE_AGENT_INSTRUCTIONS : CHARTIZE_AI_INSTRUCTIONS;
    const instructions = `${agentInstructions}\n\n${chartizeTurnInstructions(body.context, body.task)}\n${chartizePreferenceInstructions(body.preferences)}\n${researchRequired ? `LIVE RESEARCH: Required in this same agent turn. Search before answering, use at least ${researchTarget} relevant dated finding${researchTarget === 1 ? "" : "s"}, and cite the direct source for every distinct finding rather than letting one citation appear to support unrelated claims. Never claim lookup was unavailable after the tool completes.` : body.preferences.webSearch ? "LIVE RESEARCH: Available but not mandatory. Use it only when outside facts would materially improve this request; do not search for a calculation the warehouse can answer." : "LIVE RESEARCH: Disabled. Do not imply that you searched."}\n${hasCurrentQuery ? "The active query is available regardless of which pane opened the conversation. Keep its source and unrelated layers unless the user asks to change them." : "BLANK WORKSPACE: There is no active query or source. For a visualization request, select every source needed from the catalog and return a complete executable visualization in one turn. Do not inherit another workspace's subject, source, title, or fields."}\nWhen returning an edit, use only these exact source IDs in GGSQL: ${JSON.stringify(allowedSources)}.`;
    const functionTools = createWorkspaceFunctionTools({
      availableSourceIds: allowedSources,
      engineUrl,
      allowDataQueries: body.preferences.dataAccess,
    });
    const modelResponse = await structuredResponse({
      name: "chartize_agent_turn",
      schema: ModelAgentResponseSchema,
      instructions,
      input,
      webSearch: body.preferences.webSearch,
      requiredWebSearch: researchRequired,
      continueAfterRequiredWebSearch: researchRequired && body.preferences.dataAccess,
      // A multi-finding turn keeps the direct pages returned by web search in
      // addition to inline citations. Structured JSON can otherwise retain a
      // single citation even when the web tool consulted several pages.
      sourceSelection: researchRequired && researchTarget > 1 ? "all" : "cited",
      reasoningEffort: complexRequest ? "medium" : "low",
      maxOutputTokens: 9_000,
      cacheKey: "chartize:agent:v4",
      functionTools,
      // A required web search occupies the first response round. Complex
      // edits may then need a warehouse query, one corrected query after an
      // engine diagnostic, and the final structured answer.
      maxToolRounds: answerOnly ? 4 : (complexRequest ? 6 : 4),
    });

    const turnSources = modelResponse.sources;
    const turnResearched = modelResponse.researched;
    const initialUsage = modelResponse.usage;
    const grounded = reconcileGroundedResponse(
      modelResponse.output.explanation,
      modelResponse.output.warnings,
      { researched: turnResearched, sources: turnSources },
    );
    if (modelResponse.output.action === "answer") {
      return NextResponse.json(AiExplanationResponseSchema.parse({
        kind: "explanation",
        explanation: grounded.explanation.replaceAll("?utm_source=openai", ""),
        assumptions: modelResponse.output.assumptions,
        warnings: grounded.warnings,
        sources: turnSources,
        researched: turnResearched,
        usage: initialUsage,
      }));
    }
    if (!modelResponse.output.query.trim()) {
      throw new Error("Chartize AI chose to update the visualization but did not return GGSQL.");
    }

    let generatedQuery = normalizeModelGgsql(modelResponse.output.query);
    let explanation = grounded.explanation;
    let assumptions = modelResponse.output.assumptions;
    let warnings = grounded.warnings;
    let usage = initialUsage;
    let validation = await validateGeneratedQuery(generatedQuery);
    if (!validation.valid) {
      const repairResponse = await structuredResponse({
        name: "ggsql_repair",
        schema: ModelAgentResponseSchema,
        instructions: `You are Chartize AI repairing one rejected visualization. Return action "update_visualization", one corrected complete GGSQL query, the preserved user-facing explanation, assumptions, and warnings.\n\n${GGSQL_GUIDE}\n\nVALIDATOR REPAIR: Treat the engine diagnostics as authoritative. Preserve the user's analytical intent and allowed source IDs. Make the smallest syntax correction. Compute every expression in SELECT, alias it, and use only aliases or supported literal constants in MAPPING. Do not discuss the repair process in the user-facing explanation.`,
        input: [
          ...input,
          { role: "assistant" as const, content: `Candidate GGSQL:\n${generatedQuery}\n\nCandidate explanation:\n${explanation}` },
          { role: "user" as const, content: `The GGSQL validator returned these errors:\n${validation.errors.join("\n")}\n\nReturn the corrected response now.` },
        ],
        webSearch: false,
        reasoningEffort: "medium",
        maxOutputTokens: 9_000,
        cacheKey: "chartize:repair:v2",
      });
      if (repairResponse.output.action !== "update_visualization" || !repairResponse.output.query.trim()) {
        throw new Error("Chartize AI's repair pass did not return corrected GGSQL.");
      }
      generatedQuery = normalizeModelGgsql(repairResponse.output.query);
      explanation = repairResponse.output.explanation || explanation;
      assumptions = repairResponse.output.assumptions;
      warnings = repairResponse.output.warnings;
      usage = aggregateAiUsage(usage, repairResponse.usage);
      validation = await validateGeneratedQuery(generatedQuery);
    }
    if (!validation.valid) {
      throw new Error(`Chartize AI could not produce executable GGSQL after a repair pass: ${validation.errors.join("; ")}`);
    }
    const resultDraft = draftFromGgsql(generatedQuery, allowedSources, source);
    if (!allowedSources.includes(resultDraft.source)) {
      throw new Error(`The generated query did not use an available source.`);
    }
    return NextResponse.json(AiVisualizationResponseSchema.parse({
      kind: "visualization",
      query: generatedQuery,
      draft: resultDraft,
      explanation,
      assumptions,
      warnings,
      sources: turnSources,
      researched: turnResearched,
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

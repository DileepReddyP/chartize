import {
  AiDataRequestResponseSchema,
  AiExplanationResponseSchema,
  AiTurnEnvelopeSchema,
  AiVisualizationResponseSchema,
} from "@chartize/contracts";
import { NextResponse } from "next/server";
import { z } from "zod";
import { compactAiContext, compactHistory, isComplexVisualizationRequest, isExplanationRequest, requestedResearchItemCount, shouldResearch } from "@/lib/ai/context";
import { ModelAgentResponseSchema, draftFromGgsql, normalizeModelGgsql, publicAiError, reconcileGroundedResponse } from "@/lib/ai/model-output";
import { CHARTIZE_AGENT_INSTRUCTIONS, CHARTIZE_AI_INSTRUCTIONS, chartizePreferenceInstructions, chartizeTurnInstructions } from "@/lib/ai/prompts";
import { structuredResponse } from "@/lib/ai/provider";
import { createVisualizationFunctionTools } from "@/lib/ai/workspace-tools";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = AiTurnEnvelopeSchema.parse(await request.json());
    const source = body.source ?? inferSource(body.currentQuery) ?? "";
    const availableSources = body.availableSources.length
      ? body.availableSources
      : source
        ? [{ id: source, title: source, description: "Current source", fields: body.schema }]
        : [];
    const allowedSources = availableSources.map((candidate) => candidate.id);
    const hasCurrentQuery = Boolean(body.currentQuery.trim());
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
    const workspaceDataNotice = body.workspaceData.length
      ? `The browser GGSQL workspace executed your earlier data requests. Columns and rows are positionally aligned. Treat errors as diagnostics and do not repeat a failed request unchanged:\n${JSON.stringify(body.workspaceData)}`
      : body.preferences.dataAccess
        ? "No browser data request has been executed for this turn yet."
        : "Browser data requests are disabled for this turn.";
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
      body.runtimeErrors.length
        ? `Unresolved workspace diagnostics (authoritative; failedQuery is the exact candidate that produced the message):\n${JSON.stringify(body.runtimeErrors)}`
        : "No unresolved workspace diagnostics are attached.",
      researchRequired
        ? `Live research is required for this turn. Find at least ${researchTarget} relevant dated finding${researchTarget === 1 ? "" : "s"}, ground factual claims in direct sources returned by web search, and keep web evidence separate from workspace data.`
        : "Live research is optional for this turn.",
      sampleNotice,
      workspaceDataNotice,
    ].join("\n\n");
    const input = [
      ...compactHistory(body.history).map((message) => ({ role: message.role, content: message.text })),
      { role: "user" as const, content: workspaceTurn },
    ];
    const complexRequest = isComplexVisualizationRequest(body.request, body.currentQuery, body.task);
    const answerOnly = isExplanationRequest(body.request) || /\b(?:do\s+not|don't|without)\s+(?:change|edit|update|modify)(?:ing)?\b/i.test(body.request);
    const agentInstructions = answerOnly && body.task !== "repair" ? CHARTIZE_AGENT_INSTRUCTIONS : CHARTIZE_AI_INSTRUCTIONS;
    const instructions = `${agentInstructions}\n\n${chartizeTurnInstructions(body.context, body.task)}\n${chartizePreferenceInstructions(body.preferences)}\n${researchRequired ? `LIVE RESEARCH: Required in this same agent turn. Search before answering, use at least ${researchTarget} relevant dated finding${researchTarget === 1 ? "" : "s"}, and cite the direct source for every distinct finding rather than letting one citation appear to support unrelated claims. Never claim lookup was unavailable after the tool completes.` : body.preferences.webSearch ? "LIVE RESEARCH: Available but not mandatory. Use it only when outside facts would materially improve this request; do not search for local-data cleanup, syntax repair, chart styling, arithmetic, or a calculation the browser workspace can answer." : "LIVE RESEARCH: Disabled. Do not imply that you searched."}\n${hasCurrentQuery ? "The active query is available regardless of which pane opened the conversation. Keep its source and unrelated layers unless the user asks to change them." : "BLANK WORKSPACE: There is no active query or source. For a visualization request, select every source needed from the catalog and return a complete executable visualization in one turn. Do not inherit another workspace's subject, source, title, or fields."}\nWhen returning an edit or data request, use only these exact source IDs: ${JSON.stringify(allowedSources)}.`;
    const functionTools = createVisualizationFunctionTools();
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
      cacheKey: "chartize:agent:v5",
      functionTools,
      // A required web search can occupy the first response round. Complex
      // drawing work may then consult the compact visualization cookbook.
      maxToolRounds: answerOnly ? 4 : (complexRequest ? 6 : 4),
    });

    if (modelResponse.output.action === "request_data") {
      if (!body.preferences.dataAccess) throw new Error("Chartize AI requested workspace data while data access was disabled.");
      if (!modelResponse.output.dataRequests.length) throw new Error("Chartize AI requested workspace data without providing a query.");
      if (body.workspaceDataRound >= 3) throw new Error("Chartize AI reached its browser-data request limit before completing the turn.");
      return NextResponse.json(AiDataRequestResponseSchema.parse({
        kind: "data_request",
        requests: modelResponse.output.dataRequests,
        usage: modelResponse.usage,
      }));
    }

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

    const generatedQuery = normalizeModelGgsql(modelResponse.output.query);
    const explanation = grounded.explanation;
    const assumptions = modelResponse.output.assumptions;
    const warnings = grounded.warnings;
    const usage = initialUsage;
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

function inferSource(query: string) {
  return query.match(/\bFROM\s+(?:"([^"]+)"|(ggsql:[\w-]+)|([\w-]+))/i)?.slice(1).find(Boolean);
}

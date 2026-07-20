import {
  AiDataRequestResponseSchema,
  AiExplanationResponseSchema,
  AiStreamEventSchema,
  AiTurnEnvelopeSchema,
  AiVisualizationResponseSchema,
  AiWorkspaceActionSchema,
  type AiResponse,
  type AiTurnEnvelope,
  type AiWorkspaceAction,
} from "@chartize/contracts";
import { NextResponse } from "next/server";
import { z } from "zod";
import { compactAiContext, compactHistory, isComplexVisualizationRequest, isExplanationRequest, requestedResearchItemCount, shouldResearch } from "@/lib/ai/context";
import { ModelAgentResponseSchema, draftFromGgsql, normalizeModelGgsql, publicAiError, reconcileGroundedResponse, sanitizeModelText, separateWorkspaceProgram } from "@/lib/ai/model-output";
import { CHARTIZE_AGENT_INSTRUCTIONS, CHARTIZE_AI_INSTRUCTIONS, chartizePreferenceInstructions, chartizeTurnInstructions } from "@/lib/ai/prompts";
import { structuredResponse } from "@/lib/ai/provider";
import { createVisualizationFunctionTools } from "@/lib/ai/workspace-tools";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: AiTurnEnvelope;
  try {
    body = AiTurnEnvelopeSchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json(
      { error: publicAiError(error) },
      { status: error instanceof z.ZodError ? 400 : 503 },
    );
  }

  if (request.headers.get("accept")?.includes("application/x-ndjson")) {
    return streamAiTurn(body);
  }

  try {
    return NextResponse.json(await completeAiTurn(body));
  } catch (error) {
    return NextResponse.json(
      { error: publicAiError(error) },
      { status: error instanceof z.ZodError ? 400 : 503 },
    );
  }
}

async function completeAiTurn(body: AiTurnEnvelope, onProgress?: (message: string) => void): Promise<AiResponse> {
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
    // The web tool can still be available for the model to use when helpful.
    const researchRequested = shouldResearch(body.request, body.preferences.webSearch);
    const researchRequired = researchRequested && !body.researchContext?.researched;
    const webSearchEnabled = body.preferences.webSearch && !body.researchContext?.researched;
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
      body.researchContext
        ? `Live research was completed earlier in this same turn. Do not search again. Continue from this evidence memo and retain its direct sources:\n${body.researchContext.memo}\nSources: ${JSON.stringify(body.researchContext.sources)}`
        : researchRequired
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
    const mutationAuthorized = authorizesLocalMutation(body);
    const agentInstructions = answerOnly && body.task !== "repair" ? CHARTIZE_AGENT_INSTRUCTIONS : CHARTIZE_AI_INSTRUCTIONS;
    const instructions = `${agentInstructions}\n\n${chartizeTurnInstructions(body.context, body.task)}\n${chartizePreferenceInstructions(body.preferences)}\n${mutationAuthorized ? "LOCAL WORKSPACE ACTIONS: The user explicitly authorized a browser-local data change. Put repeatable DDL/DML only in workspaceActions and keep query to one SELECT/WITH plus VISUALISE." : "LOCAL WORKSPACE ACTIONS: Not authorized in this turn. workspaceActions must be empty and query must remain non-mutating."}\n${body.researchContext ? "LIVE RESEARCH: Already completed earlier in this same user turn. Do not invoke or request another search. Use the attached evidence memo and preserve its source grounding while combining it with the new browser-data results." : researchRequired ? `LIVE RESEARCH: Required in this same agent turn. Before searching, identify the smallest distinct set of questions needed; issue the focused queries together in one search action when possible instead of serially searching synonyms. Use at least ${researchTarget} relevant dated finding${researchTarget === 1 ? "" : "s"}, and cite the direct source for every distinct finding rather than letting one citation appear to support unrelated claims. Never claim lookup was unavailable after the tool completes.` : body.preferences.webSearch ? "LIVE RESEARCH: Available but not mandatory. Use it only when outside facts would materially improve this request; do not search for local-data cleanup, syntax repair, chart styling, arithmetic, or a calculation the browser workspace can answer." : "LIVE RESEARCH: Disabled. Do not imply that you searched."}\n${hasCurrentQuery ? "The active query is available regardless of which pane opened the conversation. Keep its source and unrelated layers unless the user asks to change them." : "BLANK WORKSPACE: There is no active query or source. For a visualization request, select every source needed from the catalog and return a complete executable visualization in one turn. Do not inherit another workspace's subject, source, title, or fields."}\nWhen returning an edit or data request, use only these exact source IDs: ${JSON.stringify(allowedSources)}.`;
    const functionTools = createVisualizationFunctionTools();
    const modelResponse = await structuredResponse({
      name: "chartize_agent_turn",
      schema: ModelAgentResponseSchema,
      instructions,
      input,
      webSearch: webSearchEnabled,
      requiredWebSearch: researchRequired,
      maxBuiltInToolCalls: webSearchEnabled ? 1 : undefined,
      continueAfterRequiredWebSearch: researchRequired && complexRequest && !answerOnly,
      // A multi-finding turn keeps the direct pages returned by web search in
      // addition to inline citations. Structured JSON can otherwise retain a
      // single citation even when the web tool consulted several pages.
      sourceSelection: researchRequired && researchTarget > 1 ? "all" : "cited",
      reasoningEffort: "low",
      maxOutputTokens: 9_000,
      cacheKey: "chartize:agent:v8",
      functionTools,
      // A required web search can occupy the first response round. Complex
      // drawing work may then consult the compact visualization cookbook.
      maxToolRounds: answerOnly ? 4 : (complexRequest ? 6 : 4),
      onProgress,
    });

    const turnSources = mergeSources(body.researchContext?.sources ?? [], modelResponse.sources);
    const turnResearched = Boolean(body.researchContext?.researched || modelResponse.researched);
    const initialUsage = modelResponse.usage;

    if (modelResponse.output.action === "request_data") {
      if (!body.preferences.dataAccess) throw new Error("Chartize AI requested workspace data while data access was disabled.");
      if (!modelResponse.output.dataRequests.length) throw new Error("Chartize AI requested workspace data without providing a query.");
      if (body.workspaceDataRound >= 3) throw new Error("Chartize AI reached its browser-data request limit before completing the turn.");
      return AiDataRequestResponseSchema.parse({
        kind: "data_request",
        requests: modelResponse.output.dataRequests,
        researchContext: turnResearched ? {
          researched: true,
          memo: researchMemo(body.researchContext?.memo, modelResponse.output.explanation),
          sources: turnSources,
        } : undefined,
        usage: modelResponse.usage,
      });
    }

    const assumptions = modelResponse.output.assumptions.map(sanitizeModelText).filter(Boolean);
    const grounded = reconcileGroundedResponse(
      modelResponse.output.explanation,
      modelResponse.output.warnings,
      { researched: turnResearched, sources: turnSources },
    );
    const modelWorkspaceActions = body.task === "repair" ? [] : modelResponse.output.workspaceActions;
    if (modelWorkspaceActions.length && !mutationAuthorized) {
      throw new Error("Chartize AI proposed a browser-local data mutation without explicit permission.");
    }
    if (modelResponse.output.action === "answer") {
      return AiExplanationResponseSchema.parse({
        kind: "explanation",
        explanation: grounded.explanation.replaceAll("?utm_source=openai", ""),
        assumptions,
        warnings: grounded.warnings,
        sources: turnSources,
        researched: turnResearched,
        workspaceActions: modelWorkspaceActions,
        usage: initialUsage,
      });
    }
    if (!modelResponse.output.query.trim()) {
      throw new Error("Chartize AI chose to update the visualization but did not return GGSQL.");
    }

    const separated = separateWorkspaceProgram(normalizeModelGgsql(modelResponse.output.query));
    const extractedActions: AiWorkspaceAction[] = separated.setupSql
      ? [{ sql: separated.setupSql, purpose: "Prepare the derived browser-local data used by this visualization." }]
      : [];
    if (extractedActions.length && !mutationAuthorized) {
      throw new Error("Chartize AI placed a browser-local data mutation in the visualization query without explicit permission.");
    }
    const workspaceActions = z.array(AiWorkspaceActionSchema).max(4).parse([
      ...modelWorkspaceActions,
      ...extractedActions,
    ]);
    const generatedQuery = separated.query;
    const explanation = grounded.explanation;
    const warnings = grounded.warnings;
    const usage = initialUsage;
    const resultDraft = draftFromGgsql(generatedQuery, allowedSources, source);
    if (!allowedSources.includes(resultDraft.source)) {
      throw new Error(`The generated query did not use an available source.`);
    }
    return AiVisualizationResponseSchema.parse({
      kind: "visualization",
      query: generatedQuery,
      draft: resultDraft,
      explanation,
      assumptions,
      warnings,
      sources: turnSources,
      researched: turnResearched,
      workspaceActions,
      usage,
    });
}

function authorizesLocalMutation(body: AiTurnEnvelope) {
  const denied = /\b(?:do\s+not|don't|without|no)\b[^.\n]{0,50}\b(?:mutat|persist|modify|overwrite|change)\w*/i;
  const explicit = (text: string) => !denied.test(text) && (
    /\b(?:clean|deduplicate|dedupe|impute|persist|save)\w*\s+(?:this|the|my|that|these|those|a|an)?\s*(?:file|data|dataset|table|values|rows|copy|source)\b/i.test(text)
    || /\b(?:apply|execute|perform|commit|make|do)\b[^.\n]{0,80}\b(?:clean(?:ing|up)?|deduplicat\w*|imput\w*|mutation|local changes?)\b/i.test(text)
    || /\b(?:create|save|persist)\b[^.\n]{0,80}\b(?:cleaned|derived|local|temporary|temp)\b/i.test(text)
  );
  if (explicit(body.request)) return true;
  if (!/^(?:ok(?:ay)?|yes|do it|apply it|go ahead|proceed|finish (?:it|that)|continue)\b/i.test(body.request.trim())) return false;
  return body.history.slice(-6).some((message) => message.role === "user" && explicit(message.text));
}

function streamAiTurn(body: AiTurnEnvelope) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: unknown) => {
        const parsed = AiStreamEventSchema.parse(event);
        controller.enqueue(encoder.encode(`${JSON.stringify(parsed)}\n`));
      };
      void completeAiTurn(body, (message) => send({ type: "progress", message }))
        .then((response) => send({ type: "result", response }))
        .catch((error) => send({ type: "error", error: publicAiError(error) }))
        .finally(() => controller.close());
    },
  });
  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      "x-accel-buffering": "no",
    },
  });
}

function mergeSources(
  ...groups: Array<Array<{ title: string; url: string }>>
) {
  return [...new Map(groups.flat().map((source) => [source.url, source])).values()].slice(0, 6);
}

function researchMemo(previous: string | undefined, current: string) {
  const parts = [previous?.trim(), sanitizeModelText(current)]
    .filter((part): part is string => Boolean(part));
  return [...new Set(parts)].join("\n\n").slice(0, 6000);
}

function inferSource(query: string) {
  return query.match(/\bFROM\s+(?:"([^"]+)"|(ggsql:[\w-]+)|([\w-]+))/i)?.slice(1).find(Boolean);
}

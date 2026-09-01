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
import { compactAiContext, compactHistory, isComplexVisualizationRequest, isExplanationRequest, requestedResearchItemCount } from "@/lib/ai/context";
import { browserDataTurnInstruction, decideBrowserData } from "@/lib/ai/data-policy";
import { authorizesLocalChange } from "@/lib/ai/local-change-policy";
import { ModelAgentResponseSchema, ModelDataRequestResponseSchema, draftFromGgsql, normalizeModelGgsql, publicAiError, reconcileGroundedResponse, sanitizeModelText, separateWorkspaceProgram } from "@/lib/ai/model-output";
import { CHARTIZE_AGENT_INSTRUCTIONS, chartizePreferenceInstructions, chartizeTurnInstructions } from "@/lib/ai/prompts";
import { nextProviderContext, providerContinuation } from "@/lib/ai/provider-context";
import { structuredResponse } from "@/lib/ai/provider";
import { decideResearch, researchTurnInstruction } from "@/lib/ai/research-policy";
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
    ...(body.renderedQuery ? { renderedQuery: body.renderedQuery } : {}),
    request: body.request,
    contextNote: body.contextNote,
    view: body.view,
  });
  const sampleNotice = body.sampleData
    ? `The user explicitly consented to include this labeled data sample (${body.sampleData.rows.length} rows). Columns and row values are aligned by position:\n${JSON.stringify(body.sampleData)}`
    : "No row values were manually shared. Do not infer values from metadata; browser-query access is governed separately below.";
  // Search activation is a server policy, not a suggestion buried in the
  // prompt. This makes the UI toggle predictable while avoiding paid lookups
  // for calculations, drawing, and local diagnostics.
  const researchDecision = decideResearch(body.request, {
    webSearch: body.preferences.webSearch,
    alreadyResearched: Boolean(body.researchContext?.researched),
    history: body.history,
  });
  const researchRequired = researchDecision.mode === "required";
  const webSearchEnabled = researchDecision.mode !== "disabled";
  const researchTarget = requestedResearchItemCount(body.request);
  const browserDataDecision = decideBrowserData(body.request, {
    enabled: body.preferences.dataAccess,
    task: body.task,
    hasQueryableSources: availableSources.length > 0,
    hasWorkspaceData: body.workspaceData.length > 0,
    hasSharedRows: Boolean(body.sampleData?.rows.length),
    history: body.history,
  });
  const workspaceDataNotice = body.workspaceData.length
    ? "The browser GGSQL workspace executed earlier data requests. Preserved model reasoning and the new bounded results follow this workspace snapshot in chronological order."
    : browserDataDecision.mode === "disabled"
      ? "No browser-query results are attached because browser data access is disabled or inapplicable."
      : "No browser-query results are attached yet.";
  const workspaceTurn = [
    `User request: ${body.request}`,
    `Active workspace context: ${body.contextNote || "No narrower cursor or selection context."}`,
    `Rendered view: ${JSON.stringify(body.view ?? { title: "", subtitle: "", sources: [] })}`,
    `Current date: ${new Date().toISOString().slice(0, 10)}`,
    `Available source index: ${JSON.stringify(compactContext.sourceIndex)}`,
    compactContext.omittedSourceCount
      ? `${compactContext.omittedSourceCount} lower-relevance sources were omitted from the compact index; ask the user for a source name if the visible catalog cannot support the request.`
      : "The compact source index includes every available source.",
    `Relevant source schemas: ${JSON.stringify(compactContext.sourceSchemas)}`,
    queryStateNotice(body),
    body.runtimeErrors.length
      ? `Unresolved workspace diagnostics (authoritative; failedQuery is the exact candidate that produced the message):\n${JSON.stringify(body.runtimeErrors)}`
      : "No unresolved workspace diagnostics are attached.",
    body.researchContext
      ? `Live research was completed earlier in this same turn. Do not search again. Continue from this evidence memo and retain its direct sources:\n${body.researchContext.memo}\nSources: ${JSON.stringify(body.researchContext.sources)}`
      : researchRequired
        ? `Live research is required for this turn. Find at least ${researchTarget} relevant dated finding${researchTarget === 1 ? "" : "s"}, ground factual claims in direct sources returned by web search, and keep web evidence separate from workspace data.`
        : researchDecision.mode === "available"
          ? "Live research is available if outside facts are genuinely needed; workspace-only questions do not need it."
          : "Live research is disabled for this turn.",
    sampleNotice,
    workspaceDataNotice,
  ].join("\n\n");
  const continuation = providerContinuation(body.providerContext, body.workspaceData);
  const input = [
    ...compactHistory(body.history).map((message) => ({ role: message.role, content: message.text })),
    { role: "user" as const, content: workspaceTurn },
  ];
  const complexRequest = isComplexVisualizationRequest(body.request, body.currentQuery, body.task);
  const answerOnly = body.task === "explain"
    || isExplanationRequest(body.request)
    || /\b(?:do\s+not|don't|without)\s+(?:change|edit|update|modify)(?:ing)?\b/i.test(body.request);
  const mutationAuthorized = authorizesLocalChange(body);
  const turnInstructions = [
    chartizeTurnInstructions(body.context, body.task),
    chartizePreferenceInstructions(body.preferences),
    mutationAuthorized
      ? "LOCAL WORKSPACE ACTIONS: Explicitly authorized for this turn. Put repeatable DDL/DML only in workspaceActions and keep the visualization query to one SELECT/WITH plus VISUALISE."
      : "LOCAL WORKSPACE ACTIONS: Not authorized. workspaceActions must be empty and the visualization query must remain non-mutating.",
    researchTurnInstruction(researchDecision, researchTarget),
    browserDataTurnInstruction(browserDataDecision),
    hasCurrentQuery
      ? "ACTIVE QUERY: Available regardless of which pane opened the conversation. Preserve its source and unrelated layers unless the user asks to change them."
      : "BLANK WORKSPACE: No active query or source. For a visualization request, choose the needed listed sources and return one complete executable view without inheriting another workspace's subject or fields.",
    `ALLOWED SOURCE IDS: ${JSON.stringify(allowedSources)}`,
  ].join("\n");
  const functionTools = createVisualizationFunctionTools();
  const forceBrowserData = browserDataDecision.mode === "required" && body.workspaceData.length === 0;
  const modelResponse = await structuredResponse({
    name: forceBrowserData ? "chartize_agent_data_request" : "chartize_agent_turn",
    schema: forceBrowserData ? ModelDataRequestResponseSchema : ModelAgentResponseSchema,
    stableInstructions: CHARTIZE_AGENT_INSTRUCTIONS,
    turnInstructions,
    input,
    continuationInput: continuation.input,
    webSearch: webSearchEnabled,
    allowFunctionTools: !answerOnly || body.task === "repair",
    requiredWebSearch: researchRequired,
    ...(webSearchEnabled ? { maxBuiltInToolCalls: 1 } : {}),
    continueAfterRequiredWebSearch: researchRequired && complexRequest && !answerOnly,
    // A multi-finding turn keeps the direct pages returned by web search in
    // addition to inline citations. Structured JSON can otherwise retain a
    // single citation even when the web tool consulted several pages.
    sourceSelection: researchRequired && researchTarget > 1 ? "all" : "cited",
    reasoningEffort: "low",
    maxOutputTokens: 6_000,
    cacheKey: "chartize:agent:v10",
    functionTools,
    // Required research may occupy the first response, followed by one
    // cookbook call and a final structured answer. Keep a single spare round.
    maxToolRounds: answerOnly ? 1 : 3,
    ...(onProgress ? { onProgress } : {}),
  });

  const turnSources = mergeSources(body.researchContext?.sources ?? [], modelResponse.sources);
  const turnResearched = Boolean(body.researchContext?.researched || modelResponse.researched);
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
      providerContext: nextProviderContext(continuation.context, body.workspaceData.length, modelResponse.reasoningItems),
      usage: modelResponse.usage,
    });
  }

  const assumptions = modelResponse.output.assumptions.map(sanitizeModelText).filter(Boolean);
  const grounded = reconcileGroundedResponse(
    modelResponse.output.explanation,
    modelResponse.output.warnings,
    { researched: turnResearched, sources: turnSources },
  );
  const localChangeApproval = (message: string, actions: AiWorkspaceAction[] = []) => (
    AiExplanationResponseSchema.parse({
      kind: "explanation",
      approval: "local_changes",
      explanation: [
        grounded.explanation.replaceAll("?utm_source=openai", ""),
        message,
        actions.length
          ? `Proposed local action${actions.length === 1 ? "" : "s"}:\n${actions.map((action) => `- ${action.purpose}`).join("\n")}`
          : "",
      ].filter(Boolean).join("\n\n"),
      assumptions,
      warnings: grounded.warnings,
      sources: turnSources,
      researched: turnResearched,
      workspaceActions: [],
      usage: modelResponse.usage,
    })
  );
  const modelWorkspaceActions = body.task === "repair" ? [] : modelResponse.output.workspaceActions;
  if (modelWorkspaceActions.length && !mutationAuthorized) {
    return localChangeApproval(
      "I prepared a browser-local data change but did not apply it. Enable **allow local changes once** beside **redo**, then retry. You can also grant the same one-send permission from the gear beside Send. The raw upload and every `chartize:` source remain unchanged.",
      modelWorkspaceActions,
    );
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
      usage: modelResponse.usage,
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
    return localChangeApproval(
      "This visualization needs a derived browser-local data change, so I stopped before applying it. Enable **allow local changes once** beside **redo**, then retry. You can also grant the same one-send permission from the gear beside Send. The raw upload and every `chartize:` source remain unchanged.",
    );
  }
  const workspaceActions = z.array(AiWorkspaceActionSchema).max(4).parse([
    ...modelWorkspaceActions,
    ...extractedActions,
  ]);
  const generatedQuery = separated.query;
  const resultDraft = draftFromGgsql(generatedQuery, allowedSources, source);
  if (!allowedSources.includes(resultDraft.source)) {
    throw new Error(`The generated query did not use an available source.`);
  }
  return AiVisualizationResponseSchema.parse({
    kind: "visualization",
    query: generatedQuery,
    draft: resultDraft,
    explanation: grounded.explanation,
    assumptions,
    warnings: grounded.warnings,
    sources: turnSources,
    researched: turnResearched,
    workspaceActions,
    usage: modelResponse.usage,
  });
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

function queryStateNotice(body: AiTurnEnvelope) {
  if (body.queryStatus === "blank") {
    return "QUERY STATE: The editor is blank and there is no rendered GGSQL for this workspace.";
  }
  if (body.queryStatus === "rendered") {
    return `QUERY STATE: The current editor GGSQL produced the rendered view.\nCurrent and rendered GGSQL:\n${body.currentQuery}`;
  }
  const rendered = body.renderedQuery?.trim()
    ? `\nLast successfully rendered GGSQL:\n${body.renderedQuery}`
    : "\nNo earlier successfully rendered GGSQL is available.";
  if (body.queryStatus === "failed") {
    return `QUERY STATE: The current editor GGSQL failed and did not produce the visible view. Use its runtime diagnostic for repair; use the last successfully rendered GGSQL only to explain the still-visible chart.\nFailed editor GGSQL:\n${body.currentQuery}${rendered}`;
  }
  return `QUERY STATE: The editor has changes that have not produced the visible view. Use the current editor for requested code changes and the last successfully rendered GGSQL for claims about the chart.\nCurrent edited GGSQL:\n${body.currentQuery}${rendered}`;
}

function inferSource(query: string) {
  return query.match(/\bFROM\s+(?:"([^"]+)"|(ggsql:[\w-]+)|([\w-]+))/i)?.slice(1).find(Boolean);
}

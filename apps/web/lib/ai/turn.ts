import "server-only";

import { AiExplanationResponseSchema, AiVisualizationResponseSchema, type AiResponse, type AiTurnEnvelope } from "@chartize/contracts";
import { ModelAgentResponseSchema, draftFromGgsql, normalizeModelGgsql, sanitizeModelText, separateWorkspaceProgram } from "./model-output";
import { CHARTIZE_AGENT_INSTRUCTIONS, chartizeTurnInstructions } from "./prompts";
import { structuredResponse } from "./provider";
import { initialTurnInput, recordTool, requestBrowserData, restoreTurn } from "./turn-state";
import { createTurnTools, turnPolicy } from "./turn-tools";
import { resolveDataRequest } from "./data-requests";

/** Runs one agent conversation, resuming its context when browser-local data is requested. */
export async function completeAiTurn(body: AiTurnEnvelope, options: {
  owner: string;
  signal?: AbortSignal;
  onProgress?: (message: string) => void;
}): Promise<AiResponse> {
  const state = restoreTurn(body, options.owner);
  if (state.modelCalls >= 10) throw new Error("Chartize AI reached its turn limit. Try a more focused question.");
  const result = await structuredResponse({
    name: "chartize_agent_turn", schema: ModelAgentResponseSchema,
    stableInstructions: CHARTIZE_AGENT_INSTRUCTIONS,
    turnInstructions: chartizeTurnInstructions(state.body),
    input: initialTurnInput(state), resumeInput: state.input,
    functionTools: createTurnTools(state, options.onProgress, options.signal),
    policy: () => turnPolicy(state),
    maxToolRounds: Math.min(6, 9 - state.modelCalls), cacheKey: "chartize:agent:v13",
    onWebSearch: () => { state.webUsed = true; recordTool(state, "web_search"); },
    onToolCall: (name) => recordTool(state, name),
    safetyIdentifier: options.owner, signal: options.signal, onProgress: options.onProgress,
  });
  state.modelCalls += result.usage.calls;
  result.sources.forEach((source) => state.sources.set(source.url, source));
  state.input = result.continuationInput;
  const output = result.output;
  const base = {
    explanation: sanitizeModelText(output.explanation),
    assumptions: output.assumptions.map(sanitizeModelText).filter(Boolean),
    warnings: output.warnings.map(sanitizeModelText).filter(Boolean),
    sources: [...state.sources.values()].filter((source) => state.articles.has(source.url) || output.citations.some((url) => citationKey(url) === citationKey(source.url)) || output.explanation.includes(source.url)).slice(0, 8),
    researched: state.webUsed || state.sources.size > 0,
    activity: state.activity, usage: result.usage,
  };
  if (output.approval) return AiExplanationResponseSchema.parse({ ...base, kind: "explanation", approval: output.approval, workspaceActions: [] });
  if (output.action === "request_data") {
    options.signal?.throwIfAborted();
    return requestBrowserData(state, output.dataRequests.map((request) => resolveDataRequest(request, state.body)), output.includeSelection, result.usage);
  }

  const separated = output.action === "update_visualization"
    ? separateWorkspaceProgram(normalizeModelGgsql(output.query))
    : { query: "", setupSql: "" };
  const actions = [...output.workspaceActions, ...(separated.setupSql ? [{ sql: separated.setupSql, purpose: "Prepare derived browser-local data for this view." }] : [])];
  if (actions.length && (state.body.task === "repair" || (!output.localChangesAuthorized && !state.body.approvedFeatures?.includes("local_changes")))) {
    return AiExplanationResponseSchema.parse({
      ...base, kind: "explanation", approval: "local_changes", workspaceActions: [],
      explanation: "May I apply the needed change to a derived table in this browser workspace?",
    });
  }
  if (actions.length) recordTool(state, "local_changes");
  if (output.action === "answer") return AiExplanationResponseSchema.parse({ ...base, kind: "explanation", workspaceActions: actions });
  if (!separated.query.trim()) throw new Error("Chartize AI did not return a visualization query.");
  const allowedSources = state.body.availableSources.map((source) => source.id);
  const draft = draftFromGgsql(separated.query, allowedSources, state.body.source);
  if (!allowedSources.includes(draft.source)) throw new Error("The visualization did not use an available source.");
  return AiVisualizationResponseSchema.parse({ ...base, kind: "visualization", query: separated.query, draft, workspaceActions: actions });
}

function citationKey(value: string) {
  try { const url = new URL(value); return decodeURIComponent(`${url.origin}${url.pathname}`).replaceAll(" ", "_"); }
  catch { return value; }
}

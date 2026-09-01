import {
  AiResponseSchema,
  AiStreamEventSchema,
  AiTurnEnvelopeSchema,
  AiUsageSchema,
  AiWorkspaceDataResultSchema,
  type AiResearchContext,
  type AiProviderContext,
  type AiResponse,
  type AiTurnRequest,
  type AiUsage,
  type AiWorkspaceAction,
  type AiWorkspaceDataResult,
} from "@chartize/contracts";
import { executeWorkspaceSqlRaw } from "./workspace-engine";
import { prepareWorkerQuery, type WorkerProgressEmitter } from "./worker-source-registry";

const AI_URL = "/api/ai/query";
const AI_TIMEOUT_MS = 180_000;

async function requestStreamedAiTurn(
  payload: unknown,
  id: string,
  emit: WorkerProgressEmitter,
): Promise<AiResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
  try {
    const response = await fetch(AI_URL, {
      method: "POST",
      headers: {
        accept: "application/x-ndjson",
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!response.ok) {
      const responseBody: unknown = await response.json().catch(() => null);
      throw new Error(errorMessage(responseBody));
    }
    if (!response.headers.get("content-type")?.includes("application/x-ndjson")) {
      const responseBody: unknown = await response.json();
      if (typeof responseBody === "object" && responseBody !== null && "error" in responseBody) {
        throw new Error(errorMessage(responseBody));
      }
      return AiResponseSchema.parse(responseBody);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("Chartize AI returned an empty response stream.");
    const decoder = new TextDecoder();
    let buffer = "";
    let result: AiResponse | null = null;
    const consume = (line: string) => {
      if (!line.trim()) return;
      const event = AiStreamEventSchema.parse(JSON.parse(line));
      if (event.type === "progress") {
        emit(id, { phase: "thinking", message: event.message });
      } else if (event.type === "error") {
        throw new Error(event.error);
      } else {
        result = event.response;
      }
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      lines.forEach(consume);
    }
    buffer += decoder.decode();
    consume(buffer);
    if (!result) throw new Error("Chartize AI finished without returning a result.");
    return result;
  } catch (error) {
    if (controller.signal.aborted) throw new Error("The Chartize AI request timed out.");
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function errorMessage(value: unknown) {
  return typeof value === "object" && value !== null && "error" in value && typeof value.error === "string"
    ? value.error
    : "AI request failed.";
}

function mergeUsage(current: AiUsage | null, next: AiUsage): AiUsage {
  if (!current) return next;
  return AiUsageSchema.parse({
    models: [...new Set([...current.models, ...next.models])],
    calls: current.calls + next.calls,
    inputTokens: current.inputTokens + next.inputTokens,
    cachedInputTokens: current.cachedInputTokens + next.cachedInputTokens,
    cacheWriteTokens: current.cacheWriteTokens + next.cacheWriteTokens,
    outputTokens: current.outputTokens + next.outputTokens,
    reasoningTokens: current.reasoningTokens + next.reasoningTokens,
    totalTokens: current.totalTokens + next.totalTokens,
  });
}

async function executeAiDataRequest(
  workspaceId: string,
  request: { sql: string; purpose: string; limit: number },
  id: string,
  emit: WorkerProgressEmitter,
) {
  try {
    const query = await prepareWorkerQuery(workspaceId, request.sql, id, emit);
    const result = await executeWorkspaceSqlRaw(workspaceId, query);
    const rows = result.rows
      .slice(0, request.limit)
      .map((row) => row.slice(0, 100).map((value) => String(value).slice(0, 1000)));
    return AiWorkspaceDataResultSchema.parse({
      sql: request.sql,
      purpose: request.purpose,
      columns: result.columns.slice(0, 100),
      rows,
      returnedRows: rows.length,
      truncated: result.truncated || result.total_rows > rows.length || result.rows.length > rows.length,
    });
  } catch (error) {
    return AiWorkspaceDataResultSchema.parse({
      sql: request.sql,
      purpose: request.purpose,
      columns: [],
      rows: [],
      returnedRows: 0,
      truncated: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

function assertSafeWorkspaceAction(sql: string) {
  if (/\bVISUALI[ZS]E\b/i.test(sql)) throw new Error("A one-time workspace action cannot contain VISUALISE.");
  if (!/\b(?:CREATE\s+(?:TEMP(?:ORARY)?\s+)?TABLE|DROP\s+TABLE|INSERT\s+INTO|UPDATE|DELETE\s+FROM|ALTER\s+TABLE)\b/i.test(sql)) {
    throw new Error("A workspace action must contain an explicit local SQL change.");
  }
  if (/\b(?:COPY|ATTACH|DETACH|INSTALL|LOAD|VACUUM)\b/i.test(sql) || /(?:https?:\/\/|file:|\/Users\/|\.\.\/)/i.test(sql)) {
    throw new Error("A workspace action cannot access extensions, URLs, or the filesystem.");
  }
  const protectedTarget = /\b(?:CREATE\s+(?:TEMP(?:ORARY)?\s+)?TABLE(?:\s+IF\s+NOT\s+EXISTS)?|DROP\s+TABLE(?:\s+IF\s+EXISTS)?|INSERT\s+INTO|UPDATE|DELETE\s+FROM|ALTER\s+TABLE)\s+(?:"|`|\[)?(?:chartize:|user:|__chartize_|__user_)/i;
  if (protectedTarget.test(sql)) {
    throw new Error("A workspace action must write to a derived local table, not a catalog source or raw upload.");
  }
}

async function executeWorkspaceActions(
  workspaceId: string,
  actions: AiWorkspaceAction[],
  id: string,
  emit: WorkerProgressEmitter,
) {
  for (const [index, action] of actions.entries()) {
    emit(id, {
      phase: "querying",
      message: `applying browser-local data change… ${index + 1}/${actions.length}`,
    });
    assertSafeWorkspaceAction(action.sql);
    const query = await prepareWorkerQuery(workspaceId, action.sql, id, emit);
    assertSafeWorkspaceAction(query);
    try {
      await executeWorkspaceSqlRaw(workspaceId, query);
    } catch (error) {
      throw new Error(`${action.purpose}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

export async function completeWorkerAiTurn(
  workspaceId: string,
  input: AiTurnRequest,
  id: string,
  emit: WorkerProgressEmitter,
) {
  const workspaceData: AiWorkspaceDataResult[] = [];
  let researchContext: AiResearchContext | undefined;
  let providerContext: AiProviderContext | undefined;
  let accumulatedUsage: AiUsage | null = null;
  for (let workspaceDataRound = 0; workspaceDataRound <= 3; workspaceDataRound += 1) {
    emit(id, { phase: "thinking", message: workspaceDataRound ? "checking the data…" : "thinking…" });
    const payload = AiTurnEnvelopeSchema.parse({ ...input, workspaceDataRound, workspaceData, researchContext, providerContext });
    const parsed = await requestStreamedAiTurn(payload, id, emit);
    accumulatedUsage = mergeUsage(accumulatedUsage, parsed.usage);
    if (parsed.kind !== "data_request") {
      await executeWorkspaceActions(workspaceId, parsed.workspaceActions, id, emit);
      return { ...parsed, usage: accumulatedUsage };
    }
    if (!input.preferences.dataAccess) throw new Error("Chartize AI requested workspace data while data access was disabled.");
    researchContext = parsed.researchContext ?? researchContext;
    providerContext = parsed.providerContext ?? providerContext;
    workspaceData.push(...await Promise.all(
      parsed.requests.map((request) => executeAiDataRequest(workspaceId, request, id, emit)),
    ));
  }
  throw new Error("Chartize AI did not finish after three browser-data rounds.");
}

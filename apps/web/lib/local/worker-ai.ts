import {
  AiResponseSchema,
  AiStreamEventSchema,
  AiTurnEnvelopeSchema,
  AiUsageSchema,
  AiWorkspaceDataResultSchema,
  type AiResponse,
  type AiTurnRequest,
  type AiUsage,
  type AiWorkspaceAction,
  type AiWorkspaceDataResult,
} from "@chartize/contracts";
import { executeWorkspaceReadOnlySqlRaw, executeWorkspaceSqlRaw } from "./workspace-engine";
import { isResultSqlStatement, sqlStatements } from "../ggsql/query-context";
import { prepareWorkerQuery, type WorkerProgressEmitter } from "./worker-source-registry";
import { assertSafeWorkspaceAction } from "./ai-sql-safety";

const AI_URL = "/api/ai/query";
const AI_TIMEOUT_MS = 300_000;

async function requestStreamedAiTurn(
  payload: unknown,
  id: string,
  emit: WorkerProgressEmitter,
  profileId: string,
): Promise<AiResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
  try {
    const response = await fetch(AI_URL, {
      method: "POST",
      headers: {
        accept: "application/x-ndjson",
        "content-type": "application/json",
        "x-chartize-profile": profileId,
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
    if (sqlStatements(request.sql).length !== 1 || !isResultSqlStatement(request.sql)
      || /\b(?:PRAGMA|ATTACH|DETACH|load_extension|writefile|readfile)\b/i.test(request.sql)) {
      throw new Error("AI data inspection requires one read-only SELECT or WITH query.");
    }
    const query = await prepareWorkerQuery(workspaceId, request.sql, id, emit);
    const result = await executeWorkspaceReadOnlySqlRaw(workspaceId, query);
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
  profileId = "anonymous",
) {
  const workspaceData: AiWorkspaceDataResult[] = [];
  let turnId: string | undefined;
  let includeSelection = false;
  let accumulatedUsage: AiUsage | null = null;
  for (let workspaceDataRound = 0; workspaceDataRound <= 3; workspaceDataRound += 1) {
    emit(id, { phase: "thinking", message: workspaceDataRound ? "checking the data…" : "thinking…" });
    const payload = AiTurnEnvelopeSchema.parse({
      ...input, turnId, workspaceData,
      sampleData: includeSelection ? input.sampleData : undefined,
      selection: input.sampleData ? { columns: input.sampleData.columns, rowCount: input.sampleData.rows.length } : undefined,
    });
    const parsed = await requestStreamedAiTurn(payload, id, emit, profileId);
    accumulatedUsage = mergeUsage(accumulatedUsage, parsed.usage);
    if (parsed.kind !== "data_request") {
      if (parsed.workspaceActions.length && !parsed.plan?.localChanges) throw new Error("The current plan did not authorize local data changes.");
      await executeWorkspaceActions(workspaceId, parsed.workspaceActions, id, emit);
      return { ...parsed, usage: accumulatedUsage };
    }
    if (parsed.requests.length && !parsed.plan.queryData) throw new Error("The current plan did not authorize workspace queries.");
    if (parsed.includeSelection && (!parsed.plan.shareSelection || !input.sampleData)) throw new Error("The selected rows are not available for this plan.");
    if (workspaceDataRound === 3) throw new Error("Chartize AI reached its browser-data limit.");
    turnId = parsed.turnId;
    includeSelection = parsed.includeSelection;
    workspaceData.length = 0;
    // SQLite is shared by this worker; keep these requests in order.
    for (const request of parsed.requests) workspaceData.push(await executeAiDataRequest(workspaceId, request, id, emit));
  }
  throw new Error("Chartize AI did not finish after three browser-data rounds.");
}

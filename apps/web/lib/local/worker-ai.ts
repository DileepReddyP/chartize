import {
  AiResponseSchema,
  AiTurnEnvelopeSchema,
  AiUsageSchema,
  AiWorkspaceDataResultSchema,
  type AiTurnRequest,
  type AiUsage,
} from "@chartize/contracts";
import { executeWorkspaceSqlRaw } from "./workspace-engine";
import { fetchWithDeadline } from "./worker-network";
import { prepareWorkerQuery, type WorkerProgressEmitter } from "./worker-source-registry";

const AI_URL = "/api/ai/query";
const AI_TIMEOUT_MS = 180_000;

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

export async function completeWorkerAiTurn(
  workspaceId: string,
  input: AiTurnRequest,
  id: string,
  emit: WorkerProgressEmitter,
) {
  const workspaceData = [];
  let accumulatedUsage: AiUsage | null = null;
  for (let workspaceDataRound = 0; workspaceDataRound <= 3; workspaceDataRound += 1) {
    emit(id, { phase: "thinking", message: workspaceDataRound ? "checking the data…" : "thinking…" });
    const payload = AiTurnEnvelopeSchema.parse({ ...input, workspaceDataRound, workspaceData });
    const response = await fetchWithDeadline(AI_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    }, AI_TIMEOUT_MS);
    const responseBody: unknown = await response.json();
    if (!response.ok || (typeof responseBody === "object" && responseBody !== null && "error" in responseBody)) {
      throw new Error(typeof responseBody === "object" && responseBody !== null && "error" in responseBody && typeof responseBody.error === "string"
        ? responseBody.error
        : "AI request failed.");
    }
    const parsed = AiResponseSchema.parse(responseBody);
    accumulatedUsage = mergeUsage(accumulatedUsage, parsed.usage);
    if (parsed.kind !== "data_request") return { ...parsed, usage: accumulatedUsage };
    if (!input.preferences.dataAccess) throw new Error("Chartize AI requested workspace data while data access was disabled.");
    workspaceData.push(...await Promise.all(
      parsed.requests.map((request) => executeAiDataRequest(workspaceId, request, id, emit)),
    ));
  }
  throw new Error("Chartize AI did not finish after three browser-data rounds.");
}

/// <reference lib="webworker" />

import { completeWorkerAiTurn } from "@/lib/local/worker-ai";
import { listLocalDatasets, loadStoredWorkspace, saveStoredWorkspace } from "@/lib/local/worker-database";
import {
  describeWorkerSource,
  loadWorkerCatalog,
  prefetchWorkerSources,
  prepareWorkerQuery,
  registerWorkerLocalSource,
  releaseWorkerWorkspace,
  removeWorkerLocalSource,
} from "@/lib/local/worker-source-registry";
import {
  executeWorkspaceGgsql,
  executeWorkspaceSqlRaw,
  setSpatialiteExtensionUrl,
  workspaceEngine,
} from "@/lib/local/workspace-engine";
import {
  BrowserBootstrapSchema,
  BrowserStoredWorkspaceSchema,
  BrowserWorkspaceLoadSchema,
  LocalWorkerRequestSchema,
  type BrowserEngineProgress,
  type LocalWorkerMessage,
  type LocalWorkerRequest,
  type LocalWorkerResponse,
} from "@/lib/local/worker-protocol";

function emitProgress(id: string, progress: BrowserEngineProgress) {
  const message: LocalWorkerMessage = { type: "progress", id, progress };
  self.postMessage(message);
}

async function handle(request: LocalWorkerRequest): Promise<unknown> {
  switch (request.type) {
    case "init": {
      setSpatialiteExtensionUrl(request.spatialiteUrl);
      emitProgress(request.id, { phase: "starting", message: "preparing your data…" });
      const [engine, datasets, localDatasets] = await Promise.all([
        workspaceEngine(request.workspaceId),
        loadWorkerCatalog(request.id, emitProgress),
        listLocalDatasets(),
      ]);
      return BrowserBootstrapSchema.parse({ tables: engine.list_tables(), catalog: datasets, localDatasets });
    }
    case "register":
      return registerWorkerLocalSource(request, emitProgress);
    case "run":
      emitProgress(request.id, { phase: "querying", message: "building visualization…" });
      return executeWorkspaceGgsql(
        request.workspaceId,
        await prepareWorkerQuery(request.workspaceId, request.query, request.id, emitProgress),
      );
    case "sql":
      emitProgress(request.id, { phase: "querying", message: "querying data…" });
      return executeWorkspaceSqlRaw(
        request.workspaceId,
        await prepareWorkerQuery(request.workspaceId, request.query, request.id, emitProgress),
      );
    case "describe":
      return describeWorkerSource(request.workspaceId, request.name, request.id, emitProgress);
    case "save-workspace":
      emitProgress(request.id, { phase: "saving", message: "saving workspace…" });
      await saveStoredWorkspace(BrowserStoredWorkspaceSchema.parse(request.workspace));
      return { saved: true };
    case "load-workspace":
      return BrowserWorkspaceLoadSchema.parse({
        workspace: await loadStoredWorkspace(request.workspaceId),
        localDatasets: await listLocalDatasets(),
      });
    case "close-workspace":
      releaseWorkerWorkspace(request.workspaceId);
      return { released: true };
    case "remove-local-source":
      return removeWorkerLocalSource(request.name);
    case "ai":
      return completeWorkerAiTurn(request.workspaceId, request.request, request.id, emitProgress);
    case "prefetch":
      await prefetchWorkerSources(request.workspaceId, request.sources, request.id, emitProgress);
      return { ready: true };
  }
}

self.onmessage = async (event: MessageEvent<unknown>) => {
  const parsed = LocalWorkerRequestSchema.safeParse(event.data);
  if (!parsed.success) {
    const id = typeof event.data === "object" && event.data && "id" in event.data && typeof event.data.id === "string"
      ? event.data.id
      : crypto.randomUUID();
    const response: LocalWorkerResponse = { type: "response", id, ok: false, error: "The browser worker received an invalid command." };
    self.postMessage(response);
    return;
  }
  const request = parsed.data;
  let response: LocalWorkerResponse;
  try {
    response = { type: "response", id: request.id, ok: true, data: await handle(request) };
  } catch (error) {
    response = { type: "response", id: request.id, ok: false, error: error instanceof Error ? error.message : String(error) };
  }
  self.postMessage(response);
};

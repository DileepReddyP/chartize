import type { AiTurnRequest } from "@chartize/contracts";
import {
  BrowserAiCompletedResponseSchema,
  BrowserBootstrapSchema,
  BrowserLocalDatasetListSchema,
  BrowserRegistrationResultSchema,
  BrowserSqlResultSchema,
  BrowserVisualizationSpecSchema,
  BrowserWorkspaceLoadSchema,
  LocalWorkerMessageSchema,
  type BrowserEngineProgress,
  type BrowserStoredWorkspace,
  type LocalFormat,
  type LocalWorkerRequest,
} from "./worker-protocol";

type Pending = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};
type RequestWithoutId = LocalWorkerRequest extends infer Request
  ? Request extends LocalWorkerRequest ? Omit<Request, "id"> : never
  : never;

const QUICK_TIMEOUT_MS = 20_000;
const DATA_TIMEOUT_MS = 90_000;
const AI_TIMEOUT_MS = 210_000;

export class LocalEngineClient {
  private worker: Worker;
  private pending = new Map<string, Pending>();
  private progressHandler: ((progress: BrowserEngineProgress) => void) | undefined;
  private alive = true;

  constructor() {
    this.worker = new Worker(new URL("../../workers/ggsql.worker.ts", import.meta.url), { type: "module" });
    this.worker.onmessage = (event: MessageEvent<unknown>) => {
      const parsed = LocalWorkerMessageSchema.safeParse(event.data);
      if (!parsed.success) {
        this.stop(new Error("The browser worker returned an invalid message."));
        return;
      }
      const message = parsed.data;
      if (message.type === "progress") {
        if (this.pending.has(message.id)) this.progressHandler?.(message.progress);
        return;
      }
      const pending = this.pending.get(message.id);
      if (!pending) return;
      clearTimeout(pending.timer);
      this.pending.delete(message.id);
      if (message.ok) pending.resolve(message.data);
      else pending.reject(new Error(message.error));
    };
    this.worker.onerror = (event) => {
      this.stop(new Error(event.message || "The browser data worker stopped unexpectedly."));
    };
  }

  setProgressHandler(handler: ((progress: BrowserEngineProgress) => void) | undefined) {
    this.progressHandler = handler;
  }

  private stop(error: Error) {
    if (!this.alive) return;
    this.alive = false;
    this.worker.terminate();
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pending.clear();
  }

  private request<T>(request: RequestWithoutId, timeoutMs: number, transfer: Transferable[] = []): Promise<T> {
    if (!this.alive) return Promise.reject(new Error("The browser data worker is unavailable. Reload the workspace to restart it."));
    const id = crypto.randomUUID();
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.stop(new Error("The browser data worker timed out and was stopped safely. Reload the workspace to restart it."));
      }, timeoutMs);
      this.pending.set(id, { resolve: resolve as (value: unknown) => void, reject, timer });
      this.worker.postMessage({ ...request, id } as LocalWorkerRequest, transfer);
    });
  }

  init(workspaceId: string, spatialiteUrl: string) {
    return this.request<unknown>({ type: "init", workspaceId, spatialiteUrl }, QUICK_TIMEOUT_MS)
      .then((value) => BrowserBootstrapSchema.parse(value));
  }

  register(workspaceId: string, name: string, format: LocalFormat, data: ArrayBuffer, file: { name: string; type: string; size: number }) {
    return this.request<unknown>({ type: "register", workspaceId, name, format, data, file }, DATA_TIMEOUT_MS, [data])
      .then((value) => BrowserRegistrationResultSchema.parse(value));
  }

  run(workspaceId: string, query: string) {
    return this.request<unknown>({ type: "run", workspaceId, query }, DATA_TIMEOUT_MS)
      .then((value) => BrowserVisualizationSpecSchema.parse(value));
  }

  sql(workspaceId: string, query: string) {
    return this.request<unknown>({ type: "sql", workspaceId, query }, DATA_TIMEOUT_MS)
      .then((value) => BrowserSqlResultSchema.parse(value));
  }

  describe(workspaceId: string, name: string) {
    return this.request<unknown>({ type: "describe", workspaceId, name }, DATA_TIMEOUT_MS)
      .then((value) => BrowserSqlResultSchema.parse(value));
  }

  saveWorkspace(workspace: BrowserStoredWorkspace) {
    return this.request<unknown>({ type: "save-workspace", workspace }, QUICK_TIMEOUT_MS);
  }

  loadWorkspace(workspaceId: string) {
    return this.request<unknown>({ type: "load-workspace", workspaceId }, QUICK_TIMEOUT_MS)
      .then((value) => BrowserWorkspaceLoadSchema.parse(value));
  }

  closeWorkspace(workspaceId: string) {
    return this.request<unknown>({ type: "close-workspace", workspaceId }, QUICK_TIMEOUT_MS);
  }

  removeLocalSource(name: string) {
    return this.request<unknown>({ type: "remove-local-source", name }, QUICK_TIMEOUT_MS)
      .then((value) => BrowserLocalDatasetListSchema.parse(value));
  }

  requestAi(workspaceId: string, request: AiTurnRequest) {
    return this.request<unknown>({ type: "ai", workspaceId, request }, AI_TIMEOUT_MS)
      .then((value) => BrowserAiCompletedResponseSchema.parse(value));
  }

  prefetch(workspaceId: string, sources: string[]) {
    return this.request<unknown>({ type: "prefetch", workspaceId, sources }, DATA_TIMEOUT_MS);
  }

  destroy() {
    this.stop(new Error("The browser data worker was stopped."));
  }
}

import type { LocalFormat, LocalWorkerRequest, LocalWorkerResponse } from "./worker-protocol";
import { assertReadOnlyGgsql } from "../ggsql/query-context";

type Pending = { resolve: (value: unknown) => void; reject: (error: Error) => void };
type RequestWithoutId = LocalWorkerRequest extends infer Request
  ? Request extends LocalWorkerRequest ? Omit<Request, "id"> : never
  : never;

export class LocalEngineClient {
  private worker: Worker;
  private pending = new Map<string, Pending>();

  constructor() {
    this.worker = new Worker(new URL("../../workers/ggsql.worker.ts", import.meta.url), { type: "module" });
    this.worker.onmessage = (event: MessageEvent<LocalWorkerResponse>) => {
      const response = event.data;
      const pending = this.pending.get(response.id);
      if (!pending) return;
      this.pending.delete(response.id);
      if (response.ok) pending.resolve(response.data);
      else pending.reject(new Error(response.error));
    };
    this.worker.onerror = (event) => {
      for (const pending of this.pending.values()) pending.reject(new Error(event.message || "Local GGSQL worker crashed."));
      this.pending.clear();
    };
  }

  private request<T>(request: RequestWithoutId, transfer: Transferable[] = []): Promise<T> {
    const id = crypto.randomUUID();
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (value: unknown) => void, reject });
      this.worker.postMessage({ ...request, id } as LocalWorkerRequest, transfer);
    });
  }

  init(spatialiteUrl: string) {
    return this.request<{ tables: string[] }>({ type: "init", spatialiteUrl });
  }

  register(name: string, format: LocalFormat, data: ArrayBuffer) {
    return this.request<{ name: string; tables: string[] }>({ type: "register", name, format, data }, [data]);
  }

  run<T = Record<string, unknown>>(query: string) {
    assertReadOnlyGgsql(query);
    return this.request<T>({ type: "run", query });
  }

  sql(query: string) {
    return this.request<{ columns: string[]; rows: string[][]; total_rows: number; truncated: boolean }>({ type: "sql", query });
  }

  describe(name: string) {
    return this.request<{ columns: string[]; rows: string[][]; total_rows: number; truncated: boolean }>({ type: "describe", name });
  }

  destroy() {
    this.worker.terminate();
    this.pending.clear();
  }
}

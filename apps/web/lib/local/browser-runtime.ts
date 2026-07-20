import { AiTurnRequestSchema, type AiTurnRequest } from "@chartize/contracts";
import { z } from "zod";
import { LocalEngineClient } from "./engine-client";
import {
  BrowserStoredWorkspaceSchema,
  LocalFormatSchema,
  type BrowserEngineProgress,
  type BrowserStoredWorkspace,
  type LocalFormat,
} from "./worker-protocol";

const WorkspaceIdSchema = z.string().min(1).max(200);
const QuerySchema = z.string().max(100_000);
const SourceNameSchema = z.string().min(1).max(200);
const SourceFileSchema = z.object({
  name: z.string().min(1).max(500),
  type: z.string().max(300),
  size: z.number().int().nonnegative().max(100 * 1024 * 1024),
});

let client: LocalEngineClient | null = null;
let initialization: Promise<Awaited<ReturnType<LocalEngineClient["init"]>>> | null = null;
let progressHandler: ((progress: BrowserEngineProgress) => void) | undefined;

function engine() {
  if (!client) throw new Error("The browser data engine has not initialized.");
  return client;
}

function ensureClient() {
  if (!client) {
    client = new LocalEngineClient();
    client.setProgressHandler(progressHandler);
  }
  return client;
}

export function setBrowserRuntimeProgressHandler(handler: ((progress: BrowserEngineProgress) => void) | undefined) {
  progressHandler = handler;
  client?.setProgressHandler(handler);
}

export async function initializeBrowserRuntime(workspaceId: string, spatialiteUrl: string) {
  const parsedWorkspaceId = WorkspaceIdSchema.parse(workspaceId);
  const url = z.string().min(1).max(2000).parse(spatialiteUrl);
  const runtime = ensureClient();
  if (!initialization) initialization = runtime.init(parsedWorkspaceId, url);
  try {
    return await initialization;
  } catch (error) {
    runtime.destroy();
    client = null;
    initialization = null;
    throw error;
  }
}

export function registerBrowserSource(
  workspaceId: string,
  name: string,
  format: LocalFormat,
  data: ArrayBuffer,
  file: { name: string; type: string; size: number },
) {
  if (!(data instanceof ArrayBuffer)) throw new Error("A browser source must be registered from an ArrayBuffer.");
  return engine().register(
    WorkspaceIdSchema.parse(workspaceId),
    SourceNameSchema.parse(name),
    LocalFormatSchema.parse(format),
    data,
    SourceFileSchema.parse(file),
  );
}

export function describeBrowserSource(workspaceId: string, name: string) {
  return engine().describe(WorkspaceIdSchema.parse(workspaceId), SourceNameSchema.parse(name));
}

export function executeWorkspaceSql(workspaceId: string, query: string) {
  return engine().sql(WorkspaceIdSchema.parse(workspaceId), QuerySchema.parse(query));
}

export function runWorkspaceGgsql(workspaceId: string, query: string) {
  return engine().run(WorkspaceIdSchema.parse(workspaceId), QuerySchema.parse(query));
}

export function saveBrowserWorkspace(workspace: BrowserStoredWorkspace) {
  return engine().saveWorkspace(BrowserStoredWorkspaceSchema.parse(workspace));
}

export function loadBrowserWorkspace(workspaceId = "current") {
  return engine().loadWorkspace(WorkspaceIdSchema.parse(workspaceId));
}

export function releaseBrowserWorkspace(workspaceId: string) {
  return engine().closeWorkspace(WorkspaceIdSchema.parse(workspaceId));
}

export function removeBrowserSource(name: string) {
  return engine().removeLocalSource(SourceNameSchema.parse(name));
}

export function requestBrowserAiTurn(workspaceId: string, request: AiTurnRequest) {
  return engine().requestAi(WorkspaceIdSchema.parse(workspaceId), AiTurnRequestSchema.parse(request));
}

export function prefetchBrowserSources(workspaceId: string, sources: string[]) {
  return engine().prefetch(
    WorkspaceIdSchema.parse(workspaceId),
    z.array(z.string().min(1).max(300)).max(10).parse(sources),
  );
}

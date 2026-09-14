import {
  AiExplanationResponseSchema,
  AiProgressMessageSchema,
  AiTurnRequestSchema,
  AiVisualizationResponseSchema,
  DatasetManifestSchema,
  FieldMetadataSchema,
  GgsqlDraftSchema,
} from "@chartize/contracts";
import { z } from "zod";

export const LocalFormatSchema = z.enum([
  "csv",
  "tsv",
  "parquet",
  "geoparquet",
  "json",
  "ndjson",
  "geojson",
  "shapefile",
]);
export type LocalFormat = z.infer<typeof LocalFormatSchema>;

export const BrowserSqlResultSchema = z.object({
  columns: z.array(z.string()),
  rows: z.array(z.array(z.string())),
  total_rows: z.number().int().nonnegative(),
  truncated: z.boolean(),
});

export const BrowserLocalDatasetSchema = z.object({
  id: z.string(),
  title: z.string(),
  tableName: z.string(),
  description: z.string(),
  spatial: z.boolean(),
  fields: z.array(FieldMetadataSchema),
  fileName: z.string().optional(),
});

export const BrowserBootstrapSchema = z.object({
  tables: z.array(z.string()),
  catalog: z.array(DatasetManifestSchema),
  localDatasets: z.array(BrowserLocalDatasetSchema),
});

export const BrowserRegistrationResultSchema = z.object({
  dataset: BrowserLocalDatasetSchema,
  tables: z.array(z.string()),
});
export const BrowserVisualizationSpecSchema = z.record(z.string(), z.unknown());

const LegacyBrowserStoredWorkspaceSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  query: z.string().max(100_000),
  draft: GgsqlDraftSchema,
  savedAt: z.string(),
});
export const BrowserWorkspaceSessionRecordSchema = z.object({
  id: z.literal("session"),
  payload: z.string().max(20_000_000),
  savedAt: z.string(),
});
export const BrowserStoredWorkspaceSchema = z.union([
  BrowserWorkspaceSessionRecordSchema,
  LegacyBrowserStoredWorkspaceSchema,
]);
export const BrowserWorkspaceLoadSchema = z.object({
  workspace: BrowserStoredWorkspaceSchema.nullable(),
  localDatasets: z.array(BrowserLocalDatasetSchema),
});
export const BrowserLocalDatasetListSchema = z.object({
  localDatasets: z.array(BrowserLocalDatasetSchema),
});

export const BrowserAiCompletedResponseSchema = z.discriminatedUnion("kind", [
  AiExplanationResponseSchema,
  AiVisualizationResponseSchema,
]);

export const BrowserEngineProgressSchema = z.object({
  phase: z.enum(["starting", "catalog", "loading", "downloading", "registering", "querying", "thinking", "saving"]),
  message: AiProgressMessageSchema,
  source: z.string().max(300).optional(),
  loaded: z.number().int().nonnegative().optional(),
  total: z.number().int().positive().optional(),
});

export type BrowserSqlResult = z.infer<typeof BrowserSqlResultSchema>;
export type BrowserLocalDataset = z.infer<typeof BrowserLocalDatasetSchema>;
export type BrowserBootstrap = z.infer<typeof BrowserBootstrapSchema>;
export type BrowserStoredWorkspace = z.infer<typeof BrowserStoredWorkspaceSchema>;
export type BrowserWorkspaceLoad = z.infer<typeof BrowserWorkspaceLoadSchema>;
export type BrowserAiCompletedResponse = z.infer<typeof BrowserAiCompletedResponseSchema>;
export type BrowserEngineProgress = z.infer<typeof BrowserEngineProgressSchema>;

const WorkerRequestBase = { id: z.string().min(1) };
export const BrowserProfileIdSchema = z.string().max(2048).refine((value) => value === "anonymous" || /^did:[a-z]+:[\w.:%-]+$/.test(value), "Invalid profile");
const WorkerWorkspaceIdSchema = z.string().min(1).max(200);
const WorkerSourceNameSchema = z.string().min(1).max(200);
const WorkerQuerySchema = z.string().max(100_000);

export const LocalWorkerRequestSchema = z.discriminatedUnion("type", [
  z.object({ ...WorkerRequestBase, type: z.literal("init"), workspaceId: WorkerWorkspaceIdSchema, spatialiteUrl: z.string().min(1).max(2000), profileId: BrowserProfileIdSchema.default("anonymous") }),
  z.object({
    ...WorkerRequestBase,
    type: z.literal("register"),
    workspaceId: WorkerWorkspaceIdSchema,
    name: WorkerSourceNameSchema,
    format: LocalFormatSchema,
    data: z.instanceof(ArrayBuffer),
    file: z.object({
      name: z.string().min(1).max(500),
      type: z.string().max(300),
      size: z.number().int().nonnegative().max(100 * 1024 * 1024),
    }),
  }),
  z.object({ ...WorkerRequestBase, type: z.literal("run"), workspaceId: WorkerWorkspaceIdSchema, query: WorkerQuerySchema }),
  z.object({ ...WorkerRequestBase, type: z.literal("sql"), workspaceId: WorkerWorkspaceIdSchema, query: WorkerQuerySchema }),
  z.object({ ...WorkerRequestBase, type: z.literal("describe"), workspaceId: WorkerWorkspaceIdSchema, name: WorkerSourceNameSchema }),
  z.object({ ...WorkerRequestBase, type: z.literal("save-workspace"), workspace: BrowserStoredWorkspaceSchema }),
  z.object({ ...WorkerRequestBase, type: z.literal("adopt-workspace"), profileId: BrowserProfileIdSchema, workspace: BrowserWorkspaceSessionRecordSchema }),
  z.object({ ...WorkerRequestBase, type: z.literal("load-workspace"), workspaceId: WorkerWorkspaceIdSchema }),
  z.object({ ...WorkerRequestBase, type: z.literal("close-workspace"), workspaceId: WorkerWorkspaceIdSchema }),
  z.object({ ...WorkerRequestBase, type: z.literal("remove-local-source"), name: WorkerSourceNameSchema }),
  z.object({ ...WorkerRequestBase, type: z.literal("ai"), workspaceId: WorkerWorkspaceIdSchema, request: AiTurnRequestSchema }),
  z.object({ ...WorkerRequestBase, type: z.literal("prefetch"), workspaceId: WorkerWorkspaceIdSchema, sources: z.array(z.string().min(1).max(300)).max(10) }),
]);

export type LocalWorkerRequest = z.infer<typeof LocalWorkerRequestSchema>;

export type LocalWorkerResponse =
  | { type: "response"; id: string; ok: true; data: unknown }
  | { type: "response"; id: string; ok: false; error: string };

export type LocalWorkerProgress = {
  type: "progress";
  id: string;
  progress: BrowserEngineProgress;
};

export type LocalWorkerMessage = LocalWorkerResponse | LocalWorkerProgress;

export const LocalWorkerMessageSchema = z.union([
  z.object({
    type: z.literal("progress"),
    id: z.string(),
    progress: BrowserEngineProgressSchema,
  }),
  z.discriminatedUnion("ok", [
    z.object({ type: z.literal("response"), id: z.string(), ok: z.literal(true), data: z.unknown() }),
    z.object({ type: z.literal("response"), id: z.string(), ok: z.literal(false), error: z.string() }),
  ]),
]);

import {
  AiResponsePreferencesSchema,
  AiRuntimeErrorSchema,
  AiTurnRequestSchema,
  AiUsageSchema,
  DatasetManifestSchema,
  FieldMetadataSchema,
  GgsqlDraftSchema,
  TablePreviewSchema,
  type DatasetManifest,
  type FieldMetadata,
  type GgsqlDraft,
  type TablePreview,
  type AiUsage,
  type AiResponsePreferences,
  type AiRuntimeError,
  type AiTurnRequest,
} from "@chartize/contracts";
import { z } from "zod";
import { create } from "zustand";
import {
  addSelectedExpression,
  collapseSingleSourceProjection,
  finalSqlStatement,
  isResultSqlStatement,
  removeProjectionAlias,
  removeSelectedProjection,
  replaceQuerySources,
  selectedProjectionLabels,
  sourceAlias,
  sourceFromQuery,
  sourcesFromQuery,
  splitGgsql,
  updateFirstVisual,
  type VisualPointState,
} from "../ggsql/query-context";
import { makeBlankDraft, makeDefaultDraft, serializeDraft } from "../ggsql/serialize";
import {
  executeWorkspaceSql as runtimeExecuteWorkspaceSql,
  initializeBrowserRuntime,
  loadBrowserWorkspace,
  registerBrowserSource as runtimeRegisterBrowserSource,
  releaseBrowserWorkspace,
  removeBrowserSource,
  requestBrowserAiTurn,
  runWorkspaceGgsql,
  saveBrowserWorkspace,
  setBrowserRuntimeProgressHandler,
} from "../local/browser-runtime";
import { detectFormat, tableNameFromFile } from "../local/file-format";
import type { BrowserAiCompletedResponse, BrowserSqlResult } from "../local/worker-protocol";
import {
  MapFeatureSelectionSchema,
  presentationFromSpec,
  previewFromSpec,
  type MapFeatureSelection,
} from "./chart-data";

export type ResultTab = "chart" | "selected";
export type TableSort = { column: string; direction: "asc" | "desc" } | null;
export type FocusArea = "code" | "chart" | "table";
export type AiPlacement = "left" | "right";
export type AiContext = "code" | "chart" | "general";
export type AiPhase = "idle" | "activating" | "active";
export type EngineState = "loading" | "ready" | "error";

export type WorkspaceRunResult = { ok: true } | { ok: false; error: string };

export const LocalDatasetSchema = z.object({
  id: z.string(),
  title: z.string(),
  tableName: z.string(),
  description: z.string(),
  spatial: z.boolean(),
  fields: z.array(FieldMetadataSchema),
  fileName: z.string().optional(),
});

const EditorContextSchema = z.object({
  section: z.enum(["sql", "visual", "selection"]),
  selectedText: z.string(),
  offset: z.number().int().nonnegative(),
  left: z.number(),
  top: z.number(),
});

const InlineAnchorsSchema = z.object({
  select: z.object({ left: z.number(), top: z.number() }),
  from: z.object({ left: z.number(), top: z.number() }),
});

const GridSelectionSchema = z.object({ columns: z.array(z.string()), rows: z.array(z.array(z.string())), summary: z.string() });
const ChartSelectionSchema = z.object({
  pixels: z.object({ x0: z.number(), y0: z.number(), x1: z.number(), y1: z.number() }),
  x: z.tuple([z.unknown(), z.unknown()]).optional(),
  y: z.tuple([z.unknown(), z.unknown()]).optional(),
});
const DomainSchema = z.tuple([z.unknown(), z.unknown()]);
const ChartDomainsSchema = z.object({ x: DomainSchema.optional(), y: DomainSchema.optional() });
const MapViewportSchema = z.object({
  zoom: z.number().min(0.5).max(8),
  panX: z.number().min(-4).max(4),
  panY: z.number().min(-4).max(4),
});
const AiMessageSchema = z.object({ role: z.enum(["user", "assistant"]), text: z.string() });
const AiOpenInputSchema = z.object({
  contextNote: z.string().max(4000),
  placement: z.enum(["left", "right"]),
  context: z.enum(["code", "chart", "general"]),
});
export { AiResponsePreferencesSchema, AiTurnRequestSchema };
export type { AiResponsePreferences };
const LeftPaneRatioSchema = z.number().min(0.3).max(0.7);
const CodePaneRatioSchema = z.number().min(0.32).max(0.72);
const EditorFontSizeSchema = z.number().int().min(10).max(24);
const FocusAreaSchema = z.enum(["code", "chart", "table"]);

export const WorkspaceDocumentSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  createdAt: z.string(),
  draft: GgsqlDraftSchema,
  query: z.string(),
  dockSource: z.string(),
  resultTab: z.enum(["chart", "selected"]),
  fullSort: z.object({ column: z.string(), direction: z.enum(["asc", "desc"]) }).nullable(),
  gridSelection: GridSelectionSchema.nullable(),
  selectionOrigin: z.enum(["dock", "result"]),
  chartSelection: ChartSelectionSchema.nullable(),
  chartDomains: ChartDomainsSchema,
  chartDomainHistory: z.array(ChartDomainsSchema).max(20),
  mapViewport: MapViewportSchema,
  mapFeatureSelections: z.array(MapFeatureSelectionSchema).max(24).default([]),
  focusArea: FocusAreaSchema,
  editorFontSize: EditorFontSizeSchema,
  aiPlacement: z.enum(["left", "right"]),
  aiContext: z.enum(["code", "chart", "general"]),
  aiContextNote: z.string(),
  aiPrompt: z.string(),
  aiMessage: z.string(),
  aiHistory: z.array(AiMessageSchema),
  aiUsage: AiUsageSchema.nullable(),
  includeSamples: z.boolean(),
  aiPreferences: AiResponsePreferencesSchema,
  runtimeErrors: z.array(AiRuntimeErrorSchema).max(8).default([]),
});

export const WorkspaceSessionSchema = z.object({
  version: z.literal(1),
  activeWorkspaceId: z.string().min(1),
  workspaceDocuments: z.array(WorkspaceDocumentSchema).min(1).max(40),
  leftPaneRatio: LeftPaneRatioSchema,
  codePaneRatio: CodePaneRatioSchema,
}).superRefine((session, context) => {
  if (!session.workspaceDocuments.some((document) => document.id === session.activeWorkspaceId)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "The active workspace is missing from the saved session.", path: ["activeWorkspaceId"] });
  }
});

export type LocalDataset = z.infer<typeof LocalDatasetSchema>;
export type EditorContext = z.infer<typeof EditorContextSchema>;
export type InlineControlAnchors = z.infer<typeof InlineAnchorsSchema>;
export type GridSelectionState = z.infer<typeof GridSelectionSchema>;
export type ChartSelectionState = z.infer<typeof ChartSelectionSchema>;
export type ChartDomainsState = z.infer<typeof ChartDomainsSchema>;
export type MapViewportState = z.infer<typeof MapViewportSchema>;
export type MapFeatureSelectionState = MapFeatureSelection;
export type AiConversationMessage = z.infer<typeof AiMessageSchema>;
export type AiCompletedResponse = BrowserAiCompletedResponse;
export type WorkspaceDocument = z.infer<typeof WorkspaceDocumentSchema>;
export type VisualPointUpdate = Partial<VisualPointState>;
export interface NewWorkspaceInput {
  title?: string;
  draft?: GgsqlDraft;
  query?: string;
  dockSource?: string;
}

const AiSubmissionSchema = AiTurnRequestSchema.omit({
  currentQuery: true,
  request: true,
  preferences: true,
  history: true,
  runtimeErrors: true,
}).extend({
  requestOverride: z.string().max(4000).optional(),
  retryAssistantIndex: z.number().int().nonnegative().optional(),
});
type AiSubmission = z.infer<typeof AiSubmissionSchema>;

export const WorkspaceShareStateSchema = z.object({
  query: z.string().optional(),
  draft: GgsqlDraftSchema.optional(),
});

const BrowserFileSchema = z.custom<File>(
  (value) => typeof File !== "undefined" && value instanceof File,
  "Expected a browser File.",
);

const VISUAL_POINT_KEYS = new Set<keyof VisualPointState>([
  "mark", "x", "y", "xEnd", "yEnd", "xMin", "xMax", "yMin", "yMax", "slope",
  "color", "fill", "size", "shape", "linetype", "linewidth", "opacityField", "weight", "geometry",
  "opacity", "position", "colourLegendValue", "fillLegendValue", "fixedColour", "fixedFill", "fixedSize",
  "fixedLinewidth", "fixedLinetype", "aggregate", "smoothMethod", "smoothAdjust", "smoothBandwidth",
  "smoothKernel", "scaleXType", "scaleXTransform", "scaleXFormat", "scaleYType", "scaleYTransform",
  "scaleYFormat", "scaleColorType", "scaleColorPalette", "facet", "facetBy", "facetFree", "facetColumns",
  "project", "projectTarget", "title", "subtitle", "labelX", "labelY", "labelColor", "labelFill",
  "labelSize", "labelShape", "labelLinetype", "labelLinewidth", "labelOpacity",
]);

const VisualPointUpdateSchema = z.record(z.string(), z.string()).superRefine((value, context) => {
  Object.keys(value).forEach((key) => {
    if (!VISUAL_POINT_KEYS.has(key as keyof VisualPointState)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: `Unknown visualization field: ${key}`, path: [key] });
    }
  });
});

export const WorkspaceSnapshotSchema = z.object({
  activeWorkspaceId: z.string().min(1),
  workspaceDocuments: z.array(WorkspaceDocumentSchema).min(1),
  engineState: z.enum(["loading", "ready", "error"]),
  catalogLoaded: z.boolean(),
  localDatasets: z.array(LocalDatasetSchema),
  catalogDatasets: z.array(DatasetManifestSchema),
  draft: GgsqlDraftSchema,
  query: z.string(),
  spec: z.record(z.string(), z.unknown()).nullable(),
  selectedData: TablePreviewSchema,
  resultRelation: TablePreviewSchema,
  fullData: TablePreviewSchema,
  resultTab: z.enum(["chart", "selected"]),
  fullSort: z.object({ column: z.string(), direction: z.enum(["asc", "desc"]) }).nullable(),
  dockSource: z.string(),
  running: z.boolean(),
  fullLoading: z.boolean(),
  showLoadingMask: z.boolean(),
  error: z.string(),
  duration: z.number().nonnegative(),
  editorContext: EditorContextSchema.nullable(),
  dwimStatus: z.string(),
  inlineAnchors: InlineAnchorsSchema.nullable(),
  gridSelection: GridSelectionSchema.nullable(),
  selectionOrigin: z.enum(["dock", "result"]),
  chartSelection: ChartSelectionSchema.nullable(),
  chartDomains: ChartDomainsSchema,
  chartDomainHistory: z.array(ChartDomainsSchema).max(20),
  mapViewport: MapViewportSchema,
  mapFeatureSelections: z.array(MapFeatureSelectionSchema).max(24).default([]),
  resultStatus: z.string(),
  focusArea: FocusAreaSchema,
  editorFontSize: EditorFontSizeSchema,
  editorFocusVersion: z.number().int().nonnegative(),
  aiOpen: z.boolean(),
  aiPhase: z.enum(["idle", "activating", "active"]),
  aiPlacement: z.enum(["left", "right"]),
  aiContext: z.enum(["code", "chart", "general"]),
  aiContextNote: z.string(),
  aiPrompt: z.string(),
  aiBusy: z.boolean(),
  aiMessage: z.string(),
  aiHistory: z.array(AiMessageSchema),
  aiUsage: AiUsageSchema.nullable(),
  aiFocusVersion: z.number().int().nonnegative(),
  includeSamples: z.boolean(),
  aiPreferences: AiResponsePreferencesSchema,
  runtimeErrors: z.array(AiRuntimeErrorSchema).max(8),
  leftPaneRatio: LeftPaneRatioSchema,
  codePaneRatio: CodePaneRatioSchema,
});

export type WorkspaceSnapshot = z.infer<typeof WorkspaceSnapshotSchema>;

export const EMPTY_TABLE: TablePreview = { columns: [], rows: [], totalRows: 0, offset: 0, limit: 100 };
const RESULT_RELATION_LIMIT = 10_000;
const EMPTY_RESULT_RELATION: TablePreview = { ...EMPTY_TABLE, limit: RESULT_RELATION_LIMIT };

const BUILTIN_FIELDS: FieldMetadata[] = [
  { name: "species", dataType: "VARCHAR", nullable: false, semanticType: "dimension" },
  { name: "island", dataType: "VARCHAR", nullable: false, semanticType: "dimension" },
  { name: "bill_len", dataType: "DOUBLE", nullable: true, semanticType: "measure" },
  { name: "bill_dep", dataType: "DOUBLE", nullable: true, semanticType: "measure" },
  { name: "flipper_len", dataType: "DOUBLE", nullable: true, semanticType: "measure" },
  { name: "body_mass", dataType: "DOUBLE", nullable: true, semanticType: "measure" },
  { name: "sex", dataType: "VARCHAR", nullable: true, semanticType: "dimension" },
  { name: "year", dataType: "INTEGER", nullable: true, semanticType: "temporal" },
];

export const BUILTIN_DATASETS: LocalDataset[] = [{
  id: "builtin-penguins",
  title: "GGSQL sample · Penguins",
  tableName: "ggsql:penguins",
  description: "Embedded engine sample.",
  spatial: false,
  fields: BUILTIN_FIELDS,
}];

export function makeInitialWorkspaceDraft() {
  const draft = makeDefaultDraft("chartize:presidential_approval_average");
  draft.layers = [{ ...draft.layers[0]!, mark: "line", x: "end_date", y: "approve", color: "", fill: "", size: "" }];
  draft.title = "Presidential approval, daily average";
  draft.subtitle = "daily national average · second presidential term";
  draft.tooltipFields = ["end_date", "approve", "disapprove"];
  draft.scales = [{ aesthetic: "x", type: "", palette: "", transform: "date", labelFormat: "%B %-d, %Y" }];
  draft.axisLabels = { ...draft.axisLabels, x: "Poll Date", y: "Approval" };
  return draft;
}

type Updater<T> = T | ((current: T) => T);
const resolve = <T>(next: Updater<T>, current: T) => typeof next === "function" ? (next as (value: T) => T)(current) : next;

const WorkspaceQuerySchema = z.string().max(100_000);
let browserRunSequence = 0;
let scheduledRun: ReturnType<typeof setTimeout> | null = null;
let loadingMaskTimer: ReturnType<typeof setTimeout> | null = null;
let fullTableSequence = 0;
let lastPersistedSession = "";
const fullTableCache = new Map<string, TablePreview>();
const RESULT_RELATION_PAGE_SIZE = 100;

function addRuntimeError(current: AiRuntimeError[], next: AiRuntimeError) {
  const parsed = AiRuntimeErrorSchema.parse(next);
  return [...current.filter((item) =>
    item.stage !== parsed.stage || item.message !== parsed.message || item.failedQuery !== parsed.failedQuery
  ), parsed].slice(-8);
}

function withoutRuntimeStage(current: AiRuntimeError[], stage: AiRuntimeError["stage"]) {
  return current.filter((item) => item.stage !== stage);
}

function quoteIdentifier(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

function quoteLocalSource(value: string) {
  return /^(?:ggsql|chartize|user):/.test(value) ? value : quoteIdentifier(value);
}

function remember<K, V>(cache: Map<K, V>, key: K, value: V, maximum: number) {
  cache.delete(key);
  cache.set(key, value);
  while (cache.size > maximum) cache.delete(cache.keys().next().value!);
}

function encodeShareState(value: unknown) {
  const parsed = WorkspaceShareStateSchema.parse(value);
  const bytes = new TextEncoder().encode(JSON.stringify(parsed));
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function draftForDataset(source: string, dataset: LocalDataset | DatasetManifest) {
  const nextSource = z.string().min(1).max(300).parse(source);
  const parsedDataset = "version" in dataset
    ? DatasetManifestSchema.parse(dataset)
    : LocalDatasetSchema.parse(dataset);
  const draft = makeDefaultDraft(nextSource);
  draft.tooltipFields = [];
  const fields = parsedDataset.fields;
  if (parsedDataset.spatial) {
    draft.layers = [{
      ...draft.layers[0]!,
      mark: "spatial",
      x: "",
      y: "",
      color: "",
      fill: "",
      size: "",
      geometry: fields.find((field) => field.semanticType === "geometry")?.name ?? "geometry",
    }];
    draft.title = parsedDataset.title;
    draft.subtitle = parsedDataset.description || "Map extent fitted to every returned geometry.";
    return draft;
  }
  const measures = fields.filter((field) => /int|double|float|decimal|number/i.test(field.dataType));
  const temporal = fields.find((field) => field.semanticType === "temporal" || /date|time|year/i.test(field.name));
  const dimensions = fields.filter((field) => !measures.includes(field) && field !== temporal && field.semanticType !== "identifier");
  const approval = fields.find((field) => field.name === "approve");
  draft.layers[0] = temporal && (approval || measures[0])
    ? { ...draft.layers[0]!, mark: "line", x: temporal.name, y: (approval ?? measures[0])!.name, color: "", fill: "", size: "" }
    : { ...draft.layers[0]!, x: dimensions[0]?.name ?? measures[0]?.name ?? "", y: measures[0]?.name ?? measures[1]?.name ?? "", color: dimensions[1]?.name ?? "", fill: "", size: "" };
  draft.title = parsedDataset.title;
  draft.subtitle = parsedDataset.description;
  draft.tooltipFields = [draft.layers[0]!.x, draft.layers[0]!.y].filter(Boolean);
  if (approval && temporal?.name === "end_date") {
    draft.scales = [{ aesthetic: "x", type: "", palette: "", transform: "date", labelFormat: "%B %-d, %Y" }];
    draft.axisLabels = { ...draft.axisLabels, x: "Poll Date", y: "Approval" };
  }
  return draft;
}

export function mergeAiUsage(current: AiUsage | null, next: AiUsage): AiUsage {
  if (!current) return next;
  return {
    models: [...new Set([...current.models, ...next.models])],
    calls: current.calls + next.calls,
    inputTokens: current.inputTokens + next.inputTokens,
    cachedInputTokens: current.cachedInputTokens + next.cachedInputTokens,
    cacheWriteTokens: current.cacheWriteTokens + next.cacheWriteTokens,
    outputTokens: current.outputTokens + next.outputTokens,
    reasoningTokens: current.reasoningTokens + next.reasoningTokens,
    totalTokens: current.totalTokens + next.totalTokens,
  };
}

interface ChartizeWorkspaceState extends WorkspaceSnapshot {
  initializeBrowserEngine: (spatialiteUrl: string) => Promise<void>;
  executeWorkspaceSql: (query: string) => Promise<BrowserSqlResult>;
  runQuery: (query?: string) => Promise<WorkspaceRunResult>;
  scheduleQueryRun: (query: string) => void;
  editQuery: (query: string) => void;
  runEditorQuery: (query: string) => Promise<WorkspaceRunResult>;
  applyDataset: (source: string, dataset: LocalDataset | DatasetManifest, autoRun?: boolean) => void;
  toggleSource: (source: string, enabled: boolean) => void;
  addLocalFiles: (files: File[]) => Promise<LocalDataset[]>;
  removeLocalSource: (tableName: string) => Promise<void>;
  updateQueryImmediately: (query: string) => void;
  toggleColumn: (source: string, field: FieldMetadata, enabled: boolean) => void;
  removeColumn: (field: string) => void;
  updateVisual: (update: VisualPointUpdate) => void;
  editChartLabel: (kind: "title" | "subtitle", value: string) => void;
  loadFullTable: (source: string, offset?: number, sort?: TableSort, append?: boolean) => Promise<void>;
  sortFullTable: (column: string) => void;
  loadMoreFullTable: () => Promise<void>;
  addColumnFromTable: (column: string) => void;
  selectChartRegion: (selection: ChartSelectionState | null) => void;
  selectMapFeature: (selection: MapFeatureSelectionState | null, additive?: boolean) => void;
  requestAiTurn: (request: AiTurnRequest) => Promise<AiCompletedResponse>;
  submitAiTurn: (submission: AiSubmission) => Promise<void>;
  persistWorkspaceSession: () => Promise<void>;
  restoreWorkspaceSession: () => Promise<boolean>;
  shareWorkspace: () => Promise<void>;
  openWorkspace: (input?: NewWorkspaceInput) => void;
  switchWorkspace: (id: string) => void;
  closeWorkspace: (id: string) => void;
  setDraft: (value: Updater<GgsqlDraft>) => void;
  setQuery: (value: string) => void;
  setResultTab: (value: ResultTab) => void;
  setDockSource: (value: Updater<string>) => void;
  setRunning: (value: boolean) => void;
  setError: (value: string) => void;
  setEditorContext: (value: EditorContext | null) => void;
  setDwimStatus: (value: string) => void;
  setInlineAnchors: (value: InlineControlAnchors | null) => void;
  setGridSelection: (value: GridSelectionState | null) => void;
  setSelectionOrigin: (value: "dock" | "result") => void;
  setChartSelection: (value: ChartSelectionState | null) => void;
  setChartDomains: (value: ChartDomainsState) => void;
  zoomChart: (value: ChartDomainsState) => void;
  zoomChartOut: () => void;
  resetChartZoom: () => void;
  zoomMap: (factor: number) => void;
  panMap: (horizontal: number, vertical: number) => void;
  resetMapViewport: () => void;
  setMapFeatureSelections: (value: MapFeatureSelectionState[]) => void;
  setResultStatus: (value: string) => void;
  setFocusArea: (value: FocusArea) => void;
  setEditorFontSize: (value: number) => void;
  setAiOpen: (value: boolean) => void;
  setAiPhase: (value: AiPhase) => void;
  setAiPlacement: (value: AiPlacement) => void;
  setAiContext: (value: AiContext) => void;
  setAiContextNote: (value: string) => void;
  setAiPrompt: (value: string) => void;
  setAiBusy: (value: boolean) => void;
  setAiMessage: (value: string) => void;
  setAiHistory: (value: Updater<AiConversationMessage[]>) => void;
  setAiUsage: (value: AiUsage | null) => void;
  setIncludeSamples: (value: boolean) => void;
  setAiPreferences: (value: AiResponsePreferences) => void;
  openAi: (input: { contextNote: string; placement: AiPlacement; context: AiContext }) => void;
  setLeftPaneRatio: (value: number) => void;
  setCodePaneRatio: (value: number) => void;
  startNewVisualization: () => void;
  closeAi: () => void;
}

const initialDraft = makeInitialWorkspaceDraft();
const initialQuery = serializeDraft(initialDraft);
const DEFAULT_AI_PREFERENCES: AiResponsePreferences = { hypothesize: true, webSearch: true, dataAccess: true, concise: true, challenge: false, technical: false };
const initialWorkspaceDocument = WorkspaceDocumentSchema.parse({
  id: "workspace-1",
  title: initialDraft.title || "Presidential approval, daily average",
  createdAt: "initial",
  draft: initialDraft,
  query: initialQuery,
  dockSource: "chartize:presidential_approval_average",
  resultTab: "chart",
  fullSort: null,
  gridSelection: null,
  selectionOrigin: "result",
  chartSelection: null,
  chartDomains: {},
  chartDomainHistory: [],
  mapViewport: { zoom: 1, panX: 0, panY: 0 },
  mapFeatureSelections: [],
  focusArea: "chart",
  editorFontSize: 13,
  aiPlacement: "left",
  aiContext: "general",
  aiContextNote: "chart and current query",
  aiPrompt: "",
  aiMessage: "",
  aiHistory: [],
  aiUsage: null,
  includeSamples: false,
  aiPreferences: DEFAULT_AI_PREFERENCES,
  runtimeErrors: [],
});

const initialSnapshot = WorkspaceSnapshotSchema.parse({
  activeWorkspaceId: initialWorkspaceDocument.id,
  workspaceDocuments: [initialWorkspaceDocument],
  engineState: "loading",
  catalogLoaded: false,
  localDatasets: BUILTIN_DATASETS,
  catalogDatasets: [],
  draft: initialDraft,
  query: initialQuery,
  spec: null,
  selectedData: { ...EMPTY_TABLE, limit: 200 },
  resultRelation: EMPTY_RESULT_RELATION,
  fullData: EMPTY_TABLE,
  resultTab: "chart",
  fullSort: null,
  dockSource: "chartize:presidential_approval_average",
  running: false,
  fullLoading: false,
  showLoadingMask: false,
  error: "",
  duration: 0,
  editorContext: null,
  dwimStatus: "",
  inlineAnchors: null,
  gridSelection: null,
  selectionOrigin: "result",
  chartSelection: null,
  chartDomains: {},
  chartDomainHistory: [],
  mapViewport: { zoom: 1, panX: 0, panY: 0 },
  mapFeatureSelections: [],
  resultStatus: "",
  focusArea: "chart",
  editorFontSize: 13,
  editorFocusVersion: 0,
  aiOpen: false,
  aiPhase: "idle",
  aiPlacement: "left",
  aiContext: "general",
  aiContextNote: "chart and current query",
  aiPrompt: "",
  aiBusy: false,
  aiMessage: "",
  aiHistory: [],
  aiUsage: null,
  aiFocusVersion: 0,
  includeSamples: false,
  aiPreferences: DEFAULT_AI_PREFERENCES,
  runtimeErrors: [],
  leftPaneRatio: 0.44,
  codePaneRatio: 0.56,
});

function captureWorkspaceDocument(state: WorkspaceSnapshot): WorkspaceDocument {
  const existing = state.workspaceDocuments.find((document) => document.id === state.activeWorkspaceId);
  return WorkspaceDocumentSchema.parse({
    id: state.activeWorkspaceId,
    title: state.draft.title.trim() || existing?.title || "untitled visualization",
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    draft: state.draft,
    query: state.query,
    dockSource: state.dockSource,
    resultTab: state.resultTab,
    fullSort: state.fullSort,
    gridSelection: state.gridSelection,
    selectionOrigin: state.selectionOrigin,
    chartSelection: state.chartSelection,
    chartDomains: state.chartDomains,
    chartDomainHistory: state.chartDomainHistory,
    mapViewport: state.mapViewport,
    mapFeatureSelections: state.mapFeatureSelections,
    focusArea: state.focusArea,
    editorFontSize: state.editorFontSize,
    aiPlacement: state.aiPlacement,
    aiContext: state.aiContext,
    aiContextNote: state.aiContextNote,
    aiPrompt: state.aiPrompt,
    aiMessage: state.aiMessage,
    aiHistory: state.aiHistory,
    aiUsage: state.aiUsage,
    includeSamples: state.includeSamples,
    aiPreferences: state.aiPreferences,
    runtimeErrors: state.runtimeErrors,
  });
}

function activatedWorkspaceState(document: WorkspaceDocument, focusVersion: number): Partial<WorkspaceSnapshot> {
  return {
    draft: document.draft,
    query: document.query,
    spec: null,
    selectedData: { ...EMPTY_TABLE, limit: 200 },
    resultRelation: EMPTY_RESULT_RELATION,
    fullData: EMPTY_TABLE,
    resultTab: document.resultTab,
    fullSort: document.fullSort,
    dockSource: document.dockSource,
    running: false,
    fullLoading: false,
    showLoadingMask: false,
    error: "",
    duration: 0,
    editorContext: null,
    dwimStatus: "",
    inlineAnchors: null,
    gridSelection: document.gridSelection,
    selectionOrigin: document.selectionOrigin,
    chartSelection: document.chartSelection,
    chartDomains: document.chartDomains,
    chartDomainHistory: document.chartDomainHistory,
    mapViewport: document.mapViewport,
    mapFeatureSelections: document.mapFeatureSelections,
    resultStatus: "",
    focusArea: document.focusArea,
    editorFontSize: document.editorFontSize,
    editorFocusVersion: focusVersion,
    aiOpen: false,
    aiPhase: "idle",
    aiPlacement: document.aiPlacement,
    aiContext: document.aiContext,
    aiContextNote: document.aiContextNote,
    aiPrompt: document.aiPrompt,
    aiBusy: false,
    aiMessage: document.aiMessage,
    aiHistory: document.aiHistory,
    aiUsage: document.aiUsage,
    aiFocusVersion: focusVersion,
    includeSamples: document.includeSamples,
    aiPreferences: document.aiPreferences,
    runtimeErrors: document.runtimeErrors,
  };
}

function newWorkspaceDocument(input: NewWorkspaceInput = {}): WorkspaceDocument {
  const draft = input.draft ?? makeBlankDraft();
  const query = input.query ?? (input.draft ? serializeDraft(input.draft) : "");
  return WorkspaceDocumentSchema.parse({
    id: `workspace-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: input.title?.trim() || draft.title.trim() || "untitled visualization",
    createdAt: new Date().toISOString(),
    draft,
    query,
    dockSource: input.dockSource ?? draft.source,
    resultTab: "chart",
    fullSort: null,
    gridSelection: null,
    selectionOrigin: "result",
    chartSelection: null,
    chartDomains: {},
    chartDomainHistory: [],
    mapViewport: { zoom: 1, panX: 0, panY: 0 },
    mapFeatureSelections: [],
    focusArea: "code",
    editorFontSize: 13,
    aiPlacement: "left",
    aiContext: "general",
    aiContextNote: "chart and current query",
    aiPrompt: "",
    aiMessage: "",
    aiHistory: [],
    aiUsage: null,
    includeSamples: false,
    aiPreferences: DEFAULT_AI_PREFERENCES,
    runtimeErrors: [],
  });
}

function replaceCapturedWorkspace(state: WorkspaceSnapshot) {
  const captured = captureWorkspaceDocument(state);
  return state.workspaceDocuments.map((document) => document.id === captured.id ? captured : document);
}

function captureWorkspaceSession(state: WorkspaceSnapshot) {
  return WorkspaceSessionSchema.parse({
    version: 1,
    activeWorkspaceId: state.activeWorkspaceId,
    workspaceDocuments: replaceCapturedWorkspace(state),
    leftPaneRatio: state.leftPaneRatio,
    codePaneRatio: state.codePaneRatio,
  });
}

function workspaceActivated(get: () => ChartizeWorkspaceState) {
  browserRunSequence += 1;
  fullTableSequence += 1;
  if (scheduledRun) {
    clearTimeout(scheduledRun);
    scheduledRun = null;
  }
  get().setRunning(false);
  queueMicrotask(() => {
    const state = get();
    if (state.engineState === "ready") void state.runQuery(state.query);
  });
}

export const useChartizeWorkspace = create<ChartizeWorkspaceState>((set, get) => ({
  ...initialSnapshot,

  initializeBrowserEngine: async (spatialiteUrl) => {
    if (get().engineState === "ready") return;
    set({ engineState: "loading" });
    setBrowserRuntimeProgressHandler((progress) => {
      if (progress.phase === "thinking") set({ aiMessage: progress.message });
      else if (get().running || get().engineState === "loading") set({ resultStatus: progress.message });
    });
    try {
      const bootstrap = await initializeBrowserRuntime(get().activeWorkspaceId, spatialiteUrl);
      set((state) => ({
        engineState: "ready",
        catalogLoaded: true,
        catalogDatasets: bootstrap.catalog,
        localDatasets: [
          ...BUILTIN_DATASETS,
          ...bootstrap.localDatasets.filter((dataset) => !BUILTIN_DATASETS.some((builtin) => builtin.tableName === dataset.tableName)),
        ],
        error: "",
        resultStatus: "",
        runtimeErrors: withoutRuntimeStage(state.runtimeErrors, "engine"),
      }));
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      set((state) => ({
        engineState: "error",
        catalogLoaded: true,
        error: message,
        resultStatus: "",
        runtimeErrors: addRuntimeError(state.runtimeErrors, { stage: "engine", message }),
      }));
      throw cause;
    }
  },
  executeWorkspaceSql: async (query) => runtimeExecuteWorkspaceSql(get().activeWorkspaceId, query),
  runQuery: async (queryToRun) => {
    const displayQuery = WorkspaceQuerySchema.parse(queryToRun ?? get().query);
    if (!displayQuery.trim()) {
      browserRunSequence += 1;
      get().setRunning(false);
      set((state) => ({
        spec: null,
        selectedData: { ...EMPTY_TABLE, limit: 200 },
        resultRelation: EMPTY_RESULT_RELATION,
        error: "",
        duration: 0,
        gridSelection: null,
        chartSelection: null,
        chartDomains: {},
        chartDomainHistory: [],
        runtimeErrors: withoutRuntimeStage(state.runtimeErrors, "query"),
      }));
      return { ok: true };
    }

    const runId = ++browserRunSequence;
    const workspaceId = get().activeWorkspaceId;
    const displaySources = sourcesFromQuery(displayQuery);
    const displaySource = displaySources[0] ?? sourceFromQuery(displayQuery, get().draft.source);
    const started = performance.now();
    get().setRunning(true);
    set({ error: "", mapFeatureSelections: [], resultRelation: EMPTY_RESULT_RELATION });
    try {
      const spec = await runWorkspaceGgsql(workspaceId, displayQuery);
      let selectedData = previewFromSpec(spec);
      let resultRelation = selectedData;
      const sql = splitGgsql(displayQuery).sql.trim().replace(/;$/, "");
      const resultSql = finalSqlStatement(sql);
      if (isResultSqlStatement(resultSql)) {
        try {
          const table = await runtimeExecuteWorkspaceSql(workspaceId, `SELECT * FROM (${resultSql}) AS chartize_selected LIMIT 200`);
          const count = await runtimeExecuteWorkspaceSql(workspaceId, `SELECT COUNT(*) AS total FROM (${resultSql}) AS chartize_selected`);
          const totalRows = Number(count.rows[0]?.[0] ?? table.rows.length);
          const compactIndexes = table.columns.flatMap((column, index) =>
            /^(?:geometry|geom|wkb|geojson)$/i.test(column) ? [] : [index]);
          const compactColumns = compactIndexes.map((index) => table.columns[index]!);
          const compactRows = table.rows.map((row) => compactIndexes.map((index) => row[index] ?? ""));
          selectedData = {
            columns: compactColumns,
            rows: compactRows,
            totalRows: Number.isFinite(totalRows) ? totalRows : table.rows.length,
            offset: 0,
            limit: 200,
          };
          resultRelation = selectedData;
          if (compactColumns.length && selectedData.totalRows > selectedData.rows.length) {
            const relationRows = [...compactRows];
            const relationLimit = Math.min(selectedData.totalRows, RESULT_RELATION_LIMIT);
            while (relationRows.length < relationLimit) {
              if (runId !== browserRunSequence) return { ok: false, error: "A newer query replaced this run." };
              const page = await runtimeExecuteWorkspaceSql(
                workspaceId,
                `SELECT ${compactColumns.map(quoteIdentifier).join(", ")} FROM (${resultSql}) AS chartize_result_relation LIMIT ${RESULT_RELATION_PAGE_SIZE} OFFSET ${relationRows.length}`,
              );
              if (!page.rows.length) break;
              relationRows.push(...page.rows.slice(0, relationLimit - relationRows.length));
            }
            resultRelation = {
              columns: compactColumns,
              rows: relationRows,
              totalRows: selectedData.totalRows,
              offset: 0,
              limit: RESULT_RELATION_LIMIT,
            };
            selectedData = { ...selectedData, rows: relationRows.slice(0, 200) };
          }
        } catch {
          // The visualization is still useful if an engine-specific terminal
          // statement cannot be wrapped for the selected-data preview.
        }
      }
      if (runId !== browserRunSequence) return { ok: false, error: "A newer query replaced this run." };
      const presentation = presentationFromSpec(spec);
      set((state) => ({
        spec,
        selectedData,
        resultRelation,
        duration: Math.round(performance.now() - started),
        gridSelection: null,
        chartSelection: null,
        chartDomains: {},
        chartDomainHistory: [],
        draft: {
          ...state.draft,
          source: displaySource,
          ...(presentation.title !== undefined ? { title: presentation.title, subtitle: presentation.subtitle ?? "" } : {}),
        },
        error: "",
        runtimeErrors: withoutRuntimeStage(state.runtimeErrors, "query"),
      }));
      return { ok: true };
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      if (runId === browserRunSequence) set((state) => ({
        error: message,
        runtimeErrors: addRuntimeError(state.runtimeErrors, { stage: "query", message, failedQuery: displayQuery }),
      }));
      return { ok: false, error: message };
    } finally {
      if (runId === browserRunSequence) get().setRunning(false);
    }
  },
  scheduleQueryRun: (queryToRun) => {
    const displayQuery = WorkspaceQuerySchema.parse(queryToRun);
    if (scheduledRun) clearTimeout(scheduledRun);
    scheduledRun = setTimeout(() => {
      scheduledRun = null;
      void get().runQuery(displayQuery);
    }, 260);
  },
  editQuery: (queryInput) => {
    const query = WorkspaceQuerySchema.parse(queryInput);
    if (query.trim()) {
      set({ query, dwimStatus: "", mapFeatureSelections: [] });
      return;
    }
    browserRunSequence += 1;
    fullTableSequence += 1;
    get().setRunning(false);
    if (scheduledRun) {
      clearTimeout(scheduledRun);
      scheduledRun = null;
    }
    set({
      query: "",
      draft: makeBlankDraft(),
      spec: null,
      selectedData: { ...EMPTY_TABLE, limit: 200 },
      resultRelation: EMPTY_RESULT_RELATION,
      fullData: EMPTY_TABLE,
      dockSource: "",
      fullSort: null,
      fullLoading: false,
      error: "",
      duration: 0,
      dwimStatus: "",
      gridSelection: null,
      chartSelection: null,
      chartDomains: {},
      chartDomainHistory: [],
      mapFeatureSelections: [],
    });
  },
  runEditorQuery: async (queryToRun) => {
    const displayQuery = WorkspaceQuerySchema.parse(queryToRun);
    if (scheduledRun) {
      clearTimeout(scheduledRun);
      scheduledRun = null;
    }
    set({ query: displayQuery });
    return get().runQuery(displayQuery);
  },
  applyDataset: (source, dataset, autoRun = true) => {
    const nextDraft = draftForDataset(source, dataset);
    const nextQuery = serializeDraft(nextDraft);
    fullTableSequence += 1;
    set({
      draft: nextDraft,
      query: nextQuery,
      fullData: EMPTY_TABLE,
      fullLoading: false,
      fullSort: null,
      dockSource: z.string().min(1).max(300).parse(source),
      editorContext: null,
      mapViewport: { zoom: 1, panX: 0, panY: 0 },
      chartSelection: null,
      mapFeatureSelections: [],
    });
    if (autoRun) get().scheduleQueryRun(nextQuery);
  },
  toggleSource: (source, enabled) => {
    const parsedSource = z.string().min(1).max(300).parse(source);
    const current = sourcesFromQuery(get().query);
    if (enabled && current.includes(parsedSource)) return;
    if (!enabled && current.length <= 1) {
      set({ dwimStatus: "A SELECT needs at least one FROM source." });
      return;
    }
    const nextSources = enabled ? [...current, parsedSource] : current.filter((item) => item !== parsedSource);
    let nextQuery = get().query;
    if (!enabled) {
      nextQuery = removeProjectionAlias(nextQuery, sourceAlias(parsedSource, Math.max(0, current.indexOf(parsedSource))));
    }
    nextQuery = replaceQuerySources(nextQuery, nextSources);
    if (nextSources.length === 1) nextQuery = collapseSingleSourceProjection(nextQuery, sourceAlias(nextSources[0]!));
    set((state) => ({
      query: nextQuery,
      dockSource: nextSources.includes(state.dockSource) ? state.dockSource : nextSources[0]!,
      dwimStatus: enabled
        ? `${parsedSource} added as a CROSS JOIN. Add a join condition in GGSQL before running a large combination.`
        : `${parsedSource} removed from FROM.`,
    }));
  },
  addLocalFiles: async (inputFiles) => {
    const files = z.array(BrowserFileSchema).min(1).max(20).parse(inputFiles);
    const imported: LocalDataset[] = [];
    for (const file of files) {
      try {
        if (file.size > 100 * 1024 * 1024) throw new Error(`${file.name} exceeds the 100 MB browser safety limit.`);
        get().setRunning(true);
        set((state) => ({ error: "", runtimeErrors: withoutRuntimeStage(state.runtimeErrors, "upload") }));
        const format = detectFormat(file);
        const tableName = tableNameFromFile(file.name);
        const original = await file.arrayBuffer();
        const registration = await runtimeRegisterBrowserSource(
          get().activeWorkspaceId,
          tableName,
          format,
          original,
          { name: file.name, type: file.type, size: file.size },
        );
        const dataset = LocalDatasetSchema.parse(registration.dataset);
        imported.push(dataset);
        set((state) => ({ localDatasets: [...state.localDatasets.filter((item) => item.tableName !== tableName), dataset] }));
        fullTableCache.clear();
        get().applyDataset(`user:${tableName}`, dataset);
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : String(cause);
        set((state) => ({
          error: message,
          runtimeErrors: addRuntimeError(state.runtimeErrors, { stage: "upload", message }),
        }));
      } finally {
        get().setRunning(false);
      }
    }
    return imported;
  },
  removeLocalSource: async (tableNameInput) => {
    const tableName = z.string().min(1).max(200).parse(tableNameInput);
    const source = `user:${tableName}`;
    const result = await removeBrowserSource(tableName);
    const activeSources = sourcesFromQuery(get().query);
    if (activeSources.includes(source)) get().editQuery("");
    fullTableCache.clear();
    set((state) => ({
      localDatasets: [
        ...BUILTIN_DATASETS,
        ...result.localDatasets.map((dataset) => LocalDatasetSchema.parse(dataset)),
      ],
      dockSource: state.dockSource === source ? "" : state.dockSource,
      fullData: state.dockSource === source ? EMPTY_TABLE : state.fullData,
      aiMessage: `${tableName} removed from this browser.`,
    }));
  },
  updateQueryImmediately: (queryToRun) => {
    const displayQuery = WorkspaceQuerySchema.parse(queryToRun);
    set({ query: displayQuery });
    get().scheduleQueryRun(displayQuery);
  },
  toggleColumn: (source, fieldInput, enabled) => {
    const parsedSource = z.string().min(1).max(300).parse(source);
    const field = FieldMetadataSchema.parse(fieldInput);
    const state = get();
    const querySources = sourcesFromQuery(state.query);
    const sourceIndex = Math.max(0, querySources.indexOf(parsedSource));
    const alias = sourceAlias(parsedSource, sourceIndex);
    const outputName = querySources.length > 1 ? `${alias}__${field.name}` : field.name;
    const labels = selectedProjectionLabels(state.query);
    const existing = labels.includes(outputName) ? outputName : labels.includes(field.name) ? field.name : outputName;
    const nextQuery = enabled
      ? addSelectedExpression(state.query, querySources.length > 1 ? `${quoteIdentifier(alias)}.${quoteIdentifier(field.name)} AS ${quoteIdentifier(outputName)}` : quoteIdentifier(field.name), outputName)
      : removeSelectedProjection(state.query, existing);
    if (nextQuery === state.query) return;
    if (querySources.length > 1) {
      set({ query: nextQuery, dwimStatus: "SELECT updated. Review the multi-source join, then press run." });
    } else get().updateQueryImmediately(nextQuery);
  },
  removeColumn: (field) => {
    const parsedField = z.string().min(1).max(300).parse(field);
    const nextQuery = removeSelectedProjection(get().query, parsedField);
    if (nextQuery !== get().query) get().updateQueryImmediately(nextQuery);
  },
  updateVisual: (input) => {
    const update = VisualPointUpdateSchema.parse(input) as VisualPointUpdate;
    get().updateQueryImmediately(updateFirstVisual(get().query, update));
  },
  editChartLabel: (kind, value) => {
    const parsedKind = z.enum(["title", "subtitle"]).parse(kind);
    const parsedValue = z.string().max(2000).parse(value);
    set((state) => ({ draft: { ...state.draft, [parsedKind]: parsedValue } }));
    get().updateQueryImmediately(updateFirstVisual(get().query, { [parsedKind]: parsedValue }));
  },
  loadFullTable: async (sourceInput, offsetInput = 0, sortInput = get().fullSort, append = false) => {
    const source = z.string().max(300).parse(sourceInput);
    if (!source) return;
    const offset = z.number().int().nonnegative().parse(offsetInput);
    const sort = sortInput === null ? null : z.object({ column: z.string().min(1).max(300), direction: z.enum(["asc", "desc"]) }).parse(sortInput);
    const requestId = ++fullTableSequence;
    const published = get().catalogDatasets.find((dataset) => `chartize:${dataset.slug}` === source || dataset.tableName === source);
    const key = `${published?.version ?? "browser"}:${source}:${offset}:${sort?.column ?? ""}:${sort?.direction ?? ""}`;
    const commit = (table: TablePreview) => set((state) => ({
      fullData: append
        ? { ...table, offset: 0, rows: [...state.fullData.rows, ...table.rows] }
        : { ...table, offset: 0 },
    }));
    const cached = fullTableCache.get(key);
    if (cached) {
      commit(cached);
      return;
    }
    set({ fullLoading: true });
    try {
      const order = sort ? ` ORDER BY ${quoteIdentifier(sort.column)} ${sort.direction.toUpperCase()} NULLS LAST` : "";
      const page = await get().executeWorkspaceSql(`SELECT * FROM ${quoteLocalSource(source)}${order} LIMIT 100 OFFSET ${offset}`);
      const count = await get().executeWorkspaceSql(`SELECT COUNT(*) AS total FROM ${quoteLocalSource(source)}`);
      const table = TablePreviewSchema.parse({
        columns: page.columns,
        rows: page.rows,
        totalRows: Number(count.rows[0]?.[0] ?? 0),
        offset,
        limit: 100,
      });
      remember(fullTableCache, key, table, 16);
      if (requestId === fullTableSequence) {
        commit(table);
        set((state) => ({ runtimeErrors: withoutRuntimeStage(state.runtimeErrors, "table") }));
      }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      if (requestId === fullTableSequence) set((state) => ({
        error: message,
        runtimeErrors: addRuntimeError(state.runtimeErrors, { stage: "table", message }),
      }));
    } finally {
      if (requestId === fullTableSequence) set({ fullLoading: false });
    }
  },
  sortFullTable: (columnInput) => {
    const column = z.string().min(1).max(300).parse(columnInput);
    const current = get().fullSort;
    const fullSort: TableSort = current?.column === column
      ? { column, direction: current.direction === "asc" ? "desc" : "asc" }
      : { column, direction: "asc" };
    set({ fullData: EMPTY_TABLE, fullSort });
    void get().loadFullTable(get().dockSource, 0, fullSort);
  },
  loadMoreFullTable: async () => {
    const state = get();
    if (state.fullLoading || !state.dockSource || state.fullData.rows.length >= state.fullData.totalRows) return;
    await get().loadFullTable(state.dockSource, state.fullData.rows.length, state.fullSort, true);
  },
  addColumnFromTable: (columnInput) => {
    const column = z.string().min(1).max(300).parse(columnInput);
    const state = get();
    const candidates = [
      ...state.catalogDatasets.map((dataset) => ({ id: `chartize:${dataset.slug}`, fields: dataset.fields })),
      ...state.localDatasets.map((dataset) => ({ id: dataset.tableName.startsWith("ggsql:") ? dataset.tableName : `user:${dataset.tableName}`, fields: dataset.fields })),
    ];
    const field = candidates.find((candidate) => candidate.id === state.dockSource)?.fields.find((candidate) => candidate.name === column)
      ?? { name: column, dataType: "VARCHAR", nullable: true };
    get().toggleColumn(state.dockSource, field, true);
  },
  selectChartRegion: (selectionInput) => {
    const chartSelection = selectionInput ? ChartSelectionSchema.parse(selectionInput) : null;
    set({
      selectionOrigin: "result",
      gridSelection: null,
      mapFeatureSelections: [],
      chartSelection,
    });
  },
  selectMapFeature: (selectionInput, additive = false) => {
    const selection = selectionInput ? MapFeatureSelectionSchema.parse(selectionInput) : null;
    set((state) => {
      if (!selection) return {
        selectionOrigin: "result" as const,
        gridSelection: null,
        chartSelection: null,
        mapFeatureSelections: [],
      };
      if (!additive) return {
        selectionOrigin: "result" as const,
        gridSelection: null,
        chartSelection: null,
        mapFeatureSelections: [selection],
        runtimeErrors: withoutRuntimeStage(state.runtimeErrors, "map"),
      };
      const exists = state.mapFeatureSelections.some((candidate) => candidate.key === selection.key);
      return {
        selectionOrigin: "result" as const,
        gridSelection: null,
        chartSelection: null,
        mapFeatureSelections: exists
          ? state.mapFeatureSelections.filter((candidate) => candidate.key !== selection.key)
          : [...state.mapFeatureSelections, selection].slice(-24),
        runtimeErrors: withoutRuntimeStage(state.runtimeErrors, "map"),
      };
    });
  },
  requestAiTurn: async (input) => {
    const request = AiTurnRequestSchema.parse(input);
    try {
      return await requestBrowserAiTurn(get().activeWorkspaceId, request);
    } catch (cause) {
      throw cause;
    } finally {
      set({ aiMessage: "" });
    }
  },
  submitAiTurn: async (input) => {
    const submission = AiSubmissionSchema.parse(input);
    const startedWorkspace = get().activeWorkspaceId;
    const initialState = get();
    if (initialState.aiBusy) return;
    if (!initialState.catalogLoaded) {
      set({ aiMessage: "The data catalog is still loading." });
      return;
    }
    let branchHistory = initialState.aiHistory;
    let retriedRequest = submission.requestOverride?.trim() ?? "";
    if (submission.retryAssistantIndex !== undefined) {
      let userIndex = submission.retryAssistantIndex - 1;
      while (userIndex >= 0 && initialState.aiHistory[userIndex]?.role !== "user") userIndex -= 1;
      if (userIndex < 0) return;
      retriedRequest = initialState.aiHistory[userIndex]!.text;
      branchHistory = initialState.aiHistory.slice(0, userIndex);
    }
    const request = retriedRequest || initialState.aiPrompt.trim() || (submission.task === "explain"
      ? submission.context === "code"
        ? "Explain the current GGSQL, including how its VISUALISE clauses produce this chart."
        : "Explain the current chart and the GGSQL that produces it."
      : "Repair the current query.");
    const history = branchHistory.slice(-12);
    set({
      aiBusy: true,
      aiMessage: "",
      aiHistory: [...branchHistory, { role: "user", text: request }],
      aiPrompt: "",
    });
    try {
      const { requestOverride: _requestOverride, retryAssistantIndex: _retryAssistantIndex, ...context } = submission;
      const turnInput = AiTurnRequestSchema.parse({
        ...context,
        request,
        currentQuery: initialState.query,
        preferences: initialState.aiPreferences,
        history,
        runtimeErrors: initialState.runtimeErrors,
      });
      let body = await get().requestAiTurn(turnInput);
      if (get().activeWorkspaceId !== startedWorkspace) return;
      let usage = body.usage;
      if (body.kind === "visualization") {
        get().resetMapViewport();
        let runResult = await get().runQuery(body.query);
        const repairDiagnostics: string[] = [];
        for (let repairAttempt = 0; !runResult.ok && submission.task !== "repair" && repairAttempt < 2; repairAttempt += 1) {
          repairDiagnostics.push(runResult.error);
          set({ aiMessage: `repairing the browser query… ${repairAttempt + 1}/2` });
          const repaired = await get().requestAiTurn({
            ...turnInput,
            task: "repair",
            context: "code",
            contextNote: `The candidate GGSQL failed in the browser engine. Fix every diagnostic observed in this turn, especially the latest one:\n${repairDiagnostics.map((diagnostic, index) => `${index + 1}. ${diagnostic}`).join("\n")}`,
            request: `Repair the candidate GGSQL completely while preserving this request: ${request}`,
            currentQuery: body.query,
            preferences: { ...initialState.aiPreferences, webSearch: false },
            runtimeErrors: addRuntimeError(turnInput.runtimeErrors, {
              stage: "query",
              message: runResult.error,
              failedQuery: body.query,
            }),
          });
          usage = mergeAiUsage(usage, repaired.usage);
          if (repaired.kind !== "visualization") break;
          body = repaired;
          runResult = await get().runQuery(body.query);
        }
        if (get().activeWorkspaceId !== startedWorkspace) return;
        if (!runResult.ok) {
          const failure = `${body.explanation.trim()}\n\nI couldn't apply that visualization yet.\n\n> ${runResult.error}\n\nUse **redo** below to retry from the same prompt.`;
          set((state) => ({ aiHistory: [...state.aiHistory, { role: "assistant", text: failure }], aiUsage: usage }));
          return;
        }
        set({ draft: body.draft, query: body.query });
      }
      const reply = [
        body.explanation.trim(),
        initialState.aiPreferences.technical && body.assumptions.length ? `Assumptions: ${body.assumptions.join(" ")}` : "",
        (initialState.aiPreferences.technical || initialState.aiPreferences.challenge) && body.warnings.length ? `Check: ${body.warnings.join(" ")}` : "",
        body.sources.length ? `Sources: ${body.sources.map((source) => `[${source.title}](${source.url})`).join(" · ")}` : "",
      ].filter(Boolean).join("\n\n");
      set((state) => ({
        aiUsage: usage,
        aiHistory: [...state.aiHistory, { role: "assistant", text: reply }],
      }));
    } catch (cause) {
      if (get().activeWorkspaceId === startedWorkspace) {
        const message = cause instanceof Error ? cause.message : String(cause);
        set((state) => ({
          aiHistory: [...state.aiHistory, {
            role: "assistant",
            text: `I hit a workspace error before I could finish.\n\n> ${message}\n\nUse **redo** below to try this turn again.`,
          }],
          aiMessage: "",
          runtimeErrors: addRuntimeError(state.runtimeErrors, { stage: "ai", message, failedQuery: state.query || undefined }),
        }));
      }
    } finally {
      if (get().activeWorkspaceId === startedWorkspace) set({ aiBusy: false });
    }
  },
  persistWorkspaceSession: async () => {
    const payload = JSON.stringify(captureWorkspaceSession(get()));
    if (payload === lastPersistedSession) return;
    await saveBrowserWorkspace({ id: "session", payload, savedAt: new Date().toISOString() });
    lastPersistedSession = payload;
  },
  restoreWorkspaceSession: async () => {
    const restored = await loadBrowserWorkspace("session");
    const record = restored.workspace;
    if (!record || !("payload" in record)) return false;
    const session = WorkspaceSessionSchema.parse(JSON.parse(record.payload));
    const document = session.workspaceDocuments.find((candidate) => candidate.id === session.activeWorkspaceId)!;
    lastPersistedSession = JSON.stringify(session);
    set((state) => ({
      ...activatedWorkspaceState(document, state.aiFocusVersion + 1),
      activeWorkspaceId: session.activeWorkspaceId,
      workspaceDocuments: session.workspaceDocuments,
      localDatasets: [
        ...BUILTIN_DATASETS,
        ...restored.localDatasets
          .map((dataset) => LocalDatasetSchema.parse(dataset))
          .filter((dataset) => !BUILTIN_DATASETS.some((builtin) => builtin.tableName === dataset.tableName)),
      ],
      leftPaneRatio: session.leftPaneRatio,
      codePaneRatio: session.codePaneRatio,
    }));
    return true;
  },
  shareWorkspace: async () => {
    if (typeof window === "undefined") throw new Error("Sharing is available in the browser.");
    window.location.hash = `view=${encodeShareState({ query: get().query, draft: get().draft })}`;
    await navigator.clipboard.writeText(window.location.href);
    set({ aiMessage: "Share URL copied. Local file bytes are not included." });
  },

  openWorkspace: (input) => {
    set((state) => {
      const document = newWorkspaceDocument(input);
      return {
        ...activatedWorkspaceState(document, state.aiFocusVersion + 1),
        activeWorkspaceId: document.id,
        workspaceDocuments: [...replaceCapturedWorkspace(state), document],
      };
    });
    workspaceActivated(get);
  },
  switchWorkspace: (id) => {
    if (id === get().activeWorkspaceId) return;
    let switched = false;
    set((state) => {
      const documents = replaceCapturedWorkspace(state);
      const document = documents.find((candidate) => candidate.id === id);
      if (!document) return state;
      switched = true;
      return {
        ...activatedWorkspaceState(document, state.aiFocusVersion + 1),
        activeWorkspaceId: id,
        workspaceDocuments: documents,
      };
    });
    if (switched) workspaceActivated(get);
  },
  closeWorkspace: (id) => {
    const wasActive = id === get().activeWorkspaceId;
    let activated = false;
    let closed = false;
    set((state) => {
      if (state.workspaceDocuments.length <= 1) return state;
      const documents = replaceCapturedWorkspace(state).filter((document) => document.id !== id);
      if (documents.length === state.workspaceDocuments.length) return state;
      closed = true;
      if (!wasActive) return { workspaceDocuments: documents };
      const document = documents.at(-1)!;
      activated = true;
      return {
        ...activatedWorkspaceState(document, state.aiFocusVersion + 1),
        activeWorkspaceId: document.id,
        workspaceDocuments: documents,
      };
    });
    if (closed) void releaseBrowserWorkspace(id).catch(() => undefined);
    if (activated) workspaceActivated(get);
  },

  setDraft: (next) => set((state) => ({ draft: resolve(next, state.draft) })),
  setQuery: (query) => set({ query }),
  setResultTab: (resultTab) => set({ resultTab }),
  setDockSource: (next) => set((state) => {
    const dockSource = resolve(next, state.dockSource);
    if (dockSource === state.dockSource) return { dockSource };
    fullTableSequence += 1;
    return { dockSource, fullData: EMPTY_TABLE, fullSort: null, fullLoading: false };
  }),
  setRunning: (running) => {
    if (loadingMaskTimer) {
      clearTimeout(loadingMaskTimer);
      loadingMaskTimer = null;
    }
    if (!running) {
      set({ running: false, showLoadingMask: false });
      return;
    }
    set({ running: true, showLoadingMask: false });
    loadingMaskTimer = setTimeout(() => {
      loadingMaskTimer = null;
      if (get().running) set({ showLoadingMask: true });
    }, 180);
  },
  setError: (error) => set((state) => ({
    error,
    runtimeErrors: error
      ? addRuntimeError(state.runtimeErrors, { stage: "query", message: error, failedQuery: state.query || undefined })
      : state.runtimeErrors,
  })),
  setEditorContext: (editorContext) => set({ editorContext }),
  setDwimStatus: (dwimStatus) => set({ dwimStatus }),
  setInlineAnchors: (inlineAnchors) => set({ inlineAnchors }),
  setGridSelection: (gridSelection) => set({ gridSelection }),
  setSelectionOrigin: (selectionOrigin) => set({ selectionOrigin }),
  setChartSelection: (chartSelection) => set({ chartSelection }),
  setChartDomains: (chartDomains) => set({ chartDomains: ChartDomainsSchema.parse(chartDomains) }),
  zoomChart: (next) => set((state) => ({
    chartDomains: ChartDomainsSchema.parse(next),
    chartDomainHistory: [...state.chartDomainHistory.slice(-19), state.chartDomains],
    chartSelection: null,
  })),
  zoomChartOut: () => set((state) => ({
    chartDomains: state.chartDomainHistory.at(-1) ?? {},
    chartDomainHistory: state.chartDomainHistory.slice(0, -1),
    chartSelection: null,
  })),
  resetChartZoom: () => set({ chartDomains: {}, chartDomainHistory: [], chartSelection: null }),
  zoomMap: (factor) => set((state) => ({
    mapViewport: MapViewportSchema.parse({
      ...state.mapViewport,
      zoom: Math.min(8, Math.max(0.5, state.mapViewport.zoom * factor)),
    }),
    chartSelection: null,
    mapFeatureSelections: [],
  })),
  panMap: (horizontal, vertical) => set((state) => ({
    mapViewport: MapViewportSchema.parse({
      ...state.mapViewport,
      panX: Math.min(4, Math.max(-4, state.mapViewport.panX + horizontal / state.mapViewport.zoom)),
      panY: Math.min(4, Math.max(-4, state.mapViewport.panY + vertical / state.mapViewport.zoom)),
    }),
    chartSelection: null,
    mapFeatureSelections: [],
  })),
  resetMapViewport: () => set({ mapViewport: { zoom: 1, panX: 0, panY: 0 }, chartSelection: null, mapFeatureSelections: [] }),
  setMapFeatureSelections: (mapFeatureSelections) => set({ mapFeatureSelections: z.array(MapFeatureSelectionSchema).max(24).parse(mapFeatureSelections) }),
  setResultStatus: (resultStatus) => set({ resultStatus }),
  setFocusArea: (focusArea) => set({ focusArea }),
  setEditorFontSize: (editorFontSize) => set({ editorFontSize: EditorFontSizeSchema.parse(editorFontSize) }),
  setAiOpen: (aiOpen) => set({ aiOpen }),
  setAiPhase: (aiPhase) => set({ aiPhase }),
  setAiPlacement: (aiPlacement) => set({ aiPlacement }),
  setAiContext: (aiContext) => set({ aiContext }),
  setAiContextNote: (aiContextNote) => set({ aiContextNote }),
  setAiPrompt: (aiPrompt) => set({ aiPrompt }),
  setAiBusy: (aiBusy) => set({ aiBusy }),
  setAiMessage: (aiMessage) => set({ aiMessage }),
  setAiHistory: (next) => set((state) => ({ aiHistory: resolve(next, state.aiHistory) })),
  setAiUsage: (aiUsage) => set({ aiUsage: aiUsage ? AiUsageSchema.parse(aiUsage) : null }),
  setIncludeSamples: (includeSamples) => set({ includeSamples }),
  setAiPreferences: (aiPreferences) => set({ aiPreferences: AiResponsePreferencesSchema.parse(aiPreferences) }),
  openAi: (input) => {
    const parsed = AiOpenInputSchema.parse(input);
    set((state) => ({
      aiOpen: true,
      aiPhase: "active",
      aiContextNote: parsed.contextNote,
      aiPlacement: parsed.placement,
      aiContext: parsed.context,
      editorContext: null,
      aiFocusVersion: state.aiFocusVersion + 1,
    }));
    if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("chartize:ai-opened"));
  },
  setLeftPaneRatio: (leftPaneRatio) => set({ leftPaneRatio: LeftPaneRatioSchema.parse(leftPaneRatio) }),
  setCodePaneRatio: (codePaneRatio) => set({ codePaneRatio: CodePaneRatioSchema.parse(codePaneRatio) }),
  startNewVisualization: () => {
    set((state) => {
      const document = newWorkspaceDocument();
      return {
        ...activatedWorkspaceState(document, state.aiFocusVersion + 1),
        activeWorkspaceId: document.id,
        workspaceDocuments: [...replaceCapturedWorkspace(state), document],
      };
    });
    workspaceActivated(get);
  },
  closeAi: () => {
    set({ aiOpen: false, aiPhase: "idle" });
    if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("chartize:ai-closed"));
  },
}));

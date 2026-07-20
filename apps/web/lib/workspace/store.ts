import {
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
} from "@chartize/contracts";
import { z } from "zod";
import { create } from "zustand";
import { makeBlankDraft, makeDefaultDraft, serializeDraft } from "../ggsql/serialize";
import { MapFeatureSelectionSchema, type MapFeatureSelection } from "./chart-data";

export type ExecutionMode = "local" | "warehouse";
export type ResultTab = "chart" | "selected";
export type TableSort = { column: string; direction: "asc" | "desc" } | null;
export type FocusArea = "code" | "chart" | "table";
export type AiPlacement = "left" | "right";
export type AiContext = "code" | "chart" | "general";
export type AiPhase = "idle" | "activating" | "active";
export type EngineState = "loading" | "ready" | "error";

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
export const AiResponsePreferencesSchema = z.object({
  hypothesize: z.boolean(),
  webSearch: z.boolean(),
  dataAccess: z.boolean().default(true),
  concise: z.boolean(),
  challenge: z.boolean(),
  technical: z.boolean(),
});
const LeftPaneRatioSchema = z.number().min(0.3).max(0.7);
const CodePaneRatioSchema = z.number().min(0.32).max(0.72);
const EditorFontSizeSchema = z.number().int().min(10).max(24);
const FocusAreaSchema = z.enum(["code", "chart", "table"]);

export const WorkspaceDocumentSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  createdAt: z.string(),
  mode: z.enum(["local", "warehouse"]),
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
  mapFeatureSelection: MapFeatureSelectionSchema.nullable().default(null),
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
export type AiResponsePreferences = z.infer<typeof AiResponsePreferencesSchema>;
export type WorkspaceDocument = z.infer<typeof WorkspaceDocumentSchema>;
export interface NewWorkspaceInput {
  title?: string;
  mode?: ExecutionMode;
  draft?: GgsqlDraft;
  query?: string;
  dockSource?: string;
}

export const WorkspaceSnapshotSchema = z.object({
  activeWorkspaceId: z.string().min(1),
  workspaceDocuments: z.array(WorkspaceDocumentSchema).min(1),
  engineState: z.enum(["loading", "ready", "error"]),
  catalogLoaded: z.boolean(),
  mode: z.enum(["local", "warehouse"]),
  localDatasets: z.array(LocalDatasetSchema),
  warehouseDatasets: z.array(DatasetManifestSchema),
  draft: GgsqlDraftSchema,
  query: z.string(),
  spec: z.record(z.string(), z.unknown()).nullable(),
  selectedData: TablePreviewSchema,
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
  mapFeatureSelection: MapFeatureSelectionSchema.nullable().default(null),
  resultStatus: z.string(),
  focusArea: FocusAreaSchema,
  editorFontSize: EditorFontSizeSchema,
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
  leftPaneRatio: LeftPaneRatioSchema,
  codePaneRatio: CodePaneRatioSchema,
});

export type WorkspaceSnapshot = z.infer<typeof WorkspaceSnapshotSchema>;

export const EMPTY_TABLE: TablePreview = { columns: [], rows: [], totalRows: 0, offset: 0, limit: 100 };

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

interface ChartizeWorkspaceState extends WorkspaceSnapshot {
  openWorkspace: (input?: NewWorkspaceInput) => void;
  switchWorkspace: (id: string) => void;
  closeWorkspace: (id: string) => void;
  setEngineState: (value: EngineState) => void;
  setCatalogLoaded: (value: boolean) => void;
  setMode: (value: ExecutionMode) => void;
  setLocalDatasets: (value: Updater<LocalDataset[]>) => void;
  setWarehouseDatasets: (value: DatasetManifest[]) => void;
  setDraft: (value: Updater<GgsqlDraft>) => void;
  setQuery: (value: string) => void;
  setSpec: (value: Record<string, unknown> | null) => void;
  setSelectedData: (value: TablePreview) => void;
  setFullData: (value: Updater<TablePreview>) => void;
  setResultTab: (value: ResultTab) => void;
  setFullSort: (value: Updater<TableSort>) => void;
  setDockSource: (value: Updater<string>) => void;
  setRunning: (value: boolean) => void;
  setFullLoading: (value: boolean) => void;
  setShowLoadingMask: (value: boolean) => void;
  setError: (value: string) => void;
  setDuration: (value: number) => void;
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
  setMapFeatureSelection: (value: MapFeatureSelectionState | null) => void;
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
  requestAiFocus: () => void;
  setIncludeSamples: (value: boolean) => void;
  setAiPreferences: (value: AiResponsePreferences) => void;
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
  mode: "warehouse",
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
  mapFeatureSelection: null,
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
});

const initialSnapshot = WorkspaceSnapshotSchema.parse({
  activeWorkspaceId: initialWorkspaceDocument.id,
  workspaceDocuments: [initialWorkspaceDocument],
  engineState: "loading",
  catalogLoaded: false,
  mode: "warehouse",
  localDatasets: BUILTIN_DATASETS,
  warehouseDatasets: [],
  draft: initialDraft,
  query: initialQuery,
  spec: null,
  selectedData: { ...EMPTY_TABLE, limit: 200 },
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
  mapFeatureSelection: null,
  resultStatus: "",
  focusArea: "chart",
  editorFontSize: 13,
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
  leftPaneRatio: 0.44,
  codePaneRatio: 0.56,
});

function captureWorkspaceDocument(state: WorkspaceSnapshot): WorkspaceDocument {
  const existing = state.workspaceDocuments.find((document) => document.id === state.activeWorkspaceId);
  return WorkspaceDocumentSchema.parse({
    id: state.activeWorkspaceId,
    title: state.draft.title.trim() || existing?.title || "untitled visualization",
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    mode: state.mode,
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
    mapFeatureSelection: state.mapFeatureSelection,
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
  });
}

function activatedWorkspaceState(document: WorkspaceDocument, focusVersion: number): Partial<WorkspaceSnapshot> {
  return {
    mode: document.mode,
    draft: document.draft,
    query: document.query,
    spec: null,
    selectedData: { ...EMPTY_TABLE, limit: 200 },
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
    mapFeatureSelection: document.mapFeatureSelection,
    resultStatus: "",
    focusArea: document.focusArea,
    editorFontSize: document.editorFontSize,
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
  };
}

function newWorkspaceDocument(input: NewWorkspaceInput = {}): WorkspaceDocument {
  const draft = input.draft ?? makeBlankDraft();
  const query = input.query ?? (input.draft ? serializeDraft(input.draft) : "");
  return WorkspaceDocumentSchema.parse({
    id: `workspace-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: input.title?.trim() || draft.title.trim() || "untitled visualization",
    createdAt: new Date().toISOString(),
    mode: input.mode ?? "warehouse",
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
    mapFeatureSelection: null,
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
  });
}

function replaceCapturedWorkspace(state: WorkspaceSnapshot) {
  const captured = captureWorkspaceDocument(state);
  return state.workspaceDocuments.map((document) => document.id === captured.id ? captured : document);
}

export const useChartizeWorkspace = create<ChartizeWorkspaceState>((set) => ({
  ...initialSnapshot,

  openWorkspace: (input) => set((state) => {
    const document = newWorkspaceDocument(input);
    return {
      ...activatedWorkspaceState(document, state.aiFocusVersion + 1),
      activeWorkspaceId: document.id,
      workspaceDocuments: [...replaceCapturedWorkspace(state), document],
    };
  }),
  switchWorkspace: (id) => set((state) => {
    if (id === state.activeWorkspaceId) return state;
    const documents = replaceCapturedWorkspace(state);
    const document = documents.find((candidate) => candidate.id === id);
    if (!document) return state;
    return {
      ...activatedWorkspaceState(document, state.aiFocusVersion + 1),
      activeWorkspaceId: id,
      workspaceDocuments: documents,
    };
  }),
  closeWorkspace: (id) => set((state) => {
    if (state.workspaceDocuments.length <= 1) return state;
    const documents = replaceCapturedWorkspace(state).filter((document) => document.id !== id);
    if (id !== state.activeWorkspaceId) return { workspaceDocuments: documents };
    const document = documents.at(-1)!;
    return {
      ...activatedWorkspaceState(document, state.aiFocusVersion + 1),
      activeWorkspaceId: document.id,
      workspaceDocuments: documents,
    };
  }),

  setEngineState: (engineState) => set({ engineState }),
  setCatalogLoaded: (catalogLoaded) => set({ catalogLoaded }),
  setMode: (mode) => set({ mode }),
  setLocalDatasets: (next) => set((state) => ({ localDatasets: resolve(next, state.localDatasets) })),
  setWarehouseDatasets: (warehouseDatasets) => set({ warehouseDatasets }),
  setDraft: (next) => set((state) => ({ draft: resolve(next, state.draft) })),
  setQuery: (query) => set({ query }),
  setSpec: (spec) => set({ spec }),
  setSelectedData: (selectedData) => set({ selectedData }),
  setFullData: (next) => set((state) => ({ fullData: resolve(next, state.fullData) })),
  setResultTab: (resultTab) => set({ resultTab }),
  setFullSort: (next) => set((state) => ({ fullSort: resolve(next, state.fullSort) })),
  setDockSource: (next) => set((state) => ({ dockSource: resolve(next, state.dockSource) })),
  setRunning: (running) => set({ running }),
  setFullLoading: (fullLoading) => set({ fullLoading }),
  setShowLoadingMask: (showLoadingMask) => set({ showLoadingMask }),
  setError: (error) => set({ error }),
  setDuration: (duration) => set({ duration }),
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
    mapFeatureSelection: null,
  })),
  panMap: (horizontal, vertical) => set((state) => ({
    mapViewport: MapViewportSchema.parse({
      ...state.mapViewport,
      panX: Math.min(4, Math.max(-4, state.mapViewport.panX + horizontal / state.mapViewport.zoom)),
      panY: Math.min(4, Math.max(-4, state.mapViewport.panY + vertical / state.mapViewport.zoom)),
    }),
    chartSelection: null,
    mapFeatureSelection: null,
  })),
  resetMapViewport: () => set({ mapViewport: { zoom: 1, panX: 0, panY: 0 }, chartSelection: null, mapFeatureSelection: null }),
  setMapFeatureSelection: (mapFeatureSelection) => set({ mapFeatureSelection: mapFeatureSelection ? MapFeatureSelectionSchema.parse(mapFeatureSelection) : null }),
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
  requestAiFocus: () => set((state) => ({ aiFocusVersion: state.aiFocusVersion + 1 })),
  setIncludeSamples: (includeSamples) => set({ includeSamples }),
  setAiPreferences: (aiPreferences) => set({ aiPreferences: AiResponsePreferencesSchema.parse(aiPreferences) }),
  setLeftPaneRatio: (leftPaneRatio) => set({ leftPaneRatio: LeftPaneRatioSchema.parse(leftPaneRatio) }),
  setCodePaneRatio: (codePaneRatio) => set({ codePaneRatio: CodePaneRatioSchema.parse(codePaneRatio) }),
  startNewVisualization: () => set((state) => {
    const document = newWorkspaceDocument();
    return {
      ...activatedWorkspaceState(document, state.aiFocusVersion + 1),
      activeWorkspaceId: document.id,
      workspaceDocuments: [...replaceCapturedWorkspace(state), document],
    };
  }),
  closeAi: () => set({ aiOpen: false, aiPhase: "idle" }),
}));

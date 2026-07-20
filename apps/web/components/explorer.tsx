"use client";

import Editor, { type OnMount } from "@monaco-editor/react";
import {
  AiResponseSchema,
  GgsqlDraftSchema,
  QueryResultSchema,
  type DatasetManifest,
  type FieldMetadata,
  type TablePreview,
} from "@chartize/contracts";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type CSSProperties,
} from "react";
import { flushSync } from "react-dom";
import { z } from "zod";
import { AiAssistant } from "./ai-assistant";
import { GraphExplorationControls, MapExplorationControls } from "./chart-exploration-controls";
import { ChartView, type ChartViewHandle } from "./chart-view";
import { DataGrid } from "./data-grid";
import { DwimPanel, SourceTiles, type DwimSource } from "./dwim-panel";
import { EditableChartLabel } from "./editable-chart-label";
import { InlineQueryControls, type InlineControlAnchors } from "./inline-query-controls";
import { PanelResizer } from "./panel-resizer";
import { LocalEngineClient } from "@/lib/local/engine-client";
import { detectFormat, tableNameFromFile } from "@/lib/local/file-format";
import { loadWorkspace, saveWorkspace, type StoredLocalFile } from "@/lib/local/workspace-store";
import {
  addSelectedExpression,
  assertReadOnlyGgsql,
  collapseSingleSourceProjection,
  directManipulationRanges,
  queryControlOffsets,
  querySectionAtOffset,
  removeProjectionAlias,
  removeSelectedProjection,
  replaceQuerySources,
  resolveNamespacedSources,
  selectedProjectionLabels,
  sourceAlias,
  sourceFromQuery,
  sourcesFromQuery,
  splitGgsql,
  updateFirstVisual,
  visualSelectionFields,
  visualPointState,
} from "@/lib/ggsql/query-context";
import { makeBlankDraft, makeDefaultDraft, serializeDraft } from "@/lib/ggsql/serialize";
import {
  centeredDomain,
  describeChartExtent,
  describeChartSelection,
  mapFeatureSelectionFromTableRow,
  normalizeDomainValue,
  presentationFromSpec,
  previewFromSpec,
  selectionTableFromSpec,
  shiftedDomain,
  visualFieldsFromPreview,
} from "@/lib/workspace/chart-data";
import { fetchWarehouseCatalog, fetchWarehousePreview, fetchWarehouseQueryRow } from "@/lib/workspace/warehouse-client";
import {
  BUILTIN_DATASETS,
  EMPTY_TABLE,
  makeInitialWorkspaceDraft,
  useChartizeWorkspace,
  type AiContext,
  type ExecutionMode,
  type LocalDataset,
  type TableSort as Sort,
} from "@/lib/workspace/store";

interface CachedQuery {
  spec: Record<string, unknown>;
  selectedData: TablePreview;
  duration: number;
  source: string;
}

const APPROVAL_THRESHOLD = { fieldTitles: ["approve", "Approval"], value: 50, below: "#ee4266", above: "#147d76" } as const;

function draftForDataset(source: string, dataset: LocalDataset | DatasetManifest) {
  const draft = makeDefaultDraft(source);
  draft.tooltipFields = [];
  const fields = dataset.fields;
  if (dataset.spatial) {
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
    draft.title = dataset.title;
    draft.subtitle = dataset.description || "Map extent fitted to every returned geometry.";
    return draft;
  }
  const measures = fields.filter((field) => /int|double|float|decimal|number/i.test(field.dataType));
  const temporal = fields.find((field) => field.semanticType === "temporal" || /date|time|year/i.test(field.name));
  const dimensions = fields.filter((field) => !measures.includes(field) && field !== temporal && field.semanticType !== "identifier");
  const approval = fields.find((field) => field.name === "approve");
  draft.layers[0] = temporal && (approval || measures[0])
    ? { ...draft.layers[0]!, mark: "line", x: temporal.name, y: (approval ?? measures[0])!.name, color: "", fill: "", size: "" }
    : { ...draft.layers[0]!, x: dimensions[0]?.name ?? measures[0]?.name ?? "", y: measures[0]?.name ?? measures[1]?.name ?? "", color: dimensions[1]?.name ?? "", fill: "", size: "" };
  draft.title = dataset.title;
  draft.subtitle = dataset.description;
  draft.tooltipFields = [draft.layers[0]!.x, draft.layers[0]!.y].filter(Boolean);
  if (approval && temporal?.name === "end_date") {
    draft.scales = [{ aesthetic: "x", type: "", palette: "", transform: "date", labelFormat: "%B %-d, %Y" }];
    draft.axisLabels = { ...draft.axisLabels, x: "Poll Date", y: "Approval" };
  }
  return draft;
}

function quoteIdentifier(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

function quoteLocalSource(value: string) {
  return value.startsWith("ggsql:") ? value : quoteIdentifier(value);
}

const ShareStateSchema = z.object({
  query: z.string().optional(),
  draft: GgsqlDraftSchema.optional(),
  mode: z.enum(["local", "warehouse"]).optional(),
});

function decodeShareState(value: string) {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
  const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
  return ShareStateSchema.parse(JSON.parse(new TextDecoder().decode(bytes)));
}

function encodeShareState(value: unknown) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function downloadDataUrl(url: string, fileName: string) {
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
}

function remember<K, V>(cache: Map<K, V>, key: K, value: V, maximum: number) {
  cache.delete(key);
  cache.set(key, value);
  while (cache.size > maximum) cache.delete(cache.keys().next().value!);
}

function modeForSource(source: string, warehouse: DatasetManifest[]): ExecutionMode {
  if (source.startsWith("chartize:") || warehouse.some((dataset) => dataset.slug === source || dataset.tableName === source)) return "warehouse";
  return "local";
}

export function Explorer() {
  const firstDraft = useMemo(() => makeInitialWorkspaceDraft(), []);
  const workspace = useChartizeWorkspace();
  const {
    engineState, catalogLoaded, mode, localDatasets, warehouseDatasets, draft, query, spec,
    selectedData, fullData, resultTab, fullSort, dockSource, running, fullLoading,
    showLoadingMask, error, duration, editorContext, dwimStatus, inlineAnchors,
    gridSelection, selectionOrigin, chartSelection, chartDomains, chartDomainHistory, mapViewport, mapFeatureSelection, resultStatus,
    aiOpen, aiPlacement, aiContext, aiContextNote, aiPrompt, aiBusy, aiMessage,
    aiHistory, aiUsage, aiFocusVersion, includeSamples, aiPreferences, leftPaneRatio, codePaneRatio, editorFontSize,
    setEngineState, setCatalogLoaded, setMode, setLocalDatasets, setWarehouseDatasets,
    setDraft, setQuery, setSpec, setSelectedData, setFullData, setResultTab, setFullSort,
    setDockSource, setRunning, setFullLoading, setShowLoadingMask, setError, setDuration,
    setEditorContext, setDwimStatus, setInlineAnchors, setGridSelection, setSelectionOrigin,
    setChartSelection, setChartDomains, zoomChart, zoomChartOut, resetChartZoom, zoomMap, panMap, resetMapViewport, setMapFeatureSelection, setResultStatus, setFocusArea, setAiOpen,
    setAiPlacement, setAiContext, setAiContextNote, setAiPrompt, setAiBusy, setAiMessage, setAiHistory, setAiUsage,
    setIncludeSamples, setAiPreferences, requestAiFocus, setLeftPaneRatio, setCodePaneRatio, setEditorFontSize,
  } = workspace;
  const clientRef = useRef<LocalEngineClient | null>(null);
  const chartRef = useRef<ChartViewHandle>(null);
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const storedFilesRef = useRef<StoredLocalFile[]>([]);
  const autoRunTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initializedRef = useRef(false);
  const queryRef = useRef(query);
  const draftRef = useRef(draft);
  const runSequenceRef = useRef(0);
  const fullSequenceRef = useRef(0);
  const featureSequenceRef = useRef(0);
  const queryCacheRef = useRef(new Map<string, CachedQuery>());
  const tableCacheRef = useRef(new Map<string, TablePreview>());
  const workbenchRef = useRef<HTMLElement>(null);
  const workbenchGridRef = useRef<HTMLDivElement>(null);
  const editorStackRef = useRef<HTMLDivElement>(null);

  useEffect(() => { queryRef.current = query; }, [query]);
  useEffect(() => { draftRef.current = draft; }, [draft]);

  useEffect(() => {
    const root = workbenchRef.current;
    if (!root) return;
    let frame: number | null = null;
    let editorDelta = 0;
    const applyEditorZoom = () => {
      frame = null;
      if (Math.abs(editorDelta) < 0.5) { editorDelta = 0; return; }
      const state = useChartizeWorkspace.getState();
      const next = Math.max(10, Math.min(24, state.editorFontSize + (editorDelta < 0 ? 1 : -1)));
      editorDelta = 0;
      if (next === state.editorFontSize) return;
      state.setEditorFontSize(next);
      editorRef.current?.updateOptions({ fontSize: next, lineHeight: Math.round(next * 1.6) });
    };
    const lockPaneGesture = (event: WheelEvent) => {
      if (!event.ctrlKey || !(event.target instanceof Element) || !root.contains(event.target)) return;
      // macOS pinch arrives as a ctrl+wheel. Always consume it inside the
      // workbench so browser zoom cannot run alongside a pane interaction.
      event.preventDefault();
      if (event.target.closest(".chart-interaction")) {
        setFocusArea("chart");
        return;
      }
      if (event.target.closest(".monaco-editor")) {
        setFocusArea("code");
        editorDelta += event.deltaY;
        if (frame === null) frame = window.requestAnimationFrame(applyEditorZoom);
        return;
      }
      if (event.target.closest(".result-table-shell, .source-dock")) setFocusArea("table");
    };
    root.addEventListener("wheel", lockPaneGesture, { capture: true, passive: false });
    return () => {
      root.removeEventListener("wheel", lockPaneGesture, true);
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, [setFocusArea]);

  const activeSources = useMemo(() => sourcesFromQuery(query), [query]);
  const isBlankWorkspace = !query.trim();
  const activeSource = activeSources[0] ?? (isBlankWorkspace ? "" : sourceFromQuery(query, draft.source));
  const baseSources = useMemo<DwimSource[]>(() => [
    ...warehouseDatasets.map((dataset) => ({ id: `chartize:${dataset.slug}`, title: dataset.title, description: dataset.description, namespace: "chartize" as const, rows: dataset.rowCount, fields: dataset.fields })),
    ...localDatasets.map((dataset) => ({ id: dataset.tableName.startsWith("ggsql:") ? dataset.tableName : `user:${dataset.tableName}`, title: dataset.title, description: dataset.description, namespace: dataset.tableName.startsWith("ggsql:") ? "ggsql" as const : "user" as const, fields: dataset.fields })),
  ], [localDatasets, warehouseDatasets]);
  const activeEngine = activeSources[0]?.startsWith("chartize:") ? "warehouse" : "browser";
  const sources = useMemo<DwimSource[]>(() => baseSources.map((source) => ({
    ...source,
    disabled: activeSources.length > 0 && (source.namespace === "chartize" ? "warehouse" : "browser") !== activeEngine,
  })), [activeEngine, activeSources.length, baseSources]);
  const activeSourceDetails = useMemo(() => activeSources.flatMap((source) => {
    const match = baseSources.find((candidate) => candidate.id === source);
    return match ? [match] : [];
  }), [activeSources, baseSources]);
  const activeFields = useMemo(() => {
    const byName = new Map<string, FieldMetadata>();
    activeSourceDetails.forEach((source) => source.fields.forEach((field) => {
      if (!byName.has(field.name)) byName.set(field.name, field);
    }));
    return [...byName.values()];
  }, [activeSourceDetails]);
  const selectedProjectionNames = useMemo(() => selectedProjectionLabels(query), [query]);
  const selectedFieldNames = useMemo(() => new Set(selectedProjectionNames), [selectedProjectionNames]);
  const visualFields = useMemo(
    () => visualFieldsFromPreview(activeFields, selectedData, selectedProjectionNames),
    [activeFields, selectedData, selectedProjectionNames],
  );
  const visualState = useMemo(() => visualPointState(query), [query]);
  const chartLegendTitles = useMemo(() => ({
    colour: visualState.labelColor,
    fill: visualState.labelFill,
    size: visualState.labelSize,
    shape: visualState.labelShape,
    linetype: visualState.labelLinetype,
    linewidth: visualState.labelLinewidth,
    opacity: visualState.labelOpacity,
  }), [visualState]);
  const isMap = useMemo(() => /\bDRAW\s+spatial\b/i.test(splitGgsql(query).visual), [query]);
  const chartSelectionData = useMemo(() => selectionTableFromSpec(spec) ?? selectedData, [selectedData, spec]);
  const selectionFields = useMemo(() => visualSelectionFields(query), [query]);
  const chartSelectionDetails = useMemo(() => describeChartSelection(
    chartSelection,
    chartSelectionData,
    selectionFields.x,
    selectionFields.y,
    activeFields,
    visualState.labelX,
    visualState.labelY,
  ), [activeFields, chartSelection, chartSelectionData, selectionFields.x, selectionFields.y, visualState.labelX, visualState.labelY]);
  const aiView = useMemo(() => ({
    title: visualState.title || draft.title,
    subtitle: visualState.subtitle || draft.subtitle,
    sources: activeSourceDetails.map(({ id, title, description }) => ({ id, title, description })),
  }), [activeSourceDetails, draft.subtitle, draft.title, visualState.subtitle, visualState.title]);
  const aiViewNote = useMemo(() => {
    const title = aiView.title ? `Chart: “${aiView.title}”.` : "Untitled chart.";
    const subtitle = aiView.subtitle ? ` Subtitle: “${aiView.subtitle}”.` : "";
    const datasets = aiView.sources.length
      ? ` Active ${aiView.sources.length === 1 ? "dataset" : "datasets"}: ${aiView.sources.map((source) => `${source.title} (${source.id})`).join(", ")}.`
      : "";
    const extent = describeChartExtent(
      chartSelectionData,
      selectionFields.x,
      selectionFields.y,
      activeFields,
      visualState.labelX,
      visualState.labelY,
    );
    return `${title}${subtitle}${datasets}${extent ? ` ${extent}.` : ""}`;
  }, [activeFields, aiView, chartSelectionData, selectionFields.x, selectionFields.y, visualState.labelX, visualState.labelY]);
  const mapFeatureContext = useMemo(() => mapFeatureSelection
    ? `${aiViewNote} Selected map feature: ${mapFeatureSelection.title}. Attached feature values: ${mapFeatureSelection.values.map(({ field, value }) => `${field}=${value}`).join("; ")}. Treat this one geographic feature as the active subject unless the user broadens the question.`
    : "", [aiViewNote, mapFeatureSelection]);

  useEffect(() => {
    featureSequenceRef.current += 1;
    setMapFeatureSelection(null);
  }, [query, setMapFeatureSelection]);

  const selectMapFeature = useCallback((selection: Parameters<typeof setMapFeatureSelection>[0]) => {
    const requestId = ++featureSequenceRef.current;
    setSelectionOrigin("result");
    setGridSelection(null);
    setChartSelection(null);
    setMapFeatureSelection(selection);
    if (!selection?.pending || selection.rowIndex === undefined) return;

    const selectedQuery = queryRef.current;
    void (async () => {
      try {
        const executableQuery = resolveNamespacedSources(selectedQuery, (namespace, name) => {
          if (namespace === "chartize") return warehouseDatasets.find((dataset) => dataset.slug === name || dataset.tableName === name)?.tableName;
          return localDatasets.find((dataset) => dataset.tableName === name)?.tableName ?? name;
        });
        const sql = splitGgsql(executableQuery).sql.trim().replace(/;$/, "");
        if (!sql) throw new Error("The active map has no query to inspect.");
        const row = mode === "warehouse"
          ? await fetchWarehouseQueryRow(sql, selection.rowIndex!)
          : await clientRef.current?.sql(`SELECT * FROM (${sql}) AS chartize_selected_feature LIMIT 1 OFFSET ${selection.rowIndex}`);
        if (!row?.rows[0]) throw new Error("No feature details were returned.");
        const hydrated = mapFeatureSelectionFromTableRow(row.columns, row.rows[0], selection.pixels, selection.rowIndex);
        if (!hydrated) throw new Error("This feature has no readable attributes.");
        if (featureSequenceRef.current === requestId && queryRef.current === selectedQuery) setMapFeatureSelection(hydrated);
      } catch (cause) {
        if (featureSequenceRef.current !== requestId || queryRef.current !== selectedQuery) return;
        setMapFeatureSelection({
          ...selection,
          title: `map feature ${selection.rowIndex! + 1}`,
          pending: false,
          error: cause instanceof Error ? cause.message : "Feature details could not be loaded.",
        });
      }
    })();
  }, [localDatasets, mode, setChartSelection, setGridSelection, setMapFeatureSelection, setSelectionOrigin, warehouseDatasets]);

  // A general workspace conversation should follow the chart as it changes.
  // Narrow code and selection contexts remain pinned until the user replaces
  // them so their cursor/range reference is not silently lost.
  useEffect(() => {
    if (!aiOpen || aiBusy || aiContext !== "general") return;
    setAiContextNote(`${aiViewNote} Current query and source catalog are attached.`);
  }, [aiBusy, aiContext, aiOpen, aiViewNote, setAiContextNote]);

  useEffect(() => {
    const busy = running;
    if (!busy) { setShowLoadingMask(false); return; }
    const timer = window.setTimeout(() => setShowLoadingMask(true), 180);
    return () => window.clearTimeout(timer);
  }, [running]);

  const resolveExecutionQuery = useCallback((displayQuery: string) => resolveNamespacedSources(displayQuery, (namespace, name) => {
    if (namespace === "chartize") return warehouseDatasets.find((dataset) => dataset.slug === name || dataset.tableName === name)?.tableName;
    return localDatasets.find((dataset) => dataset.tableName === name)?.tableName ?? name;
  }), [localDatasets, warehouseDatasets]);

  const runQuery = useCallback(async (queryToRun?: string, requestedMode?: ExecutionMode) => {
    const displayQuery = queryToRun ?? queryRef.current;
    if (!displayQuery.trim()) {
      runSequenceRef.current += 1;
      setRunning(false);
      setShowLoadingMask(false);
      setSpec(null);
      setSelectedData({ ...EMPTY_TABLE, limit: 200 });
      setError("");
      setDuration(0);
      setGridSelection(null);
      setChartSelection(null);
      resetChartZoom();
      return { ok: true as const };
    }
    const displaySources = sourcesFromQuery(displayQuery);
    const displaySource = displaySources[0] ?? sourceFromQuery(displayQuery, draftRef.current.source);
    const sourceModes = new Set(displaySources.map((source) => modeForSource(source, warehouseDatasets)));
    if (sourceModes.size > 1) {
      const message = "A query cannot mix VPS warehouse sources with browser-only sources.";
      setError(message);
      return { ok: false as const, error: message };
    }
    const executionMode = requestedMode ?? sourceModes.values().next().value ?? modeForSource(displaySource, warehouseDatasets);
    const runId = ++runSequenceRef.current;
    setRunning(true);
    setError("");
    const started = performance.now();
    try {
      assertReadOnlyGgsql(displayQuery);
      const executableQuery = resolveExecutionQuery(displayQuery);
      assertReadOnlyGgsql(executableQuery);
      const version = executionMode === "warehouse"
        ? displaySources.map((source) => warehouseDatasets.find((dataset) => `chartize:${dataset.slug}` === source || dataset.tableName === source)?.version ?? "current").join("+")
        : "browser";
      const cacheKey = `${executionMode}:${version}:${executableQuery}`;
      const cached = queryCacheRef.current.get(cacheKey);
      let result: CachedQuery;
      if (cached) {
        queryCacheRef.current.delete(cacheKey);
        queryCacheRef.current.set(cacheKey, cached);
        result = cached;
      } else if (executionMode === "warehouse") {
        const response = await fetch("/engine/api/query", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ggsql: executableQuery }),
        });
        const body = await response.json() as unknown;
        if (!response.ok) throw new Error(typeof body === "object" && body && "error" in body ? String(body.error) : `Warehouse returned ${response.status}`);
        const parsed = QueryResultSchema.parse(body);
        result = { spec: parsed.spec, selectedData: parsed.selectedData ?? previewFromSpec(parsed.spec), duration: Math.round(parsed.durationMs), source: displaySource };
        remember(queryCacheRef.current, cacheKey, result, 5);
      } else {
        const nextSpec = await clientRef.current?.run<Record<string, unknown>>(executableQuery);
        if (!nextSpec) throw new Error("The local engine has not initialized.");
        const sql = splitGgsql(executableQuery).sql.trim().replace(/;$/, "");
        const table = await clientRef.current?.sql(`SELECT * FROM (${sql}) AS chartize_selected LIMIT 200`);
        const count = await clientRef.current?.sql(`SELECT COUNT(*) AS total FROM (${sql}) AS chartize_selected`);
        const totalRows = Number(count?.rows[0]?.[0] ?? table?.rows.length ?? 0);
        result = {
          spec: nextSpec,
          selectedData: { columns: table?.columns ?? [], rows: table?.rows ?? [], totalRows: Number.isFinite(totalRows) ? totalRows : table?.rows.length ?? 0, offset: 0, limit: 200 },
          duration: Math.round(performance.now() - started),
          source: displaySource,
        };
        remember(queryCacheRef.current, cacheKey, result, 5);
      }
      if (runId !== runSequenceRef.current) return { ok: false as const, error: "A newer query replaced this run." };
      setSpec(result.spec);
      setSelectedData(result.selectedData);
      setDuration(result.duration);
      setMode(executionMode);
      setGridSelection(null);
      resetChartZoom();
      const presentation = presentationFromSpec(result.spec);
      setDraft((current) => ({
        ...current,
        source: result.source,
        ...(presentation.title !== undefined ? { title: presentation.title, subtitle: presentation.subtitle ?? "" } : {}),
      }));
      return { ok: true as const };
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      if (runId === runSequenceRef.current) setError(message);
      return { ok: false as const, error: message };
    } finally {
      if (runId === runSequenceRef.current) setRunning(false);
    }
  }, [resolveExecutionQuery, setDraft, warehouseDatasets]);

  const scheduleRun = useCallback((nextQuery: string, nextMode?: ExecutionMode) => {
    if (autoRunTimerRef.current) clearTimeout(autoRunTimerRef.current);
    autoRunTimerRef.current = setTimeout(() => void runQuery(nextQuery, nextMode), 260);
  }, [runQuery]);

  useEffect(() => {
    const switched = () => {
      if (autoRunTimerRef.current) clearTimeout(autoRunTimerRef.current);
      initializedRef.current = true;
      runSequenceRef.current += 1;
      fullSequenceRef.current += 1;
      const state = useChartizeWorkspace.getState();
      queryRef.current = state.query;
      draftRef.current = state.draft;
      void runQuery(state.query, state.mode);
      window.requestAnimationFrame(() => state.focusArea === "code" && editorRef.current?.focus());
    };
    window.addEventListener("chartize:workspace-switched", switched);
    return () => window.removeEventListener("chartize:workspace-switched", switched);
  }, [runQuery]);

  const runEditorQuery = useCallback(() => {
    const currentQuery = editorRef.current?.getValue() ?? queryRef.current;
    setQuery(currentQuery);
    return runQuery(currentQuery);
  }, [runQuery, setQuery]);

  const applyDataset = useCallback((source: string, dataset: LocalDataset | DatasetManifest, autoRun = true) => {
    const nextDraft = draftForDataset(source, dataset);
    const nextQuery = serializeDraft(nextDraft);
    const nextMode = source.startsWith("chartize:") ? "warehouse" : "local";
    setDraft(nextDraft);
    setQuery(nextQuery);
    setMode(nextMode);
    setFullSort(null);
    setDockSource(source);
    setEditorContext(null);
    resetMapViewport();
    if (autoRun) scheduleRun(nextQuery, nextMode);
  }, [resetMapViewport, scheduleRun, setDraft, setQuery]);

  const toggleSource = useCallback((source: string, enabled: boolean) => {
    const current = sourcesFromQuery(queryRef.current);
    if (enabled && current.includes(source)) return;
    if (!enabled && current.length <= 1) {
      setDwimStatus("A SELECT needs at least one FROM source.");
      return;
    }
    const sourceMode = modeForSource(source, warehouseDatasets);
    const currentMode = current[0] ? modeForSource(current[0], warehouseDatasets) : sourceMode;
    if (enabled && current.length && sourceMode !== currentMode) {
      setDwimStatus("VPS and browser-only tables cannot be joined in one query. Start a separate browser query for user: sources.");
      return;
    }
    const nextSources = enabled ? [...current, source] : current.filter((item) => item !== source);
    let nextQuery = queryRef.current;
    if (!enabled) {
      nextQuery = removeProjectionAlias(nextQuery, sourceAlias(source, Math.max(0, current.indexOf(source))));
    }
    nextQuery = replaceQuerySources(nextQuery, nextSources);
    if (nextSources.length === 1) nextQuery = collapseSingleSourceProjection(nextQuery, sourceAlias(nextSources[0]!));
    setQuery(nextQuery);
    setMode(currentMode);
    setDockSource((selected) => nextSources.includes(selected) ? selected : nextSources[0]!);
    setDwimStatus(enabled
      ? `${source} added as a CROSS JOIN. Add a join condition in GGSQL before running a large combination.`
      : `${source} removed from FROM.`);
  }, [setQuery, warehouseDatasets]);

  const inspectLocalFields = useCallback(async (tableName: string) => {
    const info = await clientRef.current?.describe(tableName);
    const nameIndex = info?.columns.indexOf("name") ?? -1;
    const typeIndex = info?.columns.indexOf("type") ?? -1;
    return (info?.rows ?? []).map((row): FieldMetadata => ({
      name: row[nameIndex] ?? row[1] ?? "field",
      dataType: row[typeIndex] ?? row[2] ?? "VARCHAR",
      nullable: true,
      semanticType: (row[nameIndex] ?? row[1]) === "geometry" ? "geometry" : undefined,
    }));
  }, [aiView]);

  const addFiles = useCallback(async (fileList: FileList) => {
    for (const file of Array.from(fileList)) {
      try {
        if (file.size > 100 * 1024 * 1024) throw new Error(`${file.name} exceeds the 100 MB browser safety limit.`);
        setRunning(true);
        const format = detectFormat(file);
        const tableName = tableNameFromFile(file.name);
        const original = await file.arrayBuffer();
        await clientRef.current?.register(tableName, format, original.slice(0));
        const fields = await inspectLocalFields(tableName);
        const dataset: LocalDataset = {
          id: crypto.randomUUID(),
          title: file.name.replace(/\.[^.]+$/, "").replaceAll(/[_-]+/g, " "),
          tableName,
          description: `${file.name} · ${(file.size / 1024).toFixed(1)} KB · private to this browser`,
          spatial: format === "geojson" || format === "shapefile" || format === "geoparquet",
          fields,
          fileName: file.name,
        };
        storedFilesRef.current = [...storedFilesRef.current.filter((stored) => tableNameFromFile(stored.name) !== tableName), { name: file.name, type: file.type, bytes: original }];
        setLocalDatasets((current) => [...current.filter((item) => item.tableName !== tableName), dataset]);
        queryCacheRef.current.clear();
        tableCacheRef.current.clear();
        applyDataset(`user:${tableName}`, dataset);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : String(cause));
      } finally {
        setRunning(false);
      }
    }
  }, [applyDataset, inspectLocalFields]);

  useEffect(() => {
    const client = new LocalEngineClient();
    clientRef.current = client;
    void client.init(process.env.NEXT_PUBLIC_SPATIALITE_WASM_URL ?? "/wasm/mod_spatialite.wasm")
      .then(() => setEngineState("ready"))
      .catch((cause: unknown) => { setEngineState("error"); setError(cause instanceof Error ? cause.message : String(cause)); });
    return () => {
      client.destroy();
      if (autoRunTimerRef.current) clearTimeout(autoRunTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const dismissOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || aiOpen) return;
      const consume = () => {
        event.preventDefault();
        event.stopImmediatePropagation();
      };
      const openMenus = [...document.querySelectorAll<HTMLDetailsElement>("details[data-dismiss-on-outside][open]")];
      if (openMenus.length) {
        openMenus.at(-1)?.removeAttribute("open");
        consume();
        return;
      }
      if (editorContext) {
        setEditorContext(null);
        consume();
        return;
      }
      if (gridSelection || chartSelection) {
        setGridSelection(null);
        setChartSelection(null);
        setResultStatus("");
        consume();
      }
    };
    document.addEventListener("keydown", dismissOnEscape, true);
    return () => document.removeEventListener("keydown", dismissOnEscape, true);
  }, [aiOpen, chartSelection, editorContext, gridSelection, setChartSelection, setEditorContext, setGridSelection, setResultStatus]);

  useEffect(() => {
    if (catalogLoaded) return;
    void fetchWarehouseCatalog()
      .then(setWarehouseDatasets)
      .catch(() => setWarehouseDatasets([]))
      .finally(() => setCatalogLoaded(true));
  }, [catalogLoaded, setCatalogLoaded, setWarehouseDatasets]);

  useEffect(() => {
    const dismissTransientMenus = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      document.querySelectorAll<HTMLDetailsElement>("details[data-dismiss-on-outside][open]").forEach((details) => {
        if (!details.contains(target)) details.removeAttribute("open");
      });
    };
    document.addEventListener("pointerdown", dismissTransientMenus, true);
    return () => document.removeEventListener("pointerdown", dismissTransientMenus, true);
  }, []);

  useEffect(() => {
    if (engineState !== "ready" || !catalogLoaded || initializedRef.current) return;
    initializedRef.current = true;
    if (new URLSearchParams(window.location.search).has("workspace")) {
      const state = useChartizeWorkspace.getState();
      queryRef.current = state.query;
      draftRef.current = state.draft;
      void runQuery(state.query, state.mode);
      return;
    }
    const hash = window.location.hash.match(/^#view=(.+)$/)?.[1];
    if (hash) {
      const state = decodeShareState(hash);
      const nextDraft = state.draft ?? firstDraft;
      const nextQuery = state.query ?? serializeDraft(nextDraft);
      setDraft(nextDraft);
      setQuery(nextQuery);
      void runQuery(nextQuery, state.mode);
      return;
    }
    const featured = warehouseDatasets.find((dataset) => dataset.slug === "presidential_approval_average") ?? warehouseDatasets[0];
    if (featured) {
      const nextDraft = featured.slug === "presidential_approval_average"
        ? firstDraft
        : draftForDataset(`chartize:${featured.slug}`, featured);
      const nextQuery = serializeDraft(nextDraft);
      setDraft(nextDraft);
      setQuery(nextQuery);
      void runQuery(nextQuery, "warehouse");
    } else {
      const fallback = BUILTIN_DATASETS[0]!;
      const nextDraft = draftForDataset(fallback.tableName, fallback);
      const nextQuery = serializeDraft(nextDraft);
      setDraft(nextDraft);
      setQuery(nextQuery);
      void runQuery(nextQuery, "local");
    }
  }, [catalogLoaded, engineState, firstDraft, runQuery, setDraft, setQuery, warehouseDatasets]);

  const promoteAi = useCallback((contextNote: string, placement: "left" | "right" = "left", context: AiContext = "general", origin?: HTMLElement) => {
    if (origin) origin.style.viewTransitionName = "chartize-ai-entry";
    const commit = () => {
      origin?.style.removeProperty("view-transition-name");
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      setAiContextNote(contextNote);
      setAiPlacement(placement);
      setAiContext(context);
      setEditorContext(null);
      setAiOpen(true);
      requestAiFocus();
      window.dispatchEvent(new CustomEvent("chartize:ai-opened"));
    };
    const transition = (document as Document & {
      startViewTransition?: (update: () => void) => {
        ready?: Promise<unknown>;
        updateCallbackDone?: Promise<unknown>;
        finished?: Promise<unknown>;
      };
    }).startViewTransition;
    if (!transition) {
      commit();
      return;
    }
    try {
      const result = transition.call(document, () => flushSync(commit));
      // A rapid context switch can intentionally supersede the previous view
      // transition. Chrome rejects its lifecycle promises in that case; those
      // are animation cancellations, not application errors.
      void result.ready?.catch(() => undefined);
      void result.updateCallbackDone?.catch(() => undefined);
      void result.finished?.catch(() => undefined);
    } catch {
      commit();
    }
  }, [requestAiFocus, setAiContext, setAiContextNote, setAiOpen, setAiPlacement, setEditorContext]);

  useEffect(() => {
    const openAssistant = () => promoteAi(`${aiViewNote} Current query and source catalog are attached.`, "left", "general");
    window.addEventListener("chartize:open-ai", openAssistant);
    if (new URLSearchParams(window.location.search).get("ai") === "general") openAssistant();
    return () => window.removeEventListener("chartize:open-ai", openAssistant);
  }, [aiViewNote, promoteAi]);

  const closeAssistant = useCallback(() => {
    setAiOpen(false);
    window.dispatchEvent(new CustomEvent("chartize:ai-closed"));
  }, []);

  const handleEditorMount: OnMount = useCallback((editor, monaco) => {
    editorRef.current = editor;
    const editorInput = editor.getDomNode()?.querySelector<HTMLTextAreaElement>("textarea");
    if (editorInput) {
      editorInput.id = "chartize-ggsql-editor";
      editorInput.name = "chartize-ggsql-editor";
    }
    let userActivated = false;
    const decorations = editor.createDecorationsCollection();
    const refreshDirectControls = () => {
      const model = editor.getModel();
      if (!model) return;
      decorations.set(directManipulationRanges(model.getValue()).map((item) => {
        const start = model.getPositionAt(item.start);
        const end = model.getPositionAt(item.end);
        return {
          range: new monaco.Range(start.lineNumber, start.column, end.lineNumber, end.column),
          options: {
            inlineClassName: `monaco-direct-token ${item.kind}`,
            after: { content: "⌄", inlineClassName: "monaco-direct-caret" },
            hoverMessage: { value: `Click or place the cursor here to edit this ${item.kind}.` },
          },
        };
      }));
      const offsets = queryControlOffsets(model.getValue());
      if (!offsets) { setInlineAnchors(null); return; }
      const locateOffset = (offset: number) => {
        const visible = editor.getScrolledVisiblePosition(model.getPositionAt(offset));
        const bounds = editor.getDomNode()?.getBoundingClientRect();
        return visible && bounds
          ? { left: bounds.left + visible.left + 8, top: bounds.top + visible.top + visible.height / 2 }
          : null;
      };
      const select = locateOffset(offsets.select);
      const from = locateOffset(offsets.from);
      setInlineAnchors(select && from ? { select, from } : null);
    };
    const locate = () => {
      const model = editor.getModel();
      const selection = editor.getSelection();
      const position = editor.getPosition();
      if (!model || !selection || !position) return;
      const hasSelection = !selection.isEmpty();
      const selectedText = hasSelection ? model.getValueInRange(selection) : "";
      const anchor = hasSelection ? selection.getEndPosition() : position;
      const visible = editor.getScrolledVisiblePosition(anchor);
      const offset = model.getOffsetAt(anchor);
      const section = querySectionAtOffset(model.getValue(), offset, hasSelection);
      const bounds = editor.getDomNode()?.getBoundingClientRect();
      const panelHeight = section === "visual" ? 620 : 520;
      // Wrapping and horizontal scrolling make glyph-based x coordinates jump.
      // Anchor every contextual panel to the stable editor/right-pane divider.
      const left = Math.max(12, Math.min((bounds?.right ?? window.innerWidth * .44) + 1, window.innerWidth - 360));
      const top = Math.max(48, Math.min((bounds?.top ?? 40) + (visible?.top ?? 20) + (visible?.height ?? 20) + 8, window.innerHeight - panelHeight - 12));
      setEditorContext({ section, selectedText, offset, left, top });
      setDwimStatus("");
    };
    const activate = () => {
      userActivated = true;
      setFocusArea("code");
      requestAnimationFrame(locate);
    };
    const locateAfterActivation = () => {
      if (userActivated) locate();
    };
    const disposables = [
      editor.onMouseDown(activate),
      editor.onKeyDown(activate),
      editor.onDidChangeCursorPosition(locateAfterActivation),
      editor.onDidChangeCursorSelection(locateAfterActivation),
      editor.onDidChangeModelContent(refreshDirectControls),
      editor.onDidScrollChange(() => { refreshDirectControls(); locateAfterActivation(); }),
      editor.onDidLayoutChange(refreshDirectControls),
    ];
    editor.addCommand(monaco.KeyCode.Escape, () => setEditorContext(null));
    requestAnimationFrame(refreshDirectControls);
    return () => {
      decorations.clear();
      disposables.forEach((disposable) => disposable.dispose());
    };
  }, [setDwimStatus, setEditorContext, setFocusArea, setInlineAnchors]);

  const updateQueryImmediately = useCallback((nextQuery: string) => {
    setQuery(nextQuery);
    scheduleRun(nextQuery, modeForSource(sourceFromQuery(nextQuery, draftRef.current.source), warehouseDatasets));
  }, [scheduleRun, setQuery, warehouseDatasets]);

  const toggleColumn = useCallback((source: string, field: FieldMetadata, enabled: boolean) => {
    const querySources = sourcesFromQuery(queryRef.current);
    const sourceIndex = Math.max(0, querySources.indexOf(source));
    const alias = sourceAlias(source, sourceIndex);
    const outputName = querySources.length > 1 ? `${alias}__${field.name}` : field.name;
    const labels = selectedProjectionLabels(queryRef.current);
    const existing = labels.includes(outputName) ? outputName : labels.includes(field.name) ? field.name : outputName;
    const nextQuery = enabled
      ? addSelectedExpression(queryRef.current, querySources.length > 1 ? `${quoteIdentifier(alias)}.${quoteIdentifier(field.name)} AS ${quoteIdentifier(outputName)}` : quoteIdentifier(field.name), outputName)
      : removeSelectedProjection(queryRef.current, existing);
    if (nextQuery === queryRef.current) return;
    if (querySources.length > 1) {
      setQuery(nextQuery);
      setDwimStatus("SELECT updated. Review the multi-source join, then press run.");
    } else updateQueryImmediately(nextQuery);
  }, [setDwimStatus, setQuery, updateQueryImmediately]);

  const removeColumn = useCallback((field: string) => {
    const nextQuery = removeSelectedProjection(queryRef.current, field);
    if (nextQuery !== queryRef.current) updateQueryImmediately(nextQuery);
  }, [updateQueryImmediately]);

  const updateVisual = useCallback((next: Parameters<typeof updateFirstVisual>[1]) => {
    updateQueryImmediately(updateFirstVisual(queryRef.current, next));
  }, [updateQueryImmediately]);

  const editChartLabel = useCallback((kind: "title" | "subtitle", value: string) => {
    setDraft((current) => ({ ...current, [kind]: value }));
    updateQueryImmediately(updateFirstVisual(queryRef.current, { [kind]: value }));
  }, [setDraft, updateQueryImmediately]);

  const loadFullTable = useCallback(async (source: string, offset: number, sort: Sort, append = false) => {
    if (!source) return;
    const requestId = ++fullSequenceRef.current;
    const sourceMode = modeForSource(source, warehouseDatasets);
    const version = sourceMode === "warehouse" ? warehouseDatasets.find((dataset) => `chartize:${dataset.slug}` === source || dataset.tableName === source)?.version ?? "current" : "browser";
    const key = `${sourceMode}:${version}:${source}:${offset}:${sort?.column ?? ""}:${sort?.direction ?? ""}`;
    const cached = tableCacheRef.current.get(key);
    const commit = (table: TablePreview) => setFullData((current) => append
      ? { ...table, offset: 0, rows: [...current.rows, ...table.rows] }
      : { ...table, offset: 0 });
    if (cached) { commit(cached); return; }
    setFullLoading(true);
    try {
      let table: TablePreview;
      if (sourceMode === "warehouse") {
        const slug = source.startsWith("chartize:") ? source.slice("chartize:".length) : source;
        table = await fetchWarehousePreview({ slug, version, offset, sort });
      } else {
        const name = source.startsWith("user:") ? source.slice("user:".length) : source;
        const order = sort ? ` ORDER BY ${quoteIdentifier(sort.column)} ${sort.direction.toUpperCase()} NULLS LAST` : "";
        const page = await clientRef.current?.sql(`SELECT * FROM ${quoteLocalSource(name)}${order} LIMIT 100 OFFSET ${offset}`);
        const count = await clientRef.current?.sql(`SELECT COUNT(*) AS total FROM ${quoteLocalSource(name)}`);
        table = { columns: page?.columns ?? [], rows: page?.rows ?? [], totalRows: Number(count?.rows[0]?.[0] ?? 0), offset, limit: 100 };
      }
      remember(tableCacheRef.current, key, table, 16);
      if (requestId === fullSequenceRef.current) commit(table);
    } catch (cause) {
      if (requestId === fullSequenceRef.current) setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      if (requestId === fullSequenceRef.current) setFullLoading(false);
    }
  }, [setError, setFullData, setFullLoading, warehouseDatasets]);

  useEffect(() => {
    setFullSort(null);
    setFullData(EMPTY_TABLE);
  }, [dockSource, setFullData, setFullSort]);

  useEffect(() => {
    if (dockSource && !fullData.rows.length && !fullLoading) void loadFullTable(dockSource, 0, fullSort);
  }, [dockSource, fullData.rows.length, fullLoading, fullSort, loadFullTable]);

  useEffect(() => {
    if (!activeSources.length) return;
    setDockSource((current) => activeSources.includes(current) ? current : activeSources[0]!);
  }, [activeSources, setDockSource]);

  const sortFullTable = useCallback((column: string) => {
    setFullData(EMPTY_TABLE);
    setFullSort((current) => current?.column === column
      ? { column, direction: current.direction === "asc" ? "desc" : "asc" }
      : { column, direction: "asc" });
  }, [setFullData, setFullSort]);

  const loadMoreFullTable = useCallback(() => {
    if (fullLoading || !dockSource || fullData.rows.length >= fullData.totalRows) return;
    void loadFullTable(dockSource, fullData.rows.length, fullSort, true);
  }, [dockSource, fullData.rows.length, fullData.totalRows, fullLoading, fullSort, loadFullTable]);

  const addColumnFromTable = useCallback((column: string) => {
    const source = baseSources.find((candidate) => candidate.id === dockSource);
    const field = source?.fields.find((candidate) => candidate.name === column)
      ?? { name: column, dataType: "VARCHAR", nullable: true };
    toggleColumn(dockSource, field, true);
  }, [baseSources, dockSource, toggleColumn]);

  const askAi = useCallback(async (task: "generate" | "repair" | "explain", requestOverride?: string, retryAssistantIndex?: number) => {
    if (aiBusy) return;
    if (!catalogLoaded) {
      setAiMessage("The data catalog is still loading.");
      return;
    }
    let branchHistory = aiHistory;
    let retriedRequest = requestOverride?.trim() ?? "";
    if (retryAssistantIndex !== undefined) {
      let userIndex = retryAssistantIndex - 1;
      while (userIndex >= 0 && aiHistory[userIndex]?.role !== "user") userIndex -= 1;
      if (userIndex < 0) return;
      retriedRequest = aiHistory[userIndex]!.text;
      branchHistory = aiHistory.slice(0, userIndex);
    }
    const request = retriedRequest || aiPrompt.trim() || (task === "explain"
      ? aiContext === "code" ? "Explain the current GGSQL, including how its VISUALISE clauses produce this chart." : "Explain the current chart and the GGSQL that produces it."
      : "Repair the current query.");
    const history = branchHistory.slice(-12);
    const contextualData = mapFeatureSelection
      ? { columns: mapFeatureSelection.values.map(({ field }) => field), rows: [mapFeatureSelection.values.map(({ value }) => value)] }
      : gridSelection
      ? { columns: gridSelection.columns, rows: gridSelection.rows }
      : chartSelectionDetails.rows.length
        ? { columns: chartSelectionData.columns, rows: chartSelectionDetails.rows }
        : { columns: selectedData.columns, rows: selectedData.rows };
    setAiBusy(true);
    setAiMessage("");
    setAiHistory([...branchHistory, { role: "user", text: request }]);
    setAiPrompt("");
    try {
      const response = await fetch("/api/ai/query", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          task,
          context: aiContext,
          contextNote: aiContextNote,
          request,
          currentQuery: queryRef.current,
          source: activeSource || undefined,
          schema: activeFields,
          availableSources: baseSources.map(({ id, title, description, fields }) => ({ id, title, description, fields })),
          view: aiView,
          preferences: aiPreferences,
          sampleData: includeSamples ? { columns: contextualData.columns, rows: contextualData.rows.slice(0, 20) } : undefined,
          history,
        }),
      });
      const responseBody: unknown = await response.json();
      if (!response.ok || (typeof responseBody === "object" && responseBody !== null && "error" in responseBody)) {
        throw new Error(typeof responseBody === "object" && responseBody !== null && "error" in responseBody && typeof responseBody.error === "string" ? responseBody.error : "AI request failed.");
      }
      const body = AiResponseSchema.parse(responseBody);
      setAiUsage(body.usage);
      const reply = [
        body.explanation.trim(),
        aiPreferences.technical && body.assumptions.length ? `Assumptions: ${body.assumptions.join(" ")}` : "",
        (aiPreferences.technical || aiPreferences.challenge) && body.warnings.length ? `Check: ${body.warnings.join(" ")}` : "",
        body.sources.length ? `Sources: ${body.sources.map((source) => `[${source.title}](${source.url})`).join(" · ")}` : "",
      ].filter(Boolean).join("\n\n");
      if (body.kind === "visualization") {
        assertReadOnlyGgsql(body.query);
        resetMapViewport();
        const runResult = await runQuery(body.query);
        if (!runResult.ok) {
          const failure = `I couldn't apply that visualization yet.\n\n> ${runResult.error}\n\nUse **redo** below to let me repair it from the same prompt.`;
          setAiHistory((current) => [...current, { role: "assistant", text: `${reply}\n\n${failure}` }]);
          return;
        }
        setDraft(body.draft);
        setQuery(body.query);
      }
      setAiHistory((current) => [...current, { role: "assistant", text: reply }]);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      setAiHistory((current) => [...current, {
        role: "assistant",
        text: `I hit a workspace error before I could finish.\n\n> ${message}\n\nUse **redo** below to try this turn again.`,
      }]);
      setAiMessage("");
    } finally {
      setAiBusy(false);
    }
  }, [activeFields, activeSource, aiBusy, aiContext, aiContextNote, aiHistory, aiPreferences, aiPrompt, aiView, baseSources, catalogLoaded, chartSelectionData.columns, chartSelectionDetails.rows, gridSelection, includeSamples, mapFeatureSelection, resetMapViewport, runQuery, selectedData.columns, selectedData.rows, setAiBusy, setAiHistory, setAiMessage, setAiPrompt, setAiUsage, setDraft, setQuery]);

  const saveLocal = useCallback(async () => {
    await saveWorkspace({ id: "current", title: draftRef.current.title, query: queryRef.current, draft: draftRef.current, files: storedFilesRef.current, savedAt: new Date().toISOString() });
    setAiMessage("Workspace saved in this browser.");
  }, []);

  const restoreLocal = useCallback(async () => {
    const stored = await loadWorkspace();
    if (!stored) { setAiMessage("No saved browser workspace was found."); return; }
    const restored: LocalDataset[] = [];
    for (const file of stored.files) {
      const browserFile = new File([file.bytes], file.name, { type: file.type });
      const format = detectFormat(browserFile);
      const tableName = tableNameFromFile(file.name);
      await clientRef.current?.register(tableName, format, file.bytes.slice(0));
      restored.push({ id: crypto.randomUUID(), title: file.name.replace(/\.[^.]+$/, "").replaceAll(/[_-]+/g, " "), tableName, description: `${file.name} · restored from this browser`, spatial: format === "geojson" || format === "shapefile" || format === "geoparquet", fields: await inspectLocalFields(tableName), fileName: file.name });
    }
    storedFilesRef.current = stored.files;
    setLocalDatasets([...BUILTIN_DATASETS, ...restored]);
    setDraft(GgsqlDraftSchema.parse(stored.draft));
    setQuery(stored.query);
    await runQuery(stored.query, "local");
    setAiMessage("Browser workspace restored.");
  }, [inspectLocalFields, runQuery, setDraft, setQuery]);

  const shareView = useCallback(async () => {
    window.location.hash = `view=${encodeShareState({ query: queryRef.current, draft: draftRef.current, mode })}`;
    await navigator.clipboard.writeText(window.location.href);
    setAiMessage("Share URL copied. Local file bytes are not included.");
  }, [mode]);

  const exportChart = useCallback(async (format: "png" | "svg") => {
    try {
      const url = format === "png" ? await chartRef.current?.toPng() : await chartRef.current?.toSvg();
      if (url) downloadDataUrl(url, `chartize-${Date.now()}.${format}`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
  }, []);

  const exportShareCard = useCallback(async () => {
    try {
      const chartUrl = await chartRef.current?.toPng(false);
      if (!chartUrl) throw new Error("Run a chart before exporting a share card.");
      const copy = { headline: draftRef.current.title, dek: draftRef.current.subtitle };
      const canvas = document.createElement("canvas");
      canvas.width = 1200; canvas.height = 630;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas export is unavailable.");
      context.fillStyle = "#f4f7f6"; context.fillRect(0, 0, 1200, 630);
      context.fillStyle = "#3cbbb1"; context.fillRect(0, 0, 18, 630);
      context.fillStyle = "#0a0f0d"; context.font = "300 48px system-ui"; context.fillText(copy.headline.slice(0, 42), 55, 90);
      context.fillStyle = "#596662"; context.font = "22px system-ui"; context.fillText(copy.dek.slice(0, 72), 55, 135);
      const image = new Image();
      image.onload = () => { context.fillStyle = "#fff"; context.fillRect(55, 170, 1090, 385); context.drawImage(image, 75, 185, 1050, 355); context.fillStyle = "#0a0f0d"; context.font = "650 18px system-ui"; context.fillText("chartize", 55, 595); downloadDataUrl(canvas.toDataURL("image/png"), `chartize-card-${Date.now()}.png`); };
      image.src = chartUrl;
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
  }, []);

  const selectedSetForGrid = selectedFieldNames;
  const dockSelectedSet = useMemo(() => {
    const sourceIndex = Math.max(0, activeSources.indexOf(dockSource));
    const alias = sourceAlias(dockSource, sourceIndex);
    return new Set(fullData.columns.filter((column) => selectedFieldNames.has(column) || selectedFieldNames.has(`${alias}__${column}`)));
  }, [activeSources, dockSource, fullData.columns, selectedFieldNames]);
  const zoomToChartSelection = () => {
    if (!chartSelection?.x || !chartSelection.y) return;
    zoomChart({
      x: chartSelection.x.map(normalizeDomainValue) as [unknown, unknown],
      y: chartSelection.y.map(normalizeDomainValue) as [unknown, unknown],
    });
  };
  const zoomChartCentered = (factor: number) => {
    const visible = chartRef.current?.getDomains();
    const x = centeredDomain(visible?.x, factor);
    const y = centeredDomain(visible?.y, factor);
    if (!x && !y) {
      setResultStatus("Centered zoom is available on numeric and time scales.");
      return;
    }
    zoomChart({ ...(x ? { x } : {}), ...(y ? { y } : {}) });
  };
  const gestureZoomChart = (factor: number) => {
    const visible = chartRef.current?.getDomains();
    const x = centeredDomain(visible?.x, factor);
    const y = centeredDomain(visible?.y, factor);
    if (x || y) setChartDomains({ ...(x ? { x } : {}), ...(y ? { y } : {}) });
  };
  const gesturePanChart = (horizontal: number, vertical: number) => {
    const visible = chartRef.current?.getDomains();
    const x = shiftedDomain(visible?.x, horizontal);
    const y = shiftedDomain(visible?.y, vertical);
    if (x || y) setChartDomains({ ...(x ? { x } : {}), ...(y ? { y } : {}) });
  };
  const selectionActions = (origin: "dock" | "result") => {
    const selectedGrid = selectionOrigin === origin ? gridSelection : null;
    const selectedChart = origin === "result" ? chartSelection : null;
    if (!selectedGrid && !selectedChart) return null;
    const selectedMap = Boolean(selectedChart && isMap);
    const context = selectedGrid
      ? `${aiViewNote} Data selection: ${selectedGrid.summary}. Columns: ${selectedGrid.columns.join(", ")}. Row values are attached only when the user enables the sample-row control.`
      : selectedMap
        ? `${aiViewNote} Map selection: a rectangular map area is selected. Use the map subject, legend, current query, and attached data to interpret the places inside it.`
        : `${aiViewNote} Chart selection: ${chartSelectionDetails.summary}. X range: ${JSON.stringify(selectedChart?.x)}. Y range: ${JSON.stringify(selectedChart?.y)}.`;
    const selectionTitle = selectedGrid ? "data selection" : selectedMap ? "map selection" : "chart selection";
    const selectionSummary = selectedGrid?.summary ?? (selectedMap ? "selected map area" : chartSelectionDetails.summary);
    const selectionPrompt = selectedGrid
      ? "Ask about these selected cells…"
      : selectedMap
        ? "Ask about the places in this selected area…"
        : "Ask what changed in this selected range…";
    const isActiveAiContext = aiOpen && aiContext === "chart" && aiContextNote === context;
    return (
      <aside className={`result-context${isActiveAiContext ? " active-ai-context" : ""}`} aria-label="Selection actions">
        <header><div><h2>{selectionTitle}</h2><p>{selectionSummary}</p></div><button type="button" aria-label="Close selection actions" onClick={() => { setGridSelection(null); setChartSelection(null); setResultStatus(""); }}>×</button></header>
        <label className={`result-context-ai ai-promoter${isActiveAiContext ? " active" : ""}`}><span aria-hidden="true">✦</span><input name="chartize-selection-prompt" readOnly value="" placeholder={isActiveAiContext ? "This selection is attached to Chartize AI" : selectionPrompt} aria-label="Ask Chartize about this selection" onFocus={(event) => promoteAi(context, "left", "chart", event.currentTarget)} /><b>{isActiveAiContext ? "active" : "ask"}</b></label>
        {resultStatus && <p className="result-context-status">{resultStatus}</p>}
        <div className="result-context-actions">
          {selectedChart?.x && selectedChart?.y && <button type="button" onClick={zoomToChartSelection}>zoom to selection</button>}
          {chartDomainHistory.length > 0 && <button type="button" onClick={zoomChartOut}>zoom out</button>}
          {selectedGrid && origin === "dock" && <button type="button" onClick={() => selectedGrid.columns.forEach((column) => addColumnFromTable(column))}>add fields to sql</button>}
          {selectedGrid && <button type="button" onClick={() => void navigator.clipboard.writeText([selectedGrid.columns, ...selectedGrid.rows].map((row) => row.join("\t")).join("\n"))}>copy cells</button>}
          <button type="button" onClick={() => { setGridSelection(null); setChartSelection(null); }}>clear selection</button>
        </div>
      </aside>
    );
  };

  return (
    <main className="workbench" ref={workbenchRef}>
      <div
        className="workbench-grid dwim-layout"
        ref={workbenchGridRef}
        style={{ "--left-pane-size": `${leftPaneRatio * 100}%` } as CSSProperties}
      >
        <aside className="editor-workspace" aria-label="GGSQL editor">
          <div
            className="editor-stack"
            ref={editorStackRef}
            style={{ "--code-pane-size": `${codePaneRatio * 100}%` } as CSSProperties}
          >
            <div className="code-pane">
              <header className="code-toolbar">
                <div><strong>visualization code <span>(ggsql)</span></strong></div>
                {error && (
                  <details className="code-error" data-dismiss-on-outside>
                    <summary title="Show query error" aria-label="Show query error"><span aria-hidden="true">!</span></summary>
                    <div role="alert"><strong>query error</strong><p>{error}</p></div>
                  </details>
                )}
                <button className="run-button" type="button" disabled={running || engineState !== "ready" || isBlankWorkspace} onClick={() => void runEditorQuery()}><span aria-hidden="true">▶</span>{running ? "running" : "run"}</button>
              </header>
              <div className="editor-body">
                <Editor
                  height="100%"
                  defaultLanguage="sql"
                  theme="vs"
                  value={query}
                  onMount={handleEditorMount}
                  options={{ automaticLayout: true, minimap: { enabled: false }, fontSize: editorFontSize, lineHeight: Math.round(editorFontSize * 1.6), mouseWheelZoom: false, lineNumbersMinChars: 3, padding: { top: 15, bottom: 15 }, wordWrap: "on", scrollBeyondLastLine: false, folding: false, renderLineHighlight: "line", selectionHighlight: true }}
                  onChange={(value) => {
                    const nextQuery = value ?? "";
                    setQuery(nextQuery);
                    setDwimStatus("");
                    if (!nextQuery.trim()) {
                      runSequenceRef.current += 1;
                      fullSequenceRef.current += 1;
                      setDraft(makeBlankDraft());
                      setSpec(null);
                      setSelectedData({ ...EMPTY_TABLE, limit: 200 });
                      setFullData(EMPTY_TABLE);
                      setDockSource("");
                      setFullSort(null);
                      setRunning(false);
                      setFullLoading(false);
                      setShowLoadingMask(false);
                      setError("");
                      setDuration(0);
                      setGridSelection(null);
                      setChartSelection(null);
                      resetChartZoom();
                    }
                  }}
                />
                {inlineAnchors && <InlineQueryControls anchors={inlineAnchors as InlineControlAnchors} sources={sources} activeSources={activeSources} selectedFields={selectedFieldNames} catalogLoading={!catalogLoaded} onSource={toggleSource} onColumn={toggleColumn} />}
                {editorContext && (
                  <DwimPanel
                    section={editorContext.section}
                    selectedText={editorContext.selectedText}
                    position={{ left: editorContext.left, top: editorContext.top }}
                    sources={sources}
                    activeSources={activeSources}
                    visualFields={visualFields}
                    selectedFields={selectedFieldNames}
                    visual={visualState}
                    status={dwimStatus}
                    catalogLoading={!catalogLoaded}
                    onSource={toggleSource}
                    onColumn={toggleColumn}
                    onRemoveColumn={removeColumn}
                    onVisual={updateVisual}
                    onFiles={(files) => void addFiles(files)}
                    onRunSelection={() => void runEditorQuery()}
                    onPromoteAi={(origin) => promoteAi(`${aiViewNote} ${editorContext.section === "selection" ? `Selected GGSQL: ${editorContext.selectedText}` : `${editorContext.section === "sql" ? "SQL" : "VISUALISE"} at character ${editorContext.offset}`}`, "right", "code", origin)}
                    onClose={() => setEditorContext(null)}
                  />
                )}
              </div>
            </div>

            <PanelResizer
              orientation="horizontal"
              value={codePaneRatio}
              defaultValue={0.56}
              containerRef={editorStackRef}
              onChange={setCodePaneRatio}
              label="Resize visualization code and total data panels"
            />

            <section className="source-dock" aria-label="Source tables" onPointerDown={() => setFocusArea("table")}>
              <header className="code-toolbar source-dock-toolbar">
                <div><strong>total data</strong></div>
              </header>
              <header className="source-dock-tabs">
                <nav aria-label="Selected source tables">
                  {activeSources.map((source) => <button key={source} type="button" className={dockSource === source ? "active" : ""} onClick={() => { setDockSource(source); setFullData(EMPTY_TABLE); }}>{baseSources.find((candidate) => candidate.id === source)?.title ?? source}</button>)}
                </nav>
                <details className="source-dock-add" data-dismiss-on-outside>
                  <summary title="Add a source table" aria-label="Add a source table">+</summary>
                  <div><header><b>sources</b></header><SourceTiles sources={sources} activeSources={activeSources} onSource={toggleSource} loading={!catalogLoaded} /></div>
                </details>
              </header>
              <div className="source-dock-body">
                <DataGrid data={fullData} loading={fullLoading} selectedColumns={dockSelectedSet} sort={fullSort} streamKey={`${dockSource}:${fullSort?.column ?? ""}:${fullSort?.direction ?? ""}`} onSort={sortFullTable} onAddColumn={addColumnFromTable} onLoadMore={loadMoreFullTable} onSelection={(selection) => { setFocusArea("table"); setSelectionOrigin("dock"); setGridSelection(selection); }} />
                {selectionActions("dock")}
              </div>
            </section>
          </div>
        </aside>

        <PanelResizer
          orientation="vertical"
          value={leftPaneRatio}
          defaultValue={0.44}
          containerRef={workbenchGridRef}
          onChange={setLeftPaneRatio}
          label="Resize workspace and visualization panels"
        />

        <section className="preview-stage" aria-label="Chart and data results">
          <article className="chart-card result-card">
            <header className="result-toolbar">
              <nav className="result-tabs" aria-label="Result views">
                <button type="button" className={resultTab === "chart" ? "active" : ""} onClick={() => setResultTab("chart")}>chart</button>
                <button type="button" className={resultTab === "selected" ? "active" : ""} onClick={() => setResultTab("selected")}>selected data <span>{selectedData.totalRows.toLocaleString()}</span></button>
              </nav>
              <div className="chart-header-tools">
                <div className="preview-actions" aria-label="Result actions">
                  <span className={`chart-status ${running ? "running" : ""}`}>{running ? "running" : `${duration} ms`}</span>
                  <button className="icon-button save-action" type="button" title="Save in this browser" aria-label="Save in this browser" onClick={() => void saveLocal()}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3h12l2 2v16H5zM8 3v6h8V3M8 14h8v7H8z" /></svg></button>
                  <details className="preview-menu" data-dismiss-on-outside>
                    <summary className="icon-button download-action" title="Download" aria-label="Download"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m-5-5 5 5 5-5M5 20h14" /></svg></summary>
                    <div><span>download</span><button onClick={() => void exportChart("png")}>chart as png</button><button onClick={() => void exportChart("svg")}>chart as svg</button><button onClick={() => void exportShareCard()}>share card</button></div>
                  </details>
                  <details className="preview-menu" data-dismiss-on-outside>
                    <summary className="icon-button tools-action" title="Tools" aria-label="Tools"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" /></svg></summary>
                    <div><span>view tools</span><button onClick={() => void restoreLocal()}>restore browser workspace</button><button onClick={() => void shareView()}>copy share url</button><button onClick={resetChartZoom}>fit full chart</button></div>
                  </details>
                </div>
              </div>
            </header>

            <div className="result-stage" aria-busy={running}>
              {resultTab === "chart" && (
                <div className={`chart-result-view${isBlankWorkspace ? " blank" : ""}`} onPointerDown={() => setFocusArea("chart")}>
                  {isBlankWorkspace ? (
                    <div className="blank-chart-grid" role="img" aria-label="Blank visualization canvas" />
                  ) : (
                    <>
                      <header className="chart-header">
                        <div className="chart-title">
                          <EditableChartLabel kind="title" value={visualState.title || draft.title} onCommit={(value) => editChartLabel("title", value)} />
                          <EditableChartLabel kind="subtitle" value={visualState.subtitle || draft.subtitle} onCommit={(value) => editChartLabel("subtitle", value)} />
                        </div>
                      </header>
                      <div className="chart-view-shell">
                        <div className="chart-view"><ChartView ref={chartRef} spec={spec} featureData={selectedData} exportTitle={visualState.title || draft.title} exportSubtitle={visualState.subtitle || draft.subtitle} onError={setError} threshold={activeSource.includes("presidential_approval_average") ? APPROVAL_THRESHOLD : undefined} domains={chartDomains} legendTitles={chartLegendTitles} selection={chartSelection} mapMode={isMap} mapViewport={mapViewport} mapFeatureSelection={mapFeatureSelection} mapFeatureAiActive={Boolean(aiOpen && aiContext === "chart" && aiContextNote === mapFeatureContext)} onMapPan={panMap} onMapZoom={zoomMap} onChartZoom={gestureZoomChart} onChartPan={gesturePanChart} onRegionSelect={(selection) => { setSelectionOrigin("result"); setMapFeatureSelection(null); setChartSelection(selection); }} onMapFeatureSelect={selectMapFeature} onAskMapFeature={(origin) => { if (mapFeatureContext) promoteAi(mapFeatureContext, "left", "chart", origin); }} /></div>
                        {isMap
                          ? <MapExplorationControls viewport={mapViewport} onPan={panMap} onZoom={zoomMap} onReset={resetMapViewport} />
                          : <GraphExplorationControls
                              canZoomSelection={Boolean(chartSelection?.x && chartSelection.y)}
                              canGoBack={chartDomainHistory.length > 0}
                              canFit={chartDomainHistory.length > 0 || Object.keys(chartDomains).length > 0}
                              onZoomIn={() => zoomChartCentered(0.72)}
                              onZoomOut={() => zoomChartCentered(1.4)}
                              onZoomSelection={zoomToChartSelection}
                              onGoBack={zoomChartOut}
                              onFit={resetChartZoom}
                            />}
                      </div>
                    </>
                  )}
                </div>
              )}
              {resultTab === "selected" && <div className="result-table-focus" onPointerDown={() => setFocusArea("table")}><DataGrid data={selectedData} selectedColumns={selectedSetForGrid} onSelection={(selection) => { setFocusArea("table"); setSelectionOrigin("result"); setGridSelection(selection); }} /></div>}
              {selectionActions("result")}
              {showLoadingMask && <div className="pane-loading-mask" role="status"><div className="spinner" /><span>running query…</span></div>}
            </div>

            {aiMessage && !aiOpen && <button className="status-toast" type="button" onClick={() => setAiMessage("")}>{aiMessage}</button>}
            <footer className="chart-footer"><span>{activeSources.join(" + ")}</span><span><i className={`status-dot ${engineState}`} /> {mode === "local" ? "private browser" : "vps warehouse"}</span></footer>
          </article>
        </section>
      </div>

      {aiOpen && (
        <AiAssistant
          context={aiContext}
          placement={aiPlacement}
          contextNote={aiContextNote}
          prompt={aiPrompt}
          busy={aiBusy}
          ready={catalogLoaded}
          status={aiMessage}
          history={aiHistory}
          usage={aiUsage}
          focusVersion={aiFocusVersion}
          includeSamples={includeSamples}
          preferences={aiPreferences}
          leftPaneRatio={leftPaneRatio}
          onClose={closeAssistant}
          onPrompt={setAiPrompt}
          onIncludeSamples={setIncludeSamples}
          onPreferences={setAiPreferences}
          onAsk={(task, request) => void askAi(task, request)}
          onRetry={(assistantMessageIndex) => void askAi("generate", undefined, assistantMessageIndex)}
        />
      )}
    </main>
  );
}

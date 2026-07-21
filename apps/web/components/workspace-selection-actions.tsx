"use client";

import { useShallow } from "zustand/react/shallow";
import { useChartizeWorkspace } from "@/lib/workspace/store";
import type { WorkspaceViewModel } from "@/lib/workspace/view-model";
import type { PromoteAi } from "./workspace-code-pane";

interface WorkspaceSelectionActionsProps {
  origin: "dock" | "result";
  view: WorkspaceViewModel;
  promoteAi: PromoteAi;
  onZoomSelection?: () => void;
}

function tabularText(columns: string[], rows: unknown[][]) {
  return [columns, ...rows].map((row) => row.map((value) => String(value ?? "")).join("\t")).join("\n");
}

function csvText(columns: string[], rows: unknown[][]) {
  const cell = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  return [columns, ...rows].map((row) => row.map(cell).join(",")).join("\n");
}

function downloadSelection(columns: string[], rows: unknown[][]) {
  const url = URL.createObjectURL(new Blob([csvText(columns, rows)], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `chartize-selection-${Date.now()}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function WorkspaceSelectionActions({ origin, view, promoteAi, onZoomSelection }: WorkspaceSelectionActionsProps) {
  const state = useChartizeWorkspace(useShallow((workspace) => ({
    selectionOrigin: workspace.selectionOrigin,
    gridSelection: workspace.gridSelection,
    chartSelection: workspace.chartSelection,
    chartDomainHistory: workspace.chartDomainHistory,
    resultStatus: workspace.resultStatus,
    aiOpen: workspace.aiOpen,
    aiContext: workspace.aiContext,
    aiContextNote: workspace.aiContextNote,
    setGridSelection: workspace.setGridSelection,
    setChartSelection: workspace.setChartSelection,
    setMapFeatureSelections: workspace.setMapFeatureSelections,
    setResultStatus: workspace.setResultStatus,
    zoomChartOut: workspace.zoomChartOut,
    addColumnFromTable: workspace.addColumnFromTable,
  })));
  const selectedGrid = state.selectionOrigin === origin ? state.gridSelection : null;
  const selectedChart = origin === "result" ? state.chartSelection : null;
  if (!selectedGrid && !selectedChart) return null;

  const selectedMap = Boolean(selectedChart && view.isMap);
  const visualItemCount = view.mapSelectedData?.totalRows ?? 0;
  const chartRange = view.chartSelectionDetails.summary.split(" · ").slice(1).join(" · ");
  const chartSelectionSummary = visualItemCount
    ? `${visualItemCount.toLocaleString()} visual item${visualItemCount === 1 ? "" : "s"} selected${chartRange ? ` · ${chartRange}` : ""}`
    : view.chartSelectionDetails.summary;
  const context = selectedGrid
    ? `${view.aiViewNote} Data selection: ${selectedGrid.summary}. Columns: ${selectedGrid.columns.join(", ")}. Row values are attached only when the user enables the sample-row control.`
    : selectedMap
      ? `${view.aiViewNote} Map selection: a rectangular map area containing ${visualItemCount} selected map feature${visualItemCount === 1 ? "" : "s"}. Use the map subject, legend, current query, and attached feature rows to interpret the places inside it.`
      : `${view.aiViewNote} Chart selection: ${chartSelectionSummary}.${visualItemCount ? " The intersecting rendered rows are attached." : ""} X range: ${JSON.stringify(selectedChart?.x)}. Y range: ${JSON.stringify(selectedChart?.y)}.`;
  const selectionTitle = selectedGrid ? "data selection" : selectedMap ? "map selection" : "chart selection";
  const selectionSummary = selectedGrid?.summary ?? (selectedMap ? `${visualItemCount} map feature${visualItemCount === 1 ? "" : "s"} selected` : chartSelectionSummary);
  const selectionPrompt = selectedGrid
    ? "Ask about these selected cells…"
    : selectedMap
      ? "Ask about the places in this selected area…"
      : "Ask what changed in this selected range…";
  const activeAiContext = state.aiOpen && state.aiContext === "chart" && state.aiContextNote === context;
  const selectedTable = selectedGrid
    ? { columns: selectedGrid.columns, rows: selectedGrid.rows }
    : view.mapSelectedData?.rows.length
      ? { columns: view.mapSelectedData.columns, rows: view.mapSelectedData.rows }
      : view.chartSelectionDetails.rows.length
        ? { columns: view.chartSelectionData.columns, rows: view.chartSelectionDetails.rows }
        : null;
  const clear = () => {
    state.setGridSelection(null);
    state.setChartSelection(null);
    state.setMapFeatureSelections([]);
    state.setResultStatus("");
  };

  return (
    <aside className={`result-context${activeAiContext ? " active-ai-context" : ""}`} aria-label="Selection actions">
      <header><div><span>selected region</span><h2>{selectionTitle}</h2><p>{selectionSummary}</p></div><button type="button" aria-label="Close selection actions" onClick={clear}>×</button></header>
      <label className={`result-context-ai ai-promoter${activeAiContext ? " active" : ""}`}><span aria-hidden="true">✦</span><input name="chartize-selection-prompt" readOnly value="" placeholder={activeAiContext ? "This selection is attached to Chartize AI" : selectionPrompt} aria-label="Ask Chartize about this selection" onFocus={(event) => promoteAi(context, "left", "chart", event.currentTarget)} /><b>{activeAiContext ? "active" : "ask"}</b></label>
      {state.resultStatus && <p className="result-context-status">{state.resultStatus}</p>}
      <div className="result-context-actions">
        {selectedChart?.x && selectedChart.y && onZoomSelection && <button type="button" onClick={onZoomSelection}>zoom to selection</button>}
        {state.chartDomainHistory.length > 0 && <button type="button" onClick={state.zoomChartOut}>zoom out</button>}
        {selectedGrid && origin === "dock" && <button type="button" onClick={() => selectedGrid.columns.forEach(state.addColumnFromTable)}>add fields to sql</button>}
        {selectedTable && <button type="button" onClick={() => void navigator.clipboard.writeText(tabularText(selectedTable.columns, selectedTable.rows))}>copy selected data</button>}
        {selectedTable && <button type="button" onClick={() => downloadSelection(selectedTable.columns, selectedTable.rows)}>download selection</button>}
        <button type="button" onClick={clear}>clear selection</button>
      </div>
    </aside>
  );
}

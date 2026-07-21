"use client";

import { useRef } from "react";
import { useShallow } from "zustand/react/shallow";
import {
  centeredDomain,
  normalizeDomainValue,
  shiftedDomain,
} from "@/lib/workspace/chart-data";
import { useChartizeWorkspace } from "@/lib/workspace/store";
import { useWorkspaceViewModel } from "@/lib/workspace/view-model";
import { ChartView, type ChartViewHandle } from "./chart-view";
import { GraphExplorationControls, MapExplorationControls } from "./chart-exploration-controls";
import { DataGrid } from "./data-grid";
import { EditableChartLabel } from "./editable-chart-label";
import type { PromoteAi } from "./workspace-code-pane";
import { WorkspaceSelectionActions } from "./workspace-selection-actions";

const APPROVAL_THRESHOLD = { fieldTitles: ["approve", "Approval"], value: 50, below: "#ee4266", above: "#147d76" } as const;

function downloadDataUrl(url: string, fileName: string) {
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
}

export function WorkspaceResultPane({ promoteAi }: { promoteAi: PromoteAi }) {
  const view = useWorkspaceViewModel();
  const state = useChartizeWorkspace(useShallow((workspace) => ({
    engineState: workspace.engineState,
    draft: workspace.draft,
    spec: workspace.spec,
    selectedData: workspace.selectedData,
    resultRelation: workspace.resultRelation,
    resultTab: workspace.resultTab,
    running: workspace.running,
    showLoadingMask: workspace.showLoadingMask,
    duration: workspace.duration,
    chartSelection: workspace.chartSelection,
    chartDomains: workspace.chartDomains,
    chartDomainHistory: workspace.chartDomainHistory,
    mapViewport: workspace.mapViewport,
    mapFeatureSelections: workspace.mapFeatureSelections,
    aiOpen: workspace.aiOpen,
    aiMessage: workspace.aiMessage,
    setResultTab: workspace.setResultTab,
    setFocusArea: workspace.setFocusArea,
    setError: workspace.setError,
    setSelectionOrigin: workspace.setSelectionOrigin,
    setGridSelection: workspace.setGridSelection,
    setChartDomains: workspace.setChartDomains,
    setResultStatus: workspace.setResultStatus,
    setAiMessage: workspace.setAiMessage,
    editChartLabel: workspace.editChartLabel,
    zoomChart: workspace.zoomChart,
    zoomChartOut: workspace.zoomChartOut,
    resetChartZoom: workspace.resetChartZoom,
    zoomMap: workspace.zoomMap,
    panMap: workspace.panMap,
    resetMapViewport: workspace.resetMapViewport,
    selectChartRegion: workspace.selectChartRegion,
    selectMapFeature: workspace.selectMapFeature,
    setMapFeatureSelections: workspace.setMapFeatureSelections,
    shareWorkspace: workspace.shareWorkspace,
  })));
  const chartRef = useRef<ChartViewHandle>(null);
  const resultData = view.mapSelectedData ?? state.selectedData;

  const zoomToSelection = () => {
    if (!state.chartSelection?.x || !state.chartSelection.y) return;
    state.zoomChart({
      x: state.chartSelection.x.map(normalizeDomainValue) as [unknown, unknown],
      y: state.chartSelection.y.map(normalizeDomainValue) as [unknown, unknown],
    });
  };
  const zoomCentered = (factor: number) => {
    const visible = chartRef.current?.getDomains();
    const x = centeredDomain(visible?.x, factor);
    const y = centeredDomain(visible?.y, factor);
    if (!x && !y) {
      state.setResultStatus("Centered zoom is available on numeric and time scales.");
      return;
    }
    state.zoomChart({ ...(x ? { x } : {}), ...(y ? { y } : {}) });
  };
  const gestureZoom = (factor: number) => {
    const visible = chartRef.current?.getDomains();
    const x = centeredDomain(visible?.x, factor);
    const y = centeredDomain(visible?.y, factor);
    if (x || y) state.setChartDomains({ ...(x ? { x } : {}), ...(y ? { y } : {}) });
  };
  const gesturePan = (horizontal: number, vertical: number) => {
    const visible = chartRef.current?.getDomains();
    const x = shiftedDomain(visible?.x, horizontal);
    const y = shiftedDomain(visible?.y, vertical);
    if (x || y) state.setChartDomains({ ...(x ? { x } : {}), ...(y ? { y } : {}) });
  };
  const exportChart = async (format: "png" | "svg") => {
    try {
      const url = format === "png" ? await chartRef.current?.toPng() : await chartRef.current?.toSvg();
      if (url) downloadDataUrl(url, `chartize-${Date.now()}.${format}`);
    } catch (cause) {
      state.setError(cause instanceof Error ? cause.message : String(cause));
    }
  };
  const exportShareCard = async () => {
    try {
      const chartUrl = await chartRef.current?.toPng(false);
      if (!chartUrl) throw new Error("Run a chart before exporting a share card.");
      const currentDraft = useChartizeWorkspace.getState().draft;
      const canvas = document.createElement("canvas");
      canvas.width = 1200;
      canvas.height = 630;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas export is unavailable.");
      context.fillStyle = "#f4f7f6";
      context.fillRect(0, 0, 1200, 630);
      context.fillStyle = "#3cbbb1";
      context.fillRect(0, 0, 18, 630);
      context.fillStyle = "#0a0f0d";
      context.font = "300 48px system-ui";
      context.fillText(currentDraft.title.slice(0, 42), 55, 90);
      context.fillStyle = "#596662";
      context.font = "22px system-ui";
      context.fillText(currentDraft.subtitle.slice(0, 72), 55, 135);
      const image = new Image();
      image.onload = () => {
        context.fillStyle = "#fff";
        context.fillRect(55, 170, 1090, 385);
        context.drawImage(image, 75, 185, 1050, 355);
        context.fillStyle = "#0a0f0d";
        context.font = "650 18px system-ui";
        context.fillText("chartize", 55, 595);
        downloadDataUrl(canvas.toDataURL("image/png"), `chartize-card-${Date.now()}.png`);
      };
      image.src = chartUrl;
    } catch (cause) {
      state.setError(cause instanceof Error ? cause.message : String(cause));
    }
  };

  return (
    <section className="preview-stage" aria-label="Chart and data results">
      <article className="chart-card result-card">
        <header className="result-toolbar">
          <nav className="result-tabs" aria-label="Result views">
            <button type="button" className={state.resultTab === "chart" ? "active" : ""} onClick={() => state.setResultTab("chart")}>chart</button>
            <button type="button" className={state.resultTab === "selected" ? "active" : ""} onClick={() => state.setResultTab("selected")}>selected data <span>{resultData.totalRows.toLocaleString()}</span></button>
          </nav>
          <div className="chart-header-tools">
            <div className="preview-actions" aria-label="Result actions">
              <span className={`chart-status ${state.running ? "running" : ""}`}>{state.running ? "running" : `${state.duration} ms`}</span>
              <details className="preview-menu" data-dismiss-on-outside>
                <summary className="icon-button download-action" title="Download" aria-label="Download"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m-5-5 5 5 5-5M5 20h14" /></svg></summary>
                <div><span>download</span><button onClick={() => void exportChart("png")}>chart as png</button><button onClick={() => void exportChart("svg")}>chart as svg</button><button onClick={() => void exportShareCard()}>share card</button></div>
              </details>
              <details className="preview-menu" data-dismiss-on-outside>
                <summary className="icon-button tools-action" title="Tools" aria-label="Tools"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" /></svg></summary>
                <div><span>view tools</span><button onClick={() => void state.shareWorkspace()}>copy share url</button><button onClick={view.isMap ? state.resetMapViewport : state.resetChartZoom}>fit full view</button></div>
              </details>
            </div>
          </div>
        </header>

        <div className="result-stage" aria-busy={state.running}>
          {state.resultTab === "chart" && (
            <div className={`chart-result-view${view.isBlankWorkspace ? " blank" : ""}`} onPointerDown={() => state.setFocusArea("chart")}>
              {view.isBlankWorkspace ? (
                <div className="blank-chart-grid" role="img" aria-label="Blank visualization canvas" />
              ) : (
                <>
                  <header className="chart-header"><div className="chart-title">
                    <EditableChartLabel kind="title" value={view.visualState.title || state.draft.title} onCommit={(value) => state.editChartLabel("title", value)} />
                    <EditableChartLabel kind="subtitle" value={view.visualState.subtitle || state.draft.subtitle} onCommit={(value) => state.editChartLabel("subtitle", value)} />
                  </div></header>
                  <div className="chart-view-shell">
                    <div className="chart-view"><ChartView
                      ref={chartRef}
                      spec={state.spec}
                      featureData={state.resultRelation}
                      exportTitle={view.visualState.title || state.draft.title}
                      exportSubtitle={view.visualState.subtitle || state.draft.subtitle}
                      onError={state.setError}
                      threshold={view.activeSource.includes("presidential_approval_average") ? APPROVAL_THRESHOLD : undefined}
                      domains={state.chartDomains}
                      legendTitles={view.chartLegendTitles}
                      selection={state.chartSelection}
                      mapMode={view.isMap}
                      mapViewport={state.mapViewport}
                      mapFeatureSelections={state.mapFeatureSelections}
                      onMapPan={state.panMap}
                      onMapZoom={state.zoomMap}
                      onChartZoom={gestureZoom}
                      onChartPan={gesturePan}
                      onResetView={view.isMap ? state.resetMapViewport : state.resetChartZoom}
                      onRegionSelect={state.selectChartRegion}
                      onMapFeatureSelect={state.selectMapFeature}
                      onVisualItemsSelect={state.setMapFeatureSelections}
                    /></div>
                    {view.isMap
                      ? <MapExplorationControls viewport={state.mapViewport} onPan={state.panMap} onZoom={state.zoomMap} onReset={state.resetMapViewport} />
                      : <GraphExplorationControls
                          canZoomSelection={Boolean(state.chartSelection?.x && state.chartSelection.y)}
                          canGoBack={state.chartDomainHistory.length > 0}
                          canFit={state.chartDomainHistory.length > 0 || Object.keys(state.chartDomains).length > 0}
                          onZoomIn={() => zoomCentered(0.72)}
                          onZoomOut={() => zoomCentered(1.4)}
                          onZoomSelection={zoomToSelection}
                          onGoBack={state.zoomChartOut}
                          onFit={state.resetChartZoom}
                        />}
                  </div>
                </>
              )}
            </div>
          )}
          {state.resultTab === "selected" && <div className="result-table-focus" onPointerDown={() => state.setFocusArea("table")}><DataGrid data={resultData} selectedColumns={view.selectedFieldNames} onSelection={(selection) => { state.setFocusArea("table"); state.setSelectionOrigin("result"); state.setGridSelection(selection); }} /></div>}
          <WorkspaceSelectionActions origin="result" view={view} promoteAi={promoteAi} onZoomSelection={zoomToSelection} />
          {state.showLoadingMask && <div className="pane-loading-mask" role="status"><div className="spinner" /><span>running query…</span></div>}
        </div>

        <label className="compact-chart-ai-entry">
          <span aria-hidden="true">✦</span>
          <input
            readOnly
            id="chartize-compact-ai-entry"
            name="chartize-compact-ai-entry"
            aria-label="Ask Chartize about this visualization"
            placeholder={view.isBlankWorkspace ? "Describe the graph, map, or model you want…" : "Ask what this means, or tell Chartize what to change…"}
            onFocus={(event) => promoteAi(
              `${view.aiViewNote} ${view.isBlankWorkspace ? "The visualization canvas is blank; help build from the available sources." : "The current chart, query, source catalog, and any active selection are attached."}`,
              "left",
              view.isBlankWorkspace ? "general" : "chart",
              event.currentTarget,
            )}
          />
          <b>ask</b>
        </label>

        {state.aiMessage && !state.aiOpen && <button className="status-toast" type="button" onClick={() => state.setAiMessage("")}>{state.aiMessage}</button>}
        <footer className="chart-footer"><span>{view.activeSources.join(" + ")}</span><span><i className={`status-dot ${state.engineState}`} /> {state.engineState === "loading" ? "preparing data" : state.engineState === "error" ? "data unavailable" : "data ready"}</span></footer>
      </article>
    </section>
  );
}

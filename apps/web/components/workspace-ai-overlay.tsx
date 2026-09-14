"use client";

import type { AiApprovalRequest } from "@chartize/contracts";
import { useShallow } from "zustand/react/shallow";
import { useChartizeWorkspace } from "@/lib/workspace/store";
import { aiQueryStatus, resolveAiWorkspaceContext } from "@/lib/workspace/ai-context";
import { useWorkspaceViewModel } from "@/lib/workspace/view-model";
import { AiAssistant } from "./ai-assistant";

export function WorkspaceAiOverlay() {
  const view = useWorkspaceViewModel();
  const state = useChartizeWorkspace(useShallow((workspace) => ({
    catalogLoaded: workspace.catalogLoaded,
    query: workspace.query,
    resultQuery: workspace.resultQuery,
    runtimeErrors: workspace.runtimeErrors,
    selectedData: workspace.selectedData,
    fullData: workspace.fullData,
    dockSource: workspace.dockSource,
    gridSelection: workspace.gridSelection,
    selectionOrigin: workspace.selectionOrigin,
    chartSelection: workspace.chartSelection,
    mapFeatureSelections: workspace.mapFeatureSelections,
    aiOpen: workspace.aiOpen,
    aiPlacement: workspace.aiPlacement,
    aiContext: workspace.aiContext,
    aiContextNote: workspace.aiContextNote,
    aiPrompt: workspace.aiPrompt,
    aiBusy: workspace.aiBusy,
    aiMessage: workspace.aiMessage,
    aiHistory: workspace.aiHistory,
    aiFocusVersion: workspace.aiFocusVersion,
    aiPreferences: workspace.aiPreferences,
    leftPaneRatio: workspace.leftPaneRatio,
    setAiContextNote: workspace.setAiContextNote,
    setAiPrompt: workspace.setAiPrompt,
    setAiPreferences: workspace.setAiPreferences,
    addLocalFiles: workspace.addLocalFiles,
    submitAiTurn: workspace.submitAiTurn,
    closeAi: workspace.closeAi,
  })));

  if (!state.aiOpen) return null;

  const resolvedContext = resolveAiWorkspaceContext({
    context: state.aiContext,
    entryNote: state.aiContextNote,
    viewNote: view.aiViewNote,
    blank: view.isBlankWorkspace,
    isMap: view.isMap,
    gridSelection: state.gridSelection,
    chartRange: state.chartSelection ? {
      x: state.chartSelection.x,
      y: state.chartSelection.y,
      summary: view.chartSelectionDetails.summary,
      data: { columns: view.chartSelectionData.columns, rows: view.chartSelectionDetails.rows },
    } : null,
    visualSelectionCount: state.mapFeatureSelections.length,
    visualSelectionData: view.mapSelectedData
      ? { columns: view.mapSelectedData.columns, rows: view.mapSelectedData.rows }
      : null,
    fallbackData: { columns: state.selectedData.columns, rows: state.selectedData.rows },
    dataPreview: { columns: state.fullData.columns, rows: state.fullData.rows },
  });

  const submit = (task: "generate" | "repair" | "explain", requestOverride?: string, retryAssistantIndex?: number, approval?: AiApprovalRequest) => {
    const status = aiQueryStatus(state.query, state.resultQuery, state.runtimeErrors);
    const contextSource = resolvedContext.context === "chart"
      ? view.renderedActiveSource
      : resolvedContext.context === "data"
        ? state.gridSelection && state.selectionOrigin === "result"
          ? view.renderedActiveSource
          : state.dockSource || view.activeSource
        : view.activeSource || view.renderedActiveSource;
    const contextSourceDetails = view.sources.find((source) => source.id === contextSource);
    const contextFields = resolvedContext.context === "chart"
      ? view.renderedFields
      : resolvedContext.context === "data"
        ? state.gridSelection && state.selectionOrigin === "result"
          ? view.renderedFields
          : contextSourceDetails?.fields ?? view.activeFields
        : view.activeFields;
    const sampleColumns = resolvedContext.sample.columns.slice(0, 100);
    return state.submitAiTurn({
      task,
      context: resolvedContext.context,
      contextNote: resolvedContext.note,
      queryStatus: status,
      ...(status !== "rendered" && state.resultQuery.trim() ? { renderedQuery: state.resultQuery } : {}),
      source: contextSource || undefined,
      schema: contextFields,
      availableSources: view.sources.map(({ id, title, description, fields }) => ({ id, title, description, fields })),
      view: view.aiView,
      sampleData: {
            columns: sampleColumns,
            rows: resolvedContext.sample.rows.slice(0, 20).map((row) => (
              row.slice(0, sampleColumns.length).map((value) => String(value).slice(0, 3000))
            )),
          },
      approvedFeatures: approval ? [approval] : [],
      requestOverride,
      retryAssistantIndex,
    });
  };

  return (
    <AiAssistant
      context={resolvedContext.context}
      placement={state.aiPlacement}
      contextNote={resolvedContext.note}
      hasSelection={resolvedContext.context === "chart" ? Boolean(state.chartSelection || state.mapFeatureSelections.length) : resolvedContext.context === "data" && Boolean(state.gridSelection)}
      prompt={state.aiPrompt}
      busy={state.aiBusy}
      ready={state.catalogLoaded}
      status={state.aiMessage}
      history={state.aiHistory}
      focusVersion={state.aiFocusVersion}
      preferences={state.aiPreferences}
      leftPaneRatio={state.leftPaneRatio}
      onClose={state.closeAi}
      onPrompt={state.setAiPrompt}
      onPreferences={state.setAiPreferences}
      onFiles={async (files) => {
        const imported = await state.addLocalFiles(files);
        if (!imported.length) return;
        const sources = imported.map((dataset) => `user:${dataset.tableName}`);
        state.setAiContextNote(`New browser-local source${sources.length === 1 ? "" : "s"}: ${sources.join(", ")}. The raw uploads remain unchanged; their schemas, preview, and current GGSQL are attached.`);
        const suggestion = `Profile ${sources.join(" and ")}, summarize likely data-quality issues, and propose a cleaning plan. Preview transformations without mutating the raw source until I explicitly approve them.`;
        state.setAiPrompt(state.aiPrompt.trim() ? `${state.aiPrompt.trim()}\n\n${suggestion}` : suggestion);
      }}
      onAsk={(task, request) => void submit(task, request)}
      onRetry={(assistantMessageIndex, approval) => void submit("generate", undefined, assistantMessageIndex, approval)}
    />
  );
}

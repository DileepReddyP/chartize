"use client";

import { useEffect } from "react";
import { useShallow } from "zustand/react/shallow";
import { useChartizeWorkspace } from "@/lib/workspace/store";
import { useWorkspaceViewModel } from "@/lib/workspace/view-model";
import { AiAssistant } from "./ai-assistant";

export function WorkspaceAiOverlay() {
  const view = useWorkspaceViewModel();
  const state = useChartizeWorkspace(useShallow((workspace) => ({
    catalogLoaded: workspace.catalogLoaded,
    selectedData: workspace.selectedData,
    gridSelection: workspace.gridSelection,
    aiOpen: workspace.aiOpen,
    aiPlacement: workspace.aiPlacement,
    aiContext: workspace.aiContext,
    aiContextNote: workspace.aiContextNote,
    aiPrompt: workspace.aiPrompt,
    aiBusy: workspace.aiBusy,
    aiMessage: workspace.aiMessage,
    aiHistory: workspace.aiHistory,
    aiFocusVersion: workspace.aiFocusVersion,
    includeSamples: workspace.includeSamples,
    aiPreferences: workspace.aiPreferences,
    leftPaneRatio: workspace.leftPaneRatio,
    setAiContextNote: workspace.setAiContextNote,
    setAiPrompt: workspace.setAiPrompt,
    setIncludeSamples: workspace.setIncludeSamples,
    setAiPreferences: workspace.setAiPreferences,
    addLocalFiles: workspace.addLocalFiles,
    submitAiTurn: workspace.submitAiTurn,
    closeAi: workspace.closeAi,
  })));

  useEffect(() => {
    if (!state.aiOpen || state.aiBusy || state.aiContext !== "general") return;
    if (state.aiContextNote.startsWith("New browser-local source")) return;
    state.setAiContextNote(`${view.aiViewNote} Current query and source catalog are attached.`);
  }, [state.aiBusy, state.aiContext, state.aiContextNote, state.aiOpen, state.setAiContextNote, view.aiViewNote]);

  if (!state.aiOpen) return null;

  const submit = (task: "generate" | "repair" | "explain", requestOverride?: string, retryAssistantIndex?: number) => {
    const contextualData = view.mapSelectedData
      ? { columns: view.mapSelectedData.columns, rows: view.mapSelectedData.rows }
      : state.gridSelection
        ? { columns: state.gridSelection.columns, rows: state.gridSelection.rows }
        : view.chartSelectionDetails.rows.length
          ? { columns: view.chartSelectionData.columns, rows: view.chartSelectionDetails.rows }
          : { columns: state.selectedData.columns, rows: state.selectedData.rows };
    return state.submitAiTurn({
      task,
      context: state.aiContext,
      contextNote: state.aiContextNote,
      source: view.activeSource || undefined,
      schema: view.activeFields,
      availableSources: view.sources.map(({ id, title, description, fields }) => ({ id, title, description, fields })),
      view: view.aiView,
      sampleData: state.includeSamples ? { columns: contextualData.columns, rows: contextualData.rows.slice(0, 20) } : undefined,
      requestOverride,
      retryAssistantIndex,
    });
  };

  return (
    <AiAssistant
      context={state.aiContext}
      placement={state.aiPlacement}
      contextNote={state.aiContextNote}
      prompt={state.aiPrompt}
      busy={state.aiBusy}
      ready={state.catalogLoaded}
      status={state.aiMessage}
      history={state.aiHistory}
      focusVersion={state.aiFocusVersion}
      includeSamples={state.includeSamples}
      preferences={state.aiPreferences}
      leftPaneRatio={state.leftPaneRatio}
      onClose={state.closeAi}
      onPrompt={state.setAiPrompt}
      onIncludeSamples={state.setIncludeSamples}
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
      onRetry={(assistantMessageIndex) => void submit("generate", undefined, assistantMessageIndex)}
    />
  );
}

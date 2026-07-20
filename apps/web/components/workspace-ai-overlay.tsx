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
    mapFeatureSelection: workspace.mapFeatureSelection,
    aiOpen: workspace.aiOpen,
    aiPlacement: workspace.aiPlacement,
    aiContext: workspace.aiContext,
    aiContextNote: workspace.aiContextNote,
    aiPrompt: workspace.aiPrompt,
    aiBusy: workspace.aiBusy,
    aiMessage: workspace.aiMessage,
    aiHistory: workspace.aiHistory,
    aiUsage: workspace.aiUsage,
    aiFocusVersion: workspace.aiFocusVersion,
    includeSamples: workspace.includeSamples,
    aiPreferences: workspace.aiPreferences,
    leftPaneRatio: workspace.leftPaneRatio,
    setAiContextNote: workspace.setAiContextNote,
    setAiPrompt: workspace.setAiPrompt,
    setIncludeSamples: workspace.setIncludeSamples,
    setAiPreferences: workspace.setAiPreferences,
    submitAiTurn: workspace.submitAiTurn,
    closeAi: workspace.closeAi,
  })));

  useEffect(() => {
    if (!state.aiOpen || state.aiBusy || state.aiContext !== "general") return;
    state.setAiContextNote(`${view.aiViewNote} Current query and source catalog are attached.`);
  }, [state.aiBusy, state.aiContext, state.aiOpen, state.setAiContextNote, view.aiViewNote]);

  if (!state.aiOpen) return null;

  const submit = (task: "generate" | "repair" | "explain", requestOverride?: string, retryAssistantIndex?: number) => {
    const contextualData = state.mapFeatureSelection
      ? { columns: state.mapFeatureSelection.values.map(({ field }) => field), rows: [state.mapFeatureSelection.values.map(({ value }) => value)] }
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
      usage={state.aiUsage}
      focusVersion={state.aiFocusVersion}
      includeSamples={state.includeSamples}
      preferences={state.aiPreferences}
      leftPaneRatio={state.leftPaneRatio}
      onClose={state.closeAi}
      onPrompt={state.setAiPrompt}
      onIncludeSamples={state.setIncludeSamples}
      onPreferences={state.setAiPreferences}
      onAsk={(task, request) => void submit(task, request)}
      onRetry={(assistantMessageIndex) => void submit("generate", undefined, assistantMessageIndex)}
    />
  );
}

"use client";

import { useCallback, useEffect, useRef, type CSSProperties } from "react";
import { flushSync } from "react-dom";
import { useShallow } from "zustand/react/shallow";
import { useChartizeWorkspace, type AiContext } from "@/lib/workspace/store";
import { useWorkspaceViewModel } from "@/lib/workspace/view-model";
import { PanelResizer } from "./panel-resizer";
import { useWorkspaceLifecycle } from "./use-workspace-lifecycle";
import { WorkspaceAiOverlay } from "./workspace-ai-overlay";
import { WorkspaceCodePane, type PromoteAi } from "./workspace-code-pane";
import { WorkspaceDataPane } from "./workspace-data-pane";
import { WorkspaceResultPane } from "./workspace-result-pane";

export function Explorer() {
  const view = useWorkspaceViewModel();
  const state = useChartizeWorkspace(useShallow((workspace) => ({
    leftPaneRatio: workspace.leftPaneRatio,
    codePaneRatio: workspace.codePaneRatio,
    setLeftPaneRatio: workspace.setLeftPaneRatio,
    setCodePaneRatio: workspace.setCodePaneRatio,
    setFocusArea: workspace.setFocusArea,
    openAi: workspace.openAi,
  })));
  const workbenchRef = useRef<HTMLElement>(null);
  const workbenchGridRef = useRef<HTMLDivElement>(null);
  const editorStackRef = useRef<HTMLDivElement>(null);

  const promoteAi: PromoteAi = useCallback((
    contextNote: string,
    placement: "left" | "right" = "left",
    context: AiContext = "general",
    origin?: HTMLElement,
  ) => {
    if (origin) origin.style.viewTransitionName = "chartize-ai-entry";
    const commit = () => {
      origin?.style.removeProperty("view-transition-name");
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      state.openAi({ contextNote, placement, context });
    };
    const startTransition = (document as Document & {
      startViewTransition?: (update: () => void) => {
        ready?: Promise<unknown>;
        updateCallbackDone?: Promise<unknown>;
        finished?: Promise<unknown>;
      };
    }).startViewTransition;
    if (!startTransition) {
      commit();
      return;
    }
    try {
      const transition = startTransition.call(document, () => flushSync(commit));
      void transition.ready?.catch(() => undefined);
      void transition.updateCallbackDone?.catch(() => undefined);
      void transition.finished?.catch(() => undefined);
    } catch {
      commit();
    }
  }, [state.openAi]);

  useWorkspaceLifecycle(view.aiViewNote, promoteAi);

  useEffect(() => {
    const root = workbenchRef.current;
    if (!root) return;
    const lockPanePinch = (event: WheelEvent) => {
      if (!event.ctrlKey || !(event.target instanceof Element) || !root.contains(event.target)) return;
      event.preventDefault();
      if (event.target.closest(".chart-interaction, .chart-result-view")) state.setFocusArea("chart");
      else if (event.target.closest(".result-table-shell, .source-dock")) state.setFocusArea("table");
    };
    root.addEventListener("wheel", lockPanePinch, { capture: true, passive: false });
    return () => root.removeEventListener("wheel", lockPanePinch, true);
  }, [state.setFocusArea]);

  return (
    <main className="workbench" ref={workbenchRef}>
      <div
        className="workbench-grid dwim-layout"
        ref={workbenchGridRef}
        style={{ "--left-pane-size": `${state.leftPaneRatio * 100}%` } as CSSProperties}
      >
        <aside className="editor-workspace" aria-label="GGSQL editor">
          <div
            className="editor-stack"
            ref={editorStackRef}
            style={{ "--code-pane-size": `${state.codePaneRatio * 100}%` } as CSSProperties}
          >
            <WorkspaceCodePane promoteAi={promoteAi} />
            <PanelResizer
              orientation="horizontal"
              value={state.codePaneRatio}
              defaultValue={0.56}
              containerRef={editorStackRef}
              onChange={state.setCodePaneRatio}
              label="Resize visualization code and total data panels"
            />
            <WorkspaceDataPane promoteAi={promoteAi} />
          </div>
        </aside>

        <PanelResizer
          orientation="vertical"
          value={state.leftPaneRatio}
          defaultValue={0.44}
          containerRef={workbenchGridRef}
          onChange={state.setLeftPaneRatio}
          label="Resize workspace and visualization panels"
        />
        <WorkspaceResultPane promoteAi={promoteAi} />
      </div>
      <WorkspaceAiOverlay />
    </main>
  );
}

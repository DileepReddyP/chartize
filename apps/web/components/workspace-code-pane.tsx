"use client";

import Editor, { type OnMount } from "@monaco-editor/react";
import { useCallback, useEffect, useRef } from "react";
import { useShallow } from "zustand/react/shallow";
import {
  directManipulationRanges,
  queryControlOffsets,
  querySectionAtOffset,
} from "@/lib/ggsql/query-context";
import { useChartizeWorkspace, type AiContext } from "@/lib/workspace/store";
import { useWorkspaceViewModel } from "@/lib/workspace/view-model";
import { DwimPanel } from "./dwim-panel";
import { InlineQueryControls, type InlineControlAnchors } from "./inline-query-controls";

export type PromoteAi = (
  contextNote: string,
  placement?: "left" | "right",
  context?: AiContext,
  origin?: HTMLElement,
) => void;

export function WorkspaceCodePane({ promoteAi }: { promoteAi: PromoteAi }) {
  const view = useWorkspaceViewModel();
  const state = useChartizeWorkspace(useShallow((workspace) => ({
    activeWorkspaceId: workspace.activeWorkspaceId,
    engineState: workspace.engineState,
    catalogLoaded: workspace.catalogLoaded,
    query: workspace.query,
    running: workspace.running,
    error: workspace.error,
    inlineAnchors: workspace.inlineAnchors,
    editorContext: workspace.editorContext,
    aiOpen: workspace.aiOpen,
    dwimStatus: workspace.dwimStatus,
    editorFontSize: workspace.editorFontSize,
    editorFocusVersion: workspace.editorFocusVersion,
    focusArea: workspace.focusArea,
    editQuery: workspace.editQuery,
    runEditorQuery: workspace.runEditorQuery,
    toggleSource: workspace.toggleSource,
    toggleColumn: workspace.toggleColumn,
    removeColumn: workspace.removeColumn,
    updateVisual: workspace.updateVisual,
    addLocalFiles: workspace.addLocalFiles,
    setEditorContext: workspace.setEditorContext,
    setDwimStatus: workspace.setDwimStatus,
    setInlineAnchors: workspace.setInlineAnchors,
    setFocusArea: workspace.setFocusArea,
    setEditorFontSize: workspace.setEditorFontSize,
  })));
  const rootRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const refreshInlineControlsRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const editor = editorRef.current;
    state.setInlineAnchors(null);
    state.setEditorContext(null);
    if (!editor) return;
    editor.setScrollPosition({ scrollTop: 0, scrollLeft: 0 });
    editor.setPosition({ lineNumber: 1, column: 1 });
    let secondFrame = 0;
    const firstFrame = window.requestAnimationFrame(() => {
      editor.layout();
      secondFrame = window.requestAnimationFrame(() => refreshInlineControlsRef.current?.());
    });
    return () => {
      window.cancelAnimationFrame(firstFrame);
      if (secondFrame) window.cancelAnimationFrame(secondFrame);
    };
  }, [state.activeWorkspaceId, state.setEditorContext, state.setInlineAnchors]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let frame: number | null = null;
    let delta = 0;
    const applyZoom = () => {
      frame = null;
      if (Math.abs(delta) < 0.5) { delta = 0; return; }
      const workspace = useChartizeWorkspace.getState();
      const next = Math.max(10, Math.min(24, workspace.editorFontSize + (delta < 0 ? 1 : -1)));
      delta = 0;
      if (next === workspace.editorFontSize) return;
      workspace.setEditorFontSize(next);
      editorRef.current?.updateOptions({ fontSize: next, lineHeight: Math.round(next * 1.6) });
    };
    const interceptPinch = (event: WheelEvent) => {
      if (!event.ctrlKey || !(event.target instanceof Element) || !event.target.closest(".monaco-editor")) return;
      event.preventDefault();
      state.setFocusArea("code");
      delta += event.deltaY;
      if (frame === null) frame = window.requestAnimationFrame(applyZoom);
    };
    root.addEventListener("wheel", interceptPinch, { capture: true, passive: false });
    return () => {
      root.removeEventListener("wheel", interceptPinch, true);
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, [state.setFocusArea]);

  useEffect(() => {
    if (state.focusArea === "code") window.requestAnimationFrame(() => editorRef.current?.focus());
  }, [state.editorFocusVersion, state.focusArea]);

  const handleEditorMount: OnMount = useCallback((editor, monaco) => {
    const actions = useChartizeWorkspace.getState();
    editorRef.current = editor;
    const editorInput = editor.getDomNode()?.querySelector<HTMLTextAreaElement>("textarea");
    if (editorInput) {
      editorInput.id = "chartize-ggsql-editor";
      editorInput.name = "chartize-ggsql-editor";
    }
    let userActivated = false;
    let controlsFrame: number | null = null;
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
      if (!offsets) { actions.setInlineAnchors(null); return; }
      const locateOffset = (offset: number) => {
        const visible = editor.getScrolledVisiblePosition(model.getPositionAt(offset));
        const bounds = editor.getDomNode()?.getBoundingClientRect();
        const insideViewport = visible && bounds
          && visible.top >= 0
          && visible.top + visible.height <= bounds.height
          && visible.left >= 0
          && visible.left <= bounds.width;
        return insideViewport
          ? { left: bounds.left + visible.left + 8, top: bounds.top + visible.top + visible.height / 2 }
          : null;
      };
      const select = locateOffset(offsets.select);
      const from = locateOffset(offsets.from);
      actions.setInlineAnchors(select && from ? { select, from } : null);
    };
    const scheduleDirectControls = () => {
      actions.setInlineAnchors(null);
      if (controlsFrame !== null) window.cancelAnimationFrame(controlsFrame);
      controlsFrame = window.requestAnimationFrame(() => {
        controlsFrame = null;
        refreshDirectControls();
      });
    };
    refreshInlineControlsRef.current = scheduleDirectControls;
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
      const left = Math.max(12, Math.min((bounds?.right ?? window.innerWidth * .44) + 1, window.innerWidth - 360));
      const top = Math.max(48, Math.min((bounds?.top ?? 40) + (visible?.top ?? 20) + (visible?.height ?? 20) + 8, window.innerHeight - panelHeight - 12));
      actions.setEditorContext({ section, selectedText, offset, left, top });
      actions.setDwimStatus("");
    };
    const activate = () => {
      userActivated = true;
      actions.setFocusArea("code");
      requestAnimationFrame(locate);
    };
    const locateAfterActivation = () => {
      const workspace = useChartizeWorkspace.getState();
      if (userActivated && editor.hasTextFocus() && !workspace.aiOpen) locate();
    };
    const disposables = [
      editor.onMouseDown(activate),
      editor.onKeyDown(activate),
      editor.onDidChangeCursorPosition(locateAfterActivation),
      editor.onDidChangeCursorSelection(locateAfterActivation),
      editor.onDidChangeModelContent(scheduleDirectControls),
      editor.onDidScrollChange(() => { refreshDirectControls(); locateAfterActivation(); }),
      editor.onDidLayoutChange(scheduleDirectControls),
    ];
    editor.addCommand(monaco.KeyCode.Escape, () => actions.setEditorContext(null));
    scheduleDirectControls();
    return () => {
      if (controlsFrame !== null) window.cancelAnimationFrame(controlsFrame);
      if (refreshInlineControlsRef.current === scheduleDirectControls) refreshInlineControlsRef.current = null;
      decorations.clear();
      disposables.forEach((disposable) => disposable.dispose());
    };
  }, []);

  const run = () => void state.runEditorQuery(editorRef.current?.getValue() ?? state.query);
  const editorContext = state.editorContext;

  return (
    <div className="code-pane" ref={rootRef}>
      <header className="code-toolbar">
        <div><strong>visualization code <span>(ggsql)</span></strong></div>
        {state.error && (
          <details className="code-error" data-dismiss-on-outside>
            <summary title="Show query error" aria-label="Show query error"><span aria-hidden="true">!</span></summary>
            <div role="alert"><strong>query error</strong><p>{state.error}</p></div>
          </details>
        )}
        <button className="run-button" type="button" disabled={state.running || state.engineState !== "ready" || view.isBlankWorkspace} onClick={run}><span aria-hidden="true">▶</span>{state.running ? "running" : "run"}</button>
      </header>
      <div className="editor-body">
        <Editor
          height="100%"
          defaultLanguage="sql"
          theme="vs"
          value={state.query}
          onMount={handleEditorMount}
          options={{ automaticLayout: true, minimap: { enabled: false }, fontSize: state.editorFontSize, lineHeight: Math.round(state.editorFontSize * 1.6), mouseWheelZoom: false, lineNumbersMinChars: 3, padding: { top: 15, bottom: 15 }, wordWrap: "on", scrollBeyondLastLine: false, folding: false, renderLineHighlight: "line", selectionHighlight: true }}
          onChange={(value) => state.editQuery(value ?? "")}
        />
        {state.inlineAnchors && <InlineQueryControls anchors={state.inlineAnchors as InlineControlAnchors} sources={view.sources} activeSources={view.activeSources} selectedFields={view.selectedFieldNames} catalogLoading={!state.catalogLoaded} onSource={state.toggleSource} onColumn={state.toggleColumn} />}
        {editorContext && !state.aiOpen && (
          <DwimPanel
            section={editorContext.section}
            selectedText={editorContext.selectedText}
            position={{ left: editorContext.left, top: editorContext.top }}
            sources={view.sources}
            activeSources={view.activeSources}
            visualFields={view.visualFields}
            selectedFields={view.selectedFieldNames}
            visual={view.visualState}
            status={state.dwimStatus}
            catalogLoading={!state.catalogLoaded}
            onSource={state.toggleSource}
            onColumn={state.toggleColumn}
            onRemoveColumn={state.removeColumn}
            onVisual={state.updateVisual}
            onFiles={(files) => void state.addLocalFiles(Array.from(files))}
            onRunSelection={run}
            onPromoteAi={(origin) => promoteAi(`${view.aiViewNote} ${editorContext.section === "selection" ? `Selected GGSQL: ${editorContext.selectedText}` : `${editorContext.section === "sql" ? "SQL" : "VISUALISE"} at character ${editorContext.offset}`}`, "right", "code", origin)}
            onClose={() => state.setEditorContext(null)}
          />
        )}
      </div>
    </div>
  );
}

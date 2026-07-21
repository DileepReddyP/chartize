"use client";

import { useEffect, useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { sourceAlias } from "@/lib/ggsql/query-context";
import { useChartizeWorkspace } from "@/lib/workspace/store";
import { useWorkspaceViewModel } from "@/lib/workspace/view-model";
import { DataGrid } from "./data-grid";
import { DataUploadControl, filesFromDrop, type DataUploadMode } from "./data-upload-control";
import { SourceTiles } from "./dwim-panel";
import type { PromoteAi } from "./workspace-code-pane";
import { WorkspaceSelectionActions } from "./workspace-selection-actions";
import { useWorkspaceScopeId } from "./workspace-scope";

export function WorkspaceDataPane({ promoteAi }: { promoteAi: PromoteAi }) {
  const workspaceId = useWorkspaceScopeId();
  const view = useWorkspaceViewModel();
  const state = useChartizeWorkspace(useShallow((workspace) => ({
    catalogLoaded: workspace.catalogLoaded,
    fullData: workspace.fullData,
    fullLoading: workspace.fullLoading,
    fullSort: workspace.fullSort,
    dockSource: workspace.dockSource,
    loadFullTable: workspace.loadFullTable,
    loadMoreFullTable: workspace.loadMoreFullTable,
    sortFullTable: workspace.sortFullTable,
    addColumnFromTable: workspace.addColumnFromTable,
    addLocalFiles: workspace.addLocalFiles,
    toggleSource: workspace.toggleSource,
    removeLocalSource: workspace.removeLocalSource,
    setDockSource: workspace.setDockSource,
    setFocusArea: workspace.setFocusArea,
    setSelectionOrigin: workspace.setSelectionOrigin,
    setGridSelection: workspace.setGridSelection,
    aiPrompt: workspace.aiPrompt,
    setAiPrompt: workspace.setAiPrompt,
    setAiMessage: workspace.setAiMessage,
  })));
  const [dropActive, setDropActive] = useState(false);

  useEffect(() => {
    if (!view.activeSources.length) return;
    state.setDockSource((current) => view.activeSources.includes(current) ? current : view.activeSources[0]!);
  }, [state.setDockSource, view.activeSources]);

  useEffect(() => {
    if (state.dockSource && !state.fullData.rows.length && !state.fullLoading) {
      void state.loadFullTable(state.dockSource, 0, state.fullSort);
    }
  }, [state.dockSource, state.fullData.rows.length, state.fullLoading, state.fullSort, state.loadFullTable]);

  const selectedColumns = useMemo(() => {
    const sourceIndex = Math.max(0, view.activeSources.indexOf(state.dockSource));
    const alias = sourceAlias(state.dockSource, sourceIndex);
    return new Set(state.fullData.columns.filter((column) => view.selectedFieldNames.has(column) || view.selectedFieldNames.has(`${alias}__${column}`)));
  }, [state.dockSource, state.fullData.columns, view.activeSources, view.selectedFieldNames]);

  const importFiles = async (files: File[], mode: DataUploadMode) => {
    const imported = await state.addLocalFiles(files);
    if (!imported.length) return;
    const sources = imported.map((dataset) => `user:${dataset.tableName}`);
    if (mode === "manual") {
      state.setAiMessage(`${sources.join(" + ")} opened as raw browser data. Use the table and GGSQL editor to inspect or clean it.`);
      return;
    }
    const suggestion = `Profile ${sources.join(" and ")}, summarize the data-quality issues you find, and propose a cleaning plan. Preview transformations without mutating the raw source until I explicitly approve them.`;
    state.setAiPrompt(state.aiPrompt.trim() ? `${state.aiPrompt.trim()}\n\n${suggestion}` : suggestion);
    promoteAi(`New browser-local source${sources.length === 1 ? "" : "s"}: ${sources.join(", ")}. The original uploads remain unchanged. Profile and clean them conversationally; the raw table and current GGSQL are attached.`, "right", "general");
  };

  return (
    <section
      className="source-dock"
      aria-label="Source tables"
      onPointerDown={() => state.setFocusArea("table")}
      onWheel={(event) => { if (event.ctrlKey) event.preventDefault(); }}
      onDragEnter={(event) => { if (event.dataTransfer.types.includes("Files")) { event.preventDefault(); setDropActive(true); } }}
      onDragOver={(event) => { if (event.dataTransfer.types.includes("Files")) { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; } }}
      onDragLeave={(event) => { if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) setDropActive(false); }}
      onDrop={(event) => { event.preventDefault(); setDropActive(false); void importFiles(filesFromDrop(event), "conversation"); }}
    >
      <header className="code-toolbar source-dock-toolbar"><div><strong>total data</strong></div><DataUploadControl disabled={state.fullLoading} onFiles={importFiles} /></header>
      <header className="source-dock-tabs">
        <nav aria-label="Selected source tables">
          {view.activeSources.map((source) => (
            <button key={source} type="button" className={state.dockSource === source ? "active" : ""} onClick={() => state.setDockSource(source)}>
              {view.sources.find((candidate) => candidate.id === source)?.title ?? source}
            </button>
          ))}
        </nav>
        <details className="source-dock-add" data-dismiss-on-outside>
          <summary title="Add a source table" aria-label="Add a source table">+</summary>
          <div><header><b>sources</b></header><SourceTiles sources={view.sources} activeSources={view.activeSources} onSource={state.toggleSource} onRemoveSource={(tableName) => {
            const source = view.sources.find((candidate) => candidate.id === `user:${tableName}`);
            if (window.confirm(`Remove ${source?.title ?? tableName} and its local data from this browser?`)) void state.removeLocalSource(tableName);
          }} loading={!state.catalogLoaded} /></div>
        </details>
      </header>
      <div className="source-dock-body">
        <DataGrid
          data={state.fullData}
          loading={state.fullLoading}
          selectedColumns={selectedColumns}
          sort={state.fullSort}
          streamKey={`${workspaceId}:${state.dockSource}:${state.fullSort?.column ?? ""}:${state.fullSort?.direction ?? ""}`}
          onSort={state.sortFullTable}
          onAddColumn={state.addColumnFromTable}
          onLoadMore={state.loadMoreFullTable}
          onSelection={(selection) => {
            state.setFocusArea("table");
            state.setSelectionOrigin("dock");
            state.setGridSelection(selection);
          }}
        />
        <WorkspaceSelectionActions origin="dock" view={view} promoteAi={promoteAi} />
      </div>
      {dropActive && <div className="source-drop-overlay"><span>＋</span><b>drop to profile with chartize ai</b><small>the raw file stays unchanged in this browser</small></div>}
    </section>
  );
}

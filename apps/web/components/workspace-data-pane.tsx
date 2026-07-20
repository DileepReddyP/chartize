"use client";

import { useEffect, useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { sourceAlias } from "@/lib/ggsql/query-context";
import { useChartizeWorkspace } from "@/lib/workspace/store";
import { useWorkspaceViewModel } from "@/lib/workspace/view-model";
import { DataGrid } from "./data-grid";
import { SourceTiles } from "./dwim-panel";
import type { PromoteAi } from "./workspace-code-pane";
import { WorkspaceSelectionActions } from "./workspace-selection-actions";

export function WorkspaceDataPane({ promoteAi }: { promoteAi: PromoteAi }) {
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
    toggleSource: workspace.toggleSource,
    removeLocalSource: workspace.removeLocalSource,
    setDockSource: workspace.setDockSource,
    setFocusArea: workspace.setFocusArea,
    setSelectionOrigin: workspace.setSelectionOrigin,
    setGridSelection: workspace.setGridSelection,
  })));

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

  return (
    <section
      className="source-dock"
      aria-label="Source tables"
      onPointerDown={() => state.setFocusArea("table")}
      onWheel={(event) => { if (event.ctrlKey) event.preventDefault(); }}
    >
      <header className="code-toolbar source-dock-toolbar"><div><strong>total data</strong></div></header>
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
          streamKey={`${state.dockSource}:${state.fullSort?.column ?? ""}:${state.fullSort?.direction ?? ""}`}
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
    </section>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { serializeDraft } from "@/lib/ggsql/serialize";
import {
  BUILTIN_DATASETS,
  WorkspaceShareStateSchema,
  makeInitialWorkspaceDraft,
  useChartizeWorkspace,
} from "@/lib/workspace/store";
import type { PromoteAi } from "./workspace-code-pane";

function decodeShareState(value: string) {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
  const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
  return WorkspaceShareStateSchema.parse(JSON.parse(new TextDecoder().decode(bytes)));
}

export function useWorkspaceLifecycle(aiViewNote: string, promoteAi: PromoteAi) {
  const firstDraft = useMemo(() => makeInitialWorkspaceDraft(), []);
  const initialized = useRef(false);
  const openedAiFromUrl = useRef(false);
  const [sessionReady, setSessionReady] = useState(false);
  const state = useChartizeWorkspace(useShallow((workspace) => ({
    engineState: workspace.engineState,
    catalogLoaded: workspace.catalogLoaded,
    catalogDatasets: workspace.catalogDatasets,
    initializeBrowserEngine: workspace.initializeBrowserEngine,
    runQuery: workspace.runQuery,
    applyDataset: workspace.applyDataset,
    setDraft: workspace.setDraft,
    setQuery: workspace.setQuery,
    persistWorkspaceSession: workspace.persistWorkspaceSession,
    restoreWorkspaceSession: workspace.restoreWorkspaceSession,
  })));

  useEffect(() => {
    void state.initializeBrowserEngine(process.env.NEXT_PUBLIC_SPATIALITE_WASM_URL ?? "/wasm/mod_spatialite.wasm").catch(() => undefined);
  }, [state.initializeBrowserEngine]);

  useEffect(() => {
    if (state.engineState !== "ready" || !state.catalogLoaded || initialized.current) return;
    initialized.current = true;
    let cancelled = false;
    const boot = async () => {
      const hash = window.location.hash.match(/^#view=(.+)$/)?.[1];
      if (hash) {
        const shared = decodeShareState(hash);
        const draft = shared.draft ?? firstDraft;
        const query = shared.query ?? serializeDraft(draft);
        state.setDraft(draft);
        state.setQuery(query);
        await state.runQuery(query);
      } else if (new URLSearchParams(window.location.search).get("workspace") === "active") {
        const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
        const loadedExploreDirectly = (() => {
          try { return !navigation || new URL(navigation.name).pathname === window.location.pathname; }
          catch { return true; }
        })();
        // A client-side home-card handoff already put the requested workspace
        // in memory. A hard refresh has a fresh store, so restore the autosave
        // before honoring the same `workspace=active` URL.
        if (loadedExploreDirectly && await state.restoreWorkspaceSession()) {
          await useChartizeWorkspace.getState().runQuery();
        } else {
          await state.runQuery();
        }
      } else if (await state.restoreWorkspaceSession()) {
        await useChartizeWorkspace.getState().runQuery();
      } else {
        const featured = state.catalogDatasets.find((dataset) => dataset.slug === "presidential_approval_average") ?? state.catalogDatasets[0];
        if (featured?.slug === "presidential_approval_average") {
          const query = serializeDraft(firstDraft);
          state.setDraft(firstDraft);
          state.setQuery(query);
          await state.runQuery(query);
        } else if (featured) {
          state.applyDataset(`chartize:${featured.slug}`, featured, false);
          await useChartizeWorkspace.getState().runQuery();
        } else {
          const fallback = BUILTIN_DATASETS[0]!;
          state.applyDataset(fallback.tableName, fallback, false);
          await useChartizeWorkspace.getState().runQuery();
        }
      }
      if (!cancelled) setSessionReady(true);
    };
    void boot().catch((cause) => {
      if (!cancelled) {
        useChartizeWorkspace.getState().setAiMessage(cause instanceof Error ? cause.message : String(cause));
        setSessionReady(true);
      }
    });
    return () => { cancelled = true; };
  }, [firstDraft, state]);

  useEffect(() => {
    if (!sessionReady) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let persistenceFailed = false;
    const persist = () => {
      if (timer) clearTimeout(timer);
      timer = null;
      if (persistenceFailed) return;
      void useChartizeWorkspace.getState().persistWorkspaceSession().catch(() => {
        persistenceFailed = true;
        useChartizeWorkspace.getState().setAiMessage("Browser autosave is unavailable for this session.");
      });
    };
    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(persist, 350);
    };
    const unsubscribe = useChartizeWorkspace.subscribe(schedule);
    const saveWhenHidden = () => { if (document.visibilityState === "hidden") persist(); };
    document.addEventListener("visibilitychange", saveWhenHidden);
    schedule();
    return () => {
      unsubscribe();
      document.removeEventListener("visibilitychange", saveWhenHidden);
      persist();
    };
  }, [sessionReady]);

  useEffect(() => {
    const dismissOnEscape = (event: KeyboardEvent) => {
      const workspace = useChartizeWorkspace.getState();
      if (event.key !== "Escape" || workspace.aiOpen) return;
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
      if (workspace.editorContext) {
        workspace.setEditorContext(null);
        consume();
        return;
      }
      if (workspace.gridSelection || workspace.chartSelection || workspace.mapFeatureSelections.length) {
        workspace.setGridSelection(null);
        workspace.setChartSelection(null);
        workspace.setMapFeatureSelections([]);
        workspace.setResultStatus("");
        consume();
      }
    };
    document.addEventListener("keydown", dismissOnEscape, true);
    return () => document.removeEventListener("keydown", dismissOnEscape, true);
  }, []);

  useEffect(() => {
    const dismissMenus = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      document.querySelectorAll<HTMLDetailsElement>("details[data-dismiss-on-outside][open]").forEach((details) => {
        if (!details.contains(target)) details.removeAttribute("open");
      });
    };
    document.addEventListener("pointerdown", dismissMenus, true);
    return () => document.removeEventListener("pointerdown", dismissMenus, true);
  }, []);

  useEffect(() => {
    if (!sessionReady || openedAiFromUrl.current) return;
    const openAssistant = () => promoteAi(`${aiViewNote} Current query and source catalog are attached.`, "left", "general");
    window.addEventListener("chartize:open-ai", openAssistant);
    if (new URLSearchParams(window.location.search).get("ai") === "general") {
      openedAiFromUrl.current = true;
      openAssistant();
    }
    return () => window.removeEventListener("chartize:open-ai", openAssistant);
  }, [aiViewNote, promoteAi, sessionReady]);
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { serializeDraft } from "@/lib/ggsql/serialize";
import { VISUALIZATION_EXAMPLES } from "@/lib/ggsql/examples";
import { workspaceInputForExample } from "@/lib/workspace/example-workspace";
import { homeStoryForExample } from "@/lib/workspace/home-stories";
import { chooseDwimAiContext } from "@/lib/workspace/ai-context";
import {
  WorkspaceShareStateSchema,
  makeInitialWorkspaceDraft,
  useChartizeWorkspace,
} from "@/lib/workspace/store";
import type { PromoteAi } from "./workspace-code-pane";
import { useProfile } from "./profile-provider";

function decodeShareState(value: string) {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
  const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
  return WorkspaceShareStateSchema.parse(JSON.parse(new TextDecoder().decode(bytes)));
}

export function useWorkspaceLifecycle(aiViewNote: string, promoteAi: PromoteAi) {
  const profile = useProfile();
  const firstDraft = useMemo(() => makeInitialWorkspaceDraft(), []);
  const initialized = useRef(false);
  const openedAiFromUrl = useRef(false);
  const [sessionReady, setSessionReady] = useState(false);
  const state = useChartizeWorkspace(useShallow((workspace) => ({
    engineState: workspace.engineState,
    catalogLoaded: workspace.catalogLoaded,
    initializeBrowserEngine: workspace.initializeBrowserEngine,
    runQuery: workspace.runQuery,
    setDraft: workspace.setDraft,
    setQuery: workspace.setQuery,
    persistWorkspaceSession: workspace.persistWorkspaceSession,
    restoreWorkspaceSession: workspace.restoreWorkspaceSession,
  })));

  useEffect(() => {
    if (!profile.ready) return;
    void state.initializeBrowserEngine(process.env.NEXT_PUBLIC_SPATIALITE_WASM_URL ?? "/wasm/mod_spatialite.wasm").catch(() => undefined);
  }, [state.initializeBrowserEngine, profile.ready]);

  useEffect(() => {
    if (state.engineState !== "ready" || !state.catalogLoaded || initialized.current) return;
    initialized.current = true;
    let cancelled = false;
    const boot = async () => {
      const hash = window.location.hash.match(/^#view=(.+)$/)?.[1];
      const search = new URLSearchParams(window.location.search);
      const homeStory = homeStoryForExample(search.get("example"));
      const homeExample = homeStory
        ? VISUALIZATION_EXAMPLES.find((example) => example.id === homeStory.id)
        : undefined;
      if (hash) {
        const shared = decodeShareState(hash);
        const draft = shared.draft ?? firstDraft;
        const query = shared.query ?? serializeDraft(draft);
        state.setDraft(draft);
        state.setQuery(query);
        await state.runQuery(query);
      } else if (search.get("new") === "blank") {
        await state.restoreWorkspaceSession().catch(() => false);
        useChartizeWorkspace.getState().openWorkspace(undefined, { run: false, replacePristineBootstrap: true });
        const cleanUrl = new URL(window.location.href);
        cleanUrl.searchParams.delete("new");
        window.history.replaceState(window.history.state, "", `${cleanUrl.pathname}${cleanUrl.search}${cleanUrl.hash}`);
      } else if (homeExample) {
        await state.restoreWorkspaceSession().catch(() => false);
        const workspace = useChartizeWorkspace.getState();
        workspace.openWorkspace(workspaceInputForExample(homeExample), { run: false, replacePristineBootstrap: true });
        if (search.get("ai") === "general" && homeStory?.ask) workspace.setAiPrompt(homeStory.ask);
        await useChartizeWorkspace.getState().runQuery(homeExample.query);
        const cleanUrl = new URL(window.location.href);
        cleanUrl.searchParams.delete("example");
        window.history.replaceState(window.history.state, "", `${cleanUrl.pathname}${cleanUrl.search}${cleanUrl.hash}`);
      } else if (search.get("workspace") === "active") {
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
      }
      if (!cancelled) { useChartizeWorkspace.setState({ workspaceSessionReady: true }); setSessionReady(true); }
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
    if (!sessionReady) return;
    const openAssistant = () => {
      const workspace = useChartizeWorkspace.getState();
      const context = chooseDwimAiContext({
        blank: !workspace.query.trim(),
        hasEditorContext: Boolean(workspace.editorContext),
        hasGridSelection: Boolean(workspace.gridSelection),
        hasVisualSelection: Boolean(workspace.chartSelection || workspace.mapFeatureSelections.length),
        focusArea: workspace.focusArea,
      });
      if (context === "code" && workspace.editorContext) {
        const editor = workspace.editorContext;
        promoteAi(
          `${aiViewNote} ${editor.section === "selection" ? `Selected GGSQL: ${editor.selectedText}` : `${editor.section === "sql" ? "SQL" : "VISUALISE"} at character ${editor.offset}`}`,
          "right",
          "code",
        );
        return;
      }
      if (context === "data" && workspace.gridSelection) {
        promoteAi(`${aiViewNote} The live table selection is the active subject.`, "left", "data");
        return;
      }
      if (context === "chart" && (workspace.chartSelection || workspace.mapFeatureSelections.length)) {
        promoteAi(`${aiViewNote} The live chart selection is the active subject.`, "left", "chart");
        return;
      }
      if (context === "general") {
        promoteAi(`${aiViewNote} The visualization canvas is blank; use the available source catalog to build the requested view.`, "left", "general");
        return;
      }
      if (context === "code") {
        promoteAi(`${aiViewNote} The current GGSQL editor is the active context.`, "right", "code");
        return;
      }
      if (context === "data") {
        promoteAi(`${aiViewNote} The active source table is the active context.`, "left", "data");
        return;
      }
      promoteAi(`${aiViewNote} The rendered chart and current query are the active context.`, "left", "chart");
    };
    window.addEventListener("chartize:open-ai", openAssistant);
    if (!openedAiFromUrl.current && new URLSearchParams(window.location.search).get("ai") === "general") {
      openedAiFromUrl.current = true;
      promoteAi(`${aiViewNote} Current query and source catalog are attached.`, "left", "general");
    }
    return () => window.removeEventListener("chartize:open-ai", openAssistant);
  }, [aiViewNote, promoteAi, sessionReady]);
}

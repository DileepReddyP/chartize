"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { visualPointState } from "@/lib/ggsql/query-context";
import { makeDefaultDraft } from "@/lib/ggsql/serialize";
import type { VisualizationExample } from "@/lib/ggsql/examples";
import { useChartizeWorkspace } from "@/lib/workspace/store";
import { VisualizationExamplePicker } from "./visualization-example-picker";

export function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const aiPhase = useChartizeWorkspace((state) => state.aiPhase);
  const setAiPhase = useChartizeWorkspace((state) => state.setAiPhase);
  const activeWorkspaceId = useChartizeWorkspace((state) => state.activeWorkspaceId);
  const workspaceDocuments = useChartizeWorkspace((state) => state.workspaceDocuments);
  const activeTitle = useChartizeWorkspace((state) => state.draft.title || "untitled visualization");
  const openWorkspace = useChartizeWorkspace((state) => state.openWorkspace);
  const switchWorkspace = useChartizeWorkspace((state) => state.switchWorkspace);
  const closeWorkspace = useChartizeWorkspace((state) => state.closeWorkspace);
  const activationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const workspaceMenu = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const opened = () => {
      if (useChartizeWorkspace.getState().aiPhase !== "activating") setAiPhase("active");
    };
    const closed = () => {
      if (activationTimer.current) clearTimeout(activationTimer.current);
      activationTimer.current = null;
      setAiPhase("idle");
    };
    window.addEventListener("chartize:ai-opened", opened);
    window.addEventListener("chartize:ai-closed", closed);
    const dismissWorkspaceMenu = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && workspaceMenu.current?.open && !workspaceMenu.current.contains(target)) workspaceMenu.current.open = false;
    };
    document.addEventListener("pointerdown", dismissWorkspaceMenu, true);
    return () => {
      window.removeEventListener("chartize:ai-opened", opened);
      window.removeEventListener("chartize:ai-closed", closed);
      document.removeEventListener("pointerdown", dismissWorkspaceMenu, true);
      if (activationTimer.current) clearTimeout(activationTimer.current);
    };
  }, []);

  const openAssistant = () => {
    setAiPhase("activating");
    if (activationTimer.current) clearTimeout(activationTimer.current);
    activationTimer.current = setTimeout(() => setAiPhase("active"), 420);
    if (pathname === "/explore") {
      window.dispatchEvent(new CustomEvent("chartize:open-ai", { detail: { context: "general" } }));
    } else {
      router.push("/explore?ai=general");
    }
  };

  const announceWorkspaceChange = () => {
    workspaceMenu.current?.removeAttribute("open");
    window.dispatchEvent(new CustomEvent("chartize:ai-closed"));
    if (pathname === "/explore") window.dispatchEvent(new CustomEvent("chartize:workspace-switched"));
    else router.push("/explore?workspace=active");
  };

  const chooseWorkspace = (id: string) => {
    if (id === activeWorkspaceId) { workspaceMenu.current?.removeAttribute("open"); return; }
    switchWorkspace(id);
    announceWorkspaceChange();
  };

  const newWorkspace = () => {
    openWorkspace();
    announceWorkspaceChange();
  };

  const loadExample = (example: VisualizationExample) => {
    const point = visualPointState(example.query);
    const draft = makeDefaultDraft(example.source);
    draft.title = point.title || example.title;
    draft.subtitle = point.subtitle || example.description;
    openWorkspace({
      title: draft.title,
      draft,
      query: example.query,
      mode: example.mode,
      dockSource: example.source,
    });
    announceWorkspaceChange();
  };

  const removeWorkspace = (id: string) => {
    const wasActive = id === activeWorkspaceId;
    closeWorkspace(id);
    if (wasActive) announceWorkspaceChange();
  };

  return (
    <header className="topbar">
      <Link className="brand" href="/explore" aria-label="Chartize explorer">
        <span className="brand-mark" aria-hidden="true" />
        <span>Chartize</span>
      </Link>
      <div className="topbar-workspace-lockup">
        <details className="workspace-switcher" ref={workspaceMenu}>
          <summary title="Switch workspace"><span>{String(workspaceDocuments.findIndex((document) => document.id === activeWorkspaceId) + 1).padStart(2, "0")}</span><b>{activeTitle}</b><svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4" /></svg></summary>
          <div>
            <header><i>ws</i><span><b>workspaces</b><small>recent visualizations</small></span><button type="button" onClick={newWorkspace}>＋ new</button></header>
            <ol>
              {workspaceDocuments.map((document, index) => {
                const active = document.id === activeWorkspaceId;
                const title = active ? activeTitle : document.title;
                return <li key={document.id} className={active ? "active" : ""}><button type="button" onClick={() => chooseWorkspace(document.id)}><i>{String(index + 1).padStart(2, "0")}</i><span><b>{title}</b><small>{active ? "current workspace" : document.mode === "warehouse" ? "vps warehouse" : "private browser"}</small></span></button><button type="button" disabled={workspaceDocuments.length <= 1} title={`Close ${title}`} aria-label={`Close ${title}`} onClick={() => removeWorkspace(document.id)}>×</button></li>;
              })}
            </ol>
          </div>
        </details>
        <button className="new-visualization-button" type="button" onClick={newWorkspace}><span aria-hidden="true">＋</span>new visualization</button>
        <VisualizationExamplePicker onSelect={loadExample} />
      </div>
      <nav aria-label="Primary navigation">
        <button className={`toolbar-ai-button ${aiPhase}`} aria-pressed={aiPhase === "active"} type="button" onClick={openAssistant}><span aria-hidden="true">✦</span> ask chartize</button>
        <Link href="/explore">Explore</Link>
        <Link href="/admin">Admin</Link>
      </nav>
    </header>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { useShallow } from "zustand/react/shallow";
import type { VisualizationExample } from "@/lib/ggsql/examples";
import { workspaceInputForExample } from "@/lib/workspace/example-workspace";
import { useChartizeWorkspace } from "@/lib/workspace/store";
import { VisualizationExamplePicker } from "./visualization-example-picker";
import { ProfileMenu } from "./profile-menu";
import { useProfile } from "./profile-provider";
import { HeaderButton } from "./header-control";
import { UiIcon } from "./ui-icons";

export function AppHeader() {
  const profile = useProfile();
  const pathname = usePathname();
  const {
    aiPhase, setAiPhase, activeWorkspaceId, workspaceDocuments, activeTitle,
    openWorkspace, switchWorkspace, closeWorkspace, closeAi,
  } = useChartizeWorkspace(useShallow((state) => ({
    aiPhase: state.aiPhase,
    setAiPhase: state.setAiPhase,
    activeWorkspaceId: state.activeWorkspaceId,
    workspaceDocuments: state.workspaceDocuments,
    activeTitle: state.draft.title || "untitled visualization",
    openWorkspace: state.openWorkspace,
    switchWorkspace: state.switchWorkspace,
    closeWorkspace: state.closeWorkspace,
    closeAi: state.closeAi,
  })));
  const activationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const workspaceMenu = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    if (pathname !== "/explore") return;
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
  }, [pathname, setAiPhase]);

  const openAssistant = () => {
    setAiPhase("activating");
    if (activationTimer.current) clearTimeout(activationTimer.current);
    activationTimer.current = setTimeout(() => setAiPhase("active"), 420);
    window.dispatchEvent(new CustomEvent("chartize:open-ai", { detail: { context: "general" } }));
  };

  const announceWorkspaceChange = () => {
    workspaceMenu.current?.removeAttribute("open");
    closeAi();
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
    openWorkspace(workspaceInputForExample(example));
    announceWorkspaceChange();
  };

  const removeWorkspace = (id: string) => {
    const wasActive = id === activeWorkspaceId;
    closeWorkspace(id);
    if (wasActive) announceWorkspaceChange();
  };

  if (pathname !== "/explore") return null;

  return (
    <header className="topbar">
      <Link className="brand" href="/" aria-label="Chartize home">
        <span className="brand-mark" aria-hidden="true" />
        <span>Chartize</span>
      </Link>
      <div className="topbar-workspace-lockup">
        <details className="workspace-switcher" ref={workspaceMenu}>
          <summary title="Switch workspace"><span>{String(workspaceDocuments.findIndex((document) => document.id === activeWorkspaceId) + 1).padStart(2, "0")}</span><b>{activeTitle}</b><svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4" /></svg></summary>
          <div>
            <header><i>ws</i><span><b>your visualizations</b><small>{profile.user?.handle ?? "anonymous"} · local</small></span><button type="button" onClick={newWorkspace}>＋ new</button></header>
            <ol>
              {workspaceDocuments.map((document, index) => {
                const active = document.id === activeWorkspaceId;
                const title = active ? activeTitle : document.title;
                return <li key={document.id} className={active ? "active" : ""}><button type="button" onClick={() => chooseWorkspace(document.id)}><i>{String(index + 1).padStart(2, "0")}</i><span><b>{title}</b><small>{active ? "open now" : "autosaved"}</small></span></button><button type="button" disabled={workspaceDocuments.length <= 1} title={`Close ${title}`} aria-label={`Close ${title}`} onClick={() => removeWorkspace(document.id)}>×</button></li>;
              })}
            </ol>
          </div>
        </details>
        <HeaderButton className="new-visualization-button" label="New visualization" icon={<UiIcon name="plus" />} onClick={newWorkspace} />
        <VisualizationExamplePicker onSelect={loadExample} />
      </div>
      <nav aria-label="Primary navigation">
        <HeaderButton className={`toolbar-ai-button ${aiPhase}`} label="Ask Chartize" icon={<UiIcon name="spark" />} aria-pressed={aiPhase === "active"} onClick={openAssistant} />
        <ProfileMenu />
      </nav>
    </header>
  );
}

"use client";

import { createContext, useContext, type ReactNode } from "react";

const WorkspaceScopeContext = createContext<string | null>(null);

export function WorkspaceScope({ workspaceId, children }: { workspaceId: string; children: ReactNode }) {
  return <WorkspaceScopeContext.Provider value={workspaceId}>{children}</WorkspaceScopeContext.Provider>;
}

export function useWorkspaceScopeId() {
  const workspaceId = useContext(WorkspaceScopeContext);
  if (!workspaceId) throw new Error("Workspace components must render inside a WorkspaceScope.");
  return workspaceId;
}

"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { useChartizeWorkspace } from "@/lib/workspace/store";

export function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const aiPhase = useChartizeWorkspace((state) => state.aiPhase);
  const setAiPhase = useChartizeWorkspace((state) => state.setAiPhase);
  const activationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    return () => {
      window.removeEventListener("chartize:ai-opened", opened);
      window.removeEventListener("chartize:ai-closed", closed);
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

  return (
    <header className="topbar">
      <Link className="brand" href="/explore" aria-label="Chartize explorer">
        <span className="brand-mark" aria-hidden="true" />
        <span>Chartize</span>
      </Link>
      <nav aria-label="Primary navigation">
        <button className={`toolbar-ai-button ${aiPhase}`} aria-pressed={aiPhase === "active"} type="button" onClick={openAssistant}><span aria-hidden="true">✦</span> ask chartize</button>
        <Link href="/explore">Explore</Link>
        <Link href="/admin">Admin</Link>
      </nav>
    </header>
  );
}

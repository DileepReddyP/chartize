"use client";

import type { AiResponsePreferences, AiTurnActivity } from "@chartize/contracts";
import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { containFloating } from "@/lib/floating-placement";

const thinkingLevels = [
  ["auto", "let chartize choose"],
  ["low", "quick, straightforward work"],
  ["medium", "a little more thought"],
  ["high", "complex code and analysis"],
  ["xhigh", "deeper investigation"],
  ["max", "take the time it needs"],
] as const;

export function AiResponseControls({ preferences, onPreferences }: {
  preferences: AiResponsePreferences;
  onPreferences: (value: AiResponsePreferences) => void;
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<CSSProperties>({});
  useLayoutEffect(() => {
    if (!open) return;
    const fit = () => {
      const anchor = detailsRef.current?.getBoundingClientRect();
      const menu = menuRef.current;
      if (!anchor || !menu) return;
      const viewport = window.visualViewport;
      const left = viewport?.offsetLeft ?? 0;
      const top = viewport?.offsetTop ?? 0;
      const bounds = containFloating({ left: anchor.right - 310, top: anchor.top - menu.scrollHeight - 12 },
        { width: 310, height: menu.scrollHeight + 5 },
        { left, top, right: left + (viewport?.width ?? innerWidth), bottom: top + (viewport?.height ?? innerHeight) });
      setPosition({ left: bounds.left - anchor.left, top: bounds.top - anchor.top, right: "auto", bottom: "auto", width: bounds.width, maxHeight: bounds.maxHeight });
    };
    fit();
    window.addEventListener("resize", fit);
    window.visualViewport?.addEventListener("resize", fit);
    window.visualViewport?.addEventListener("scroll", fit);
    return () => {
      window.removeEventListener("resize", fit);
      window.visualViewport?.removeEventListener("resize", fit);
      window.visualViewport?.removeEventListener("scroll", fit);
    };
  }, [open]);
  return (
    <details ref={detailsRef} className="ai-settings ai-thinking-settings" data-dismiss-on-outside onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary aria-label="Thinking level" title="Choose how much Chartize thinks">thinking · {preferences.thinking}</summary>
      <div ref={menuRef} style={position}>
        <header><i>03</i><span><b>thinking</b><small>fast mode stays on</small></span></header>
        <div className="ai-thinking-levels" role="group" aria-label="Thinking level options">
          {thinkingLevels.map(([value, description]) => (
            <button key={value} type="button" aria-pressed={preferences.thinking === value} onClick={(event) => {
              onPreferences({ thinking: value });
              event.currentTarget.closest("details")?.removeAttribute("open");
            }}><b>{value}</b><small>{description}</small></button>
          ))}
        </div>
        <p>auto can think harder as the task develops. a manual choice stays fixed for your turns.</p>
      </div>
    </details>
  );
}

export function AiActivity({ activity }: { activity: AiTurnActivity }) {
  const labels: Record<string, string> = {
    wikipedia_search: "Wikipedia search", wikipedia_article: "Wikipedia article", web_search: "web research",
    source_schema: "source fields", get_visualization_tips: "GGSQL reference", increase_thinking: "deeper thinking",
    workspace_queries: "workspace queries", selected_rows: "selected rows", local_changes: "local changes",
    enable_web_search: "web research requested",
  };
  return (
    <details className="ai-approach">
      <summary>{activity.thinking} thinking{activity.tools.includes("web_search") ? " · web research" : activity.tools.some((name) => name.startsWith("wikipedia_")) ? " · Wikipedia" : ""}</summary>
      <small>{activity.tools.length ? activity.tools.map((name) => labels[name] ?? name).join(" · ") : "answered directly"}</small>
    </details>
  );
}

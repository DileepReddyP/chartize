"use client";

import type { AiResponsePreferences, AiTurnPlan } from "@chartize/contracts";
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

export function AiApproach({ plan }: { plan: AiTurnPlan }) {
  const features = [
    plan.research === "wikipedia" ? "wikipedia" : plan.research === "web" ? "web research" : null,
    plan.queryData ? "workspace queries" : null,
    plan.shareSelection ? "selected rows" : null,
    plan.localChanges ? "local changes" : null,
    plan.hypotheses ? "hypotheses" : null,
    plan.technical ? "technical detail" : null,
    plan.challenge ? "checking assumptions" : null,
    plan.concise ? "concise" : null,
  ].filter(Boolean);
  return (
    <details className="ai-approach">
      <summary>{plan.thinking} thinking{plan.research !== "none" ? ` · ${plan.research === "web" ? "web research" : "wikipedia"}` : ""}</summary>
      <p>{plan.summary}</p>
      {features.length > 0 && <small>{features.join(" · ")}</small>}
    </details>
  );
}

"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import type { AiContext, AiConversationMessage, AiPlacement } from "@/lib/workspace/store";

export type { AiConversationMessage } from "@/lib/workspace/store";

interface AiAssistantProps {
  context: AiContext;
  placement: AiPlacement;
  contextNote: string;
  prompt: string;
  busy: boolean;
  status: string;
  history: AiConversationMessage[];
  includeSamples: boolean;
  leftPaneRatio: number;
  onClose: () => void;
  onPrompt: (value: string) => void;
  onIncludeSamples: (value: boolean) => void;
  onAsk: (task: "generate" | "repair" | "explain") => void;
}

const contextCopy: Record<AiContext, {
  mode: string;
  placeholder: string;
  primary: string;
  explain: string;
}> = {
  code: {
    mode: "code at cursor",
    placeholder: "Ask about this GGSQL or describe a code change…",
    primary: "apply to code",
    explain: "explain current code",
  },
  chart: {
    mode: "chart selection",
    placeholder: "What should this chart communicate better?",
    primary: "enhance chart",
    explain: "explain current view",
  },
  general: {
    mode: "workspace",
    placeholder: "What question do you want to answer with data?",
    primary: "build a view",
    explain: "explain current view",
  },
};

export function AiAssistant({
  context,
  placement,
  contextNote,
  prompt,
  busy,
  status,
  history,
  includeSamples,
  leftPaneRatio,
  onClose,
  onPrompt,
  onIncludeSamples,
  onAsk,
}: AiAssistantProps) {
  const copy = contextCopy[context];
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const focusFrame = requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(inputRef.current.value.length, inputRef.current.value.length);
    });
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [context, onClose]);

  return createPortal(
    <div
      className={`ai-overlay context-${context} placement-${placement}`}
      style={{ "--ai-left-width": `${leftPaneRatio * 100}vw` } as CSSProperties}
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section className="ai-surface" role="dialog" aria-label="Chartize AI conversation">
        <header className="ai-surface-header">
          <div><span className="ai-spark" aria-hidden="true">✦</span><h2>chartize ai</h2><small>{copy.mode}</small></div>
          <button type="button" title="Close" aria-label="Close AI conversation" onClick={onClose}>×</button>
        </header>
        <div className="ai-conversation" aria-live="polite">
          <div className="ai-active-context"><b>active context</b><span>{contextNote}</span></div>
          {history.map((message, index) => (
            <article key={`${message.role}-${index}`} className={message.role}>
              <b>{message.role === "user" ? "you" : "chartize ai"}</b>
              <p>{message.text}</p>
            </article>
          ))}
          {busy && <p className="ai-thinking">thinking…</p>}
        </div>
        <div className="ai-compose-area">
          {status && <p className="ai-status">{status}</p>}
          <div className="ai-composer">
            <textarea
              ref={inputRef}
              id={`chartize-ai-${context}`}
              name={`chartize-ai-${context}`}
              autoFocus
              value={prompt}
              placeholder={copy.placeholder}
              onChange={(event) => onPrompt(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && (event.metaKey || event.ctrlKey) && prompt.trim()) onAsk("generate");
              }}
            />
            <div className="ai-composer-footer">
              <div className="ai-composer-tools">
                <div className="ai-actions">
                  <button type="button" disabled={busy} onClick={() => onAsk("explain")}>{copy.explain}</button>
                </div>
                <label className="checkbox-row"><input name="include-preview-rows" type="checkbox" checked={includeSamples} onChange={(event) => onIncludeSamples(event.target.checked)} /> include 20 rows</label>
              </div>
              <div className="ai-send-cluster">
                <span>⌘↵</span>
                <button className="ai-send-button" type="button" disabled={busy || !prompt.trim()} onClick={() => onAsk("generate")}><span aria-hidden="true">✦</span>{copy.primary}</button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>,
    document.body,
  );
}

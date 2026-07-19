"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { AiContext, AiConversationMessage, AiPlacement, AiResponsePreferences } from "@/lib/workspace/store";

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
  preferences: AiResponsePreferences;
  leftPaneRatio: number;
  onClose: () => void;
  onPrompt: (value: string) => void;
  onIncludeSamples: (value: boolean) => void;
  onPreferences: (value: AiResponsePreferences) => void;
  onAsk: (task: "generate" | "repair" | "explain") => void;
}

const contextCopy: Record<AiContext, {
  mode: string;
  placeholder: string;
}> = {
  code: {
    mode: "code at cursor",
    placeholder: "Ask about this GGSQL or describe a code change…",
  },
  chart: {
    mode: "chart selection",
    placeholder: "What do you want to understand about this selection?",
  },
  general: {
    mode: "workspace",
    placeholder: "What question do you want to answer with data?",
  },
};

function inlineMessage(text: string): ReactNode[] {
  return text.split(/(\[[^\]]+\]\(https?:\/\/[^)]+\)|\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean).map((part, index) => {
    const link = /^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/.exec(part);
    if (link) return <a key={index} href={link[2]} target="_blank" rel="noreferrer">{link[1]}</a>;
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={index}>{part.slice(1, -1)}</code>;
    }
    return part;
  });
}

function MessageBody({ text }: { text: string }) {
  return (
    <div className="ai-message-body">
      {text.split(/\n{2,}/).filter(Boolean).map((paragraph, index) => (
        <p key={index}>{inlineMessage(paragraph)}</p>
      ))}
    </div>
  );
}

function RoleIcon({ role }: { role: AiConversationMessage["role"] }) {
  return (
    <span className={`ai-role-icon ${role}`} aria-hidden="true">
      {role === "user" ? (
        <svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.25" /><path d="M5.75 19.5c.55-4 2.65-6 6.25-6s5.7 2 6.25 6" /></svg>
      ) : (
        <svg viewBox="0 0 24 24"><path d="M12 2.75c.55 5.65 3.6 8.7 9.25 9.25-5.65.55-8.7 3.6-9.25 9.25C11.45 15.6 8.4 12.55 2.75 12 8.4 11.45 11.45 8.4 12 2.75Z" /></svg>
      )}
    </span>
  );
}

export function AiAssistant({
  context,
  placement,
  contextNote,
  prompt,
  busy,
  status,
  history,
  includeSamples,
  preferences,
  leftPaneRatio,
  onClose,
  onPrompt,
  onIncludeSamples,
  onPreferences,
  onAsk,
}: AiAssistantProps) {
  const copy = contextCopy[context];
  const placeholder = context === "chart" && /selected|selection|range|point/i.test(contextNote)
    ? /map|region|county|state|feature/i.test(contextNote)
      ? "Ask about the selected places or compare them…"
      : "Ask what changed in this selected range, or why…"
    : copy.placeholder;
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const focusFrame = requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(inputRef.current.value.length, inputRef.current.value.length);
    });
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      const openMenu = document.querySelector<HTMLDetailsElement>(".ai-overlay details[data-dismiss-on-outside][open]");
      if (openMenu) {
        openMenu.removeAttribute("open");
        event.preventDefault();
        return;
      }
      onClose();
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
          <div className="ai-title-lockup">
            <span className="ai-spark" aria-hidden="true">ai</span>
            <div><h2>chartize ai</h2><small>{copy.mode}</small></div>
          </div>
          <button type="button" title="Close" aria-label="Close AI conversation" onClick={onClose}>×</button>
        </header>
        <div className="ai-conversation" aria-live="polite">
          <div className="ai-active-context">
            <span className="ai-context-index">01</span>
            <div><b>active context</b><span>{contextNote}</span></div>
          </div>
          {history.map((message, index) => (
            <article key={`${message.role}-${index}`} className={message.role}>
              <RoleIcon role={message.role} />
              <b>{message.role === "user" ? "you" : "chartize ai"}</b>
              <MessageBody text={message.text} />
            </article>
          ))}
          {busy && <p className="ai-thinking">thinking…</p>}
        </div>
        <div className="ai-compose-area">
          {status && <p className="ai-status">{status}</p>}
          <div className="ai-composer">
            <header className="ai-composer-heading"><span>02</span><b>ask or direct</b><small>⌘↵</small></header>
            <textarea
              ref={inputRef}
              id={`chartize-ai-${context}`}
              name={`chartize-ai-${context}`}
              autoFocus
              value={prompt}
              placeholder={placeholder}
              onChange={(event) => onPrompt(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && (event.metaKey || event.ctrlKey) && prompt.trim() && !busy) {
                  event.preventDefault();
                  onAsk("generate");
                }
              }}
            />
            <div className="ai-composer-footer">
              <div className="ai-composer-tools">
                {includeSamples && preferences.hypothesize && <span className="ai-research-ready"><i aria-hidden="true" />live research</span>}
              </div>
              <div className="ai-send-cluster">
                <details className="ai-settings" data-dismiss-on-outside>
                  <summary title="Response settings" aria-label="Response settings">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.7 3.1 10.3 2h3.4l.6 1.1 1.5.6 1.2-.4 2.4 2.4-.4 1.2.6 1.5 1.1.6v3.4l-1.1.6-.6 1.5.4 1.2-2.4 2.4-1.2-.4-1.5.6-.6 1.1h-3.4l-.6-1.1-1.5-.6-1.2.4-2.4-2.4.4-1.2-.6-1.5-1.1-.6V9l1.1-.6.6-1.5-.4-1.2L7 3.3l1.2.4 1.5-.6Z" /><circle cx="12" cy="11.7" r="3" /></svg>
                  </summary>
                  <div>
                    <header><i>03</i><span><b>response profile</b><small>tune this conversation</small></span></header>
                    <label><input name="ai-hypothesize" type="checkbox" checked={preferences.hypothesize} onChange={(event) => onPreferences({ ...preferences, hypothesize: event.target.checked })} /><span><b>offer hypotheses</b><small>use clearly labeled historical or outside context</small></span></label>
                    <label><input name="ai-concise" type="checkbox" checked={preferences.concise} onChange={(event) => onPreferences({ ...preferences, concise: event.target.checked })} /><span><b>keep it concise</b><small>lead with the answer and trim repeated caveats</small></span></label>
                    <label><input name="ai-challenge" type="checkbox" checked={preferences.challenge} onChange={(event) => onPreferences({ ...preferences, challenge: event.target.checked })} /><span><b>challenge my framing</b><small>surface weak assumptions and alternative readings</small></span></label>
                    <label><input name="ai-technical" type="checkbox" checked={preferences.technical} onChange={(event) => onPreferences({ ...preferences, technical: event.target.checked })} /><span><b>show technical detail</b><small>include methodology and GGSQL mechanics</small></span></label>
                    <label className="ai-data-setting"><input name="include-preview-rows" type="checkbox" checked={includeSamples} onChange={(event) => onIncludeSamples(event.target.checked)} /><span><b>send selected data</b><small>share column names and up to 20 selected or preview rows</small></span></label>
                  </div>
                </details>
                <button className="ai-send-button" type="button" disabled={busy || !prompt.trim()} onClick={() => onAsk("generate")}>send<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10h11m-4-4 4 4-4 4" /></svg></button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>,
    document.body,
  );
}

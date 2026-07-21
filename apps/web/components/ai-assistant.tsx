"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { AiContext, AiConversationMessage, AiPlacement, AiResponsePreferences } from "@/lib/workspace/store";
import { AttachmentIcon, DATA_FILE_ACCEPT, filesFromDrop } from "./data-upload-control";

export type { AiConversationMessage } from "@/lib/workspace/store";

interface AiAssistantProps {
  context: AiContext;
  placement: AiPlacement;
  contextNote: string;
  prompt: string;
  busy: boolean;
  ready: boolean;
  status: string;
  history: AiConversationMessage[];
  focusVersion: number;
  includeSamples: boolean;
  preferences: AiResponsePreferences;
  leftPaneRatio: number;
  onClose: () => void;
  onPrompt: (value: string) => void;
  onIncludeSamples: (value: boolean) => void;
  onPreferences: (value: AiResponsePreferences) => void;
  onFiles: (files: File[]) => Promise<void> | void;
  onAsk: (task: "generate" | "repair" | "explain", request?: string) => void;
  onRetry: (assistantMessageIndex: number) => void;
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

function MessageBody({ text }: { text: string }) {
  return (
    <div className="ai-message-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        components={{
          a: ({ children, ...props }) => <a {...props} target="_blank" rel="noreferrer">{children}</a>,
        }}
      >{text}</ReactMarkdown>
    </div>
  );
}

function ThinkingElapsed() {
  const [elapsedMs, setElapsedMs] = useState(0);
  useEffect(() => {
    const startedAt = performance.now();
    const update = () => setElapsedMs(Math.round(performance.now() - startedAt));
    update();
    const timer = window.setInterval(update, 31);
    return () => window.clearInterval(timer);
  }, []);
  return (
    <time className="ai-thinking-elapsed" dateTime={`PT${elapsedMs / 1000}S`} aria-hidden="true">
      {(elapsedMs / 1000).toFixed(3)} s
    </time>
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
  ready,
  status,
  history,
  focusVersion,
  includeSamples,
  preferences,
  leftPaneRatio,
  onClose,
  onPrompt,
  onIncludeSamples,
  onPreferences,
  onFiles,
  onAsk,
  onRetry,
}: AiAssistantProps) {
  const copy = contextCopy[context];
  const placeholder = context === "chart" && /selected|selection|range|point/i.test(contextNote)
    ? /map|region|county|state|feature/i.test(contextNote)
      ? "Ask about the selected places or compare them…"
      : /visual item|data item|data point|bar/i.test(contextNote)
        ? "Ask about this selected data point…"
        : "Ask what changed in this selected range, or why…"
    : copy.placeholder;
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const conversationRef = useRef<HTMLDivElement>(null);
  const conversationEndRef = useRef<HTMLDivElement>(null);
  const [composerMode, setComposerMode] = useState<"write" | "preview">("write");
  const [fileDropActive, setFileDropActive] = useState(false);

  const scrollToLatest = useCallback((behavior: ScrollBehavior = "smooth") => {
    const conversation = conversationRef.current;
    if (!conversation) return;
    conversation.scrollTo({ top: conversation.scrollHeight, behavior });
  }, []);

  // Start a reopened conversation at its latest message before the overlay
  // paints, instead of visibly animating through the saved transcript.
  useLayoutEffect(() => {
    const conversation = conversationRef.current;
    if (conversation) conversation.scrollTop = conversation.scrollHeight;
  }, []);

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
  }, [context, contextNote, focusVersion, onClose]);

  useEffect(() => {
    setComposerMode("write");
    const frame = requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(inputRef.current.value.length, inputRef.current.value.length);
      scrollToLatest("auto");
    });
    return () => cancelAnimationFrame(frame);
  }, [focusVersion, scrollToLatest]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => scrollToLatest(history.length || busy ? "smooth" : "auto"));
    return () => cancelAnimationFrame(frame);
  }, [busy, history.length, scrollToLatest, status]);

  useEffect(() => {
    if (prompt) return;
    setComposerMode("write");
  }, [prompt]);

  useEffect(() => {
    if (composerMode !== "write") return;
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [composerMode]);

  const submit = () => {
    if (busy || !prompt.trim() || !ready) return;
    scrollToLatest("smooth");
    onAsk("generate", prompt);
  };

  return createPortal(
    <div
      className={`ai-overlay context-${context} placement-${placement}`}
      style={{ "--ai-left-width": `${leftPaneRatio * 100}vw` } as CSSProperties}
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
      onDragEnter={(event) => { if (event.dataTransfer.types.includes("Files")) { event.preventDefault(); setFileDropActive(true); } }}
      onDragOver={(event) => { if (event.dataTransfer.types.includes("Files")) { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; } }}
      onDragLeave={(event) => { if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) setFileDropActive(false); }}
      onDrop={(event) => { event.preventDefault(); setFileDropActive(false); void onFiles(filesFromDrop(event)); }}
    >
      <section className="ai-surface" role="dialog" aria-label="Chartize AI conversation">
        {fileDropActive && <div className="ai-file-drop-overlay"><AttachmentIcon /><b>drop data into this conversation</b><small>chartize will open the raw table and help you profile it</small></div>}
        <header className="ai-surface-header">
          <div className="ai-title-lockup">
            <span className="ai-spark" aria-hidden="true">ai</span>
            <div><h2>chartize ai</h2><small>{copy.mode}</small></div>
          </div>
          <button type="button" title="Close" aria-label="Close AI conversation" onClick={onClose}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </header>
        <div ref={conversationRef} className="ai-conversation" aria-live="polite">
          {history.map((message, index) => (
            <article key={`${message.role}-${index}`} className={message.role}>
              <RoleIcon role={message.role} />
              <b>{message.role === "user" ? "you" : "chartize ai"}</b>
              <MessageBody text={message.text} />
              {message.role === "assistant" && (
                <button
                  type="button"
                  className="ai-message-redo"
                  title="Redo from the preceding prompt"
                  aria-label="Redo this response from the preceding prompt"
                  onClick={() => onRetry(index)}
                  disabled={busy}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 7H4V3M4.6 7A8 8 0 0 1 18.8 5.2M16 17h4v4m-.6-4A8 8 0 0 1 5.2 18.8" /></svg>
                  redo
                </button>
              )}
            </article>
          ))}
          {busy && (
            <div className="ai-thinking" role="status">
              <RoleIcon role="assistant" />
              <span className="ai-thinking-dots"><i /><i /><i /></span>
              <b>{status || "thinking through the request…"}</b>
              <ThinkingElapsed />
            </div>
          )}
          <div ref={conversationEndRef} className="ai-conversation-end" />
        </div>
        <div className="ai-compose-area">
          {status && !busy && <p className="ai-status">{status}</p>}
          <div key={contextNote} className="ai-active-context">
            <span className="ai-context-index">01</span>
            <div><b>active context</b><span>{contextNote}</span></div>
          </div>
          <div className="ai-composer">
            <header className="ai-composer-heading">
              <span>02</span><b>ask or direct</b>
              <div className="ai-composer-mode" role="group" aria-label="Composer display">
                <button type="button" className={composerMode === "write" ? "active" : ""} onClick={() => setComposerMode("write")}>write</button>
                <button type="button" className={composerMode === "preview" ? "active" : ""} disabled={!prompt.trim()} onClick={() => setComposerMode("preview")}>preview</button>
              </div>
            </header>
            {composerMode === "write" ? (
              <textarea
                ref={inputRef}
                id={`chartize-ai-${context}`}
                name={`chartize-ai-${context}`}
                autoFocus
                value={prompt}
                placeholder={placeholder}
                onChange={(event) => onPrompt(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey && event.currentTarget.value.trim() && !busy && ready) {
                    event.preventDefault();
                    submit();
                  }
                }}
              />
            ) : (
              <div className="ai-composer-preview" aria-label="Markdown preview">
                <MessageBody text={prompt} />
              </div>
            )}
            <div className="ai-composer-footer">
              <div className="ai-composer-tools">
                <label className="ai-attach-data" title="Attach browser-local data">
                  <AttachmentIcon /><span>attach data</span>
                  <input name="chartize-conversation-data-files" aria-label="Attach data files to this conversation" type="file" multiple accept={DATA_FILE_ACCEPT} onChange={(event) => { void onFiles(Array.from(event.target.files ?? [])); event.currentTarget.value = ""; }} />
                </label>
                {!ready && <span className="ai-catalog-loading">loading data catalog…</span>}
              </div>
              <div className="ai-send-cluster">
                <div className="ai-settings-cluster">
                  <div className="ai-active-options" aria-label="Active response options">
                    <span title="Grounded in the active Chartize workspace" aria-label="Workspace grounding is active">
                      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 12.5 10.2 16 17 8.5" /><path d="M4 4h16v16H4z" /></svg>
                    </span>
                    {preferences.webSearch && <span title="Live web search and source grounding" aria-label="Web search is active">
                      <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" /><path d="M3.5 12h17M12 3.5c2.2 2.4 3.3 5.2 3.3 8.5S14.2 18.1 12 20.5C9.8 18.1 8.7 15.3 8.7 12S9.8 5.9 12 3.5Z" /></svg>
                    </span>}
                    {preferences.dataAccess && <span title="Browser data access" aria-label="Browser data access is active">
                      <svg viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="12" cy="6" rx="7.5" ry="3" /><path d="M4.5 6v6c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3V6M4.5 12v6c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-6" /></svg>
                    </span>}
                    {preferences.hypothesize && <span title="Helpful hypotheses" aria-label="Hypotheses are active">
                      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18h6M10 21h4M8.2 14.5A6 6 0 1 1 15.8 14.5c-.9.7-1.3 1.4-1.3 2.5h-5c0-1.1-.4-1.8-1.3-2.5Z" /></svg>
                    </span>}
                    {includeSamples && <span title="Selected rows attached" aria-label="Selected rows are attached">
                      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v14H4zM4 10h16M9 5v14" /></svg>
                    </span>}
                  </div>
                  <details className="ai-settings" data-dismiss-on-outside>
                  <summary title="Response settings" aria-label="Response settings">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12.2 2h-.4a2 2 0 0 0-2 2v.2a2 2 0 0 1-1 1.7l-.4.3a2 2 0 0 1-2 0l-.2-.1a2 2 0 0 0-2.7.7l-.2.4A2 2 0 0 0 4 9.9l.2.1a2 2 0 0 1 1 1.7v.6a2 2 0 0 1-1 1.7l-.2.1a2 2 0 0 0-.7 2.7l.2.4a2 2 0 0 0 2.7.7l.2-.1a2 2 0 0 1 2 0l.4.3a2 2 0 0 1 1 1.7v.2a2 2 0 0 0 2 2h.4a2 2 0 0 0 2-2v-.2a2 2 0 0 1 1-1.7l.4-.3a2 2 0 0 1 2 0l.2.1a2 2 0 0 0 2.7-.7l.2-.4a2 2 0 0 0-.7-2.7l-.2-.1a2 2 0 0 1-1-1.7v-.6a2 2 0 0 1 1-1.7l.2-.1a2 2 0 0 0 .7-2.7l-.2-.4a2 2 0 0 0-2.7-.7l-.2.1a2 2 0 0 1-2 0l-.4-.3a2 2 0 0 1-1-1.7V4a2 2 0 0 0-2-2Z" /><circle cx="12" cy="12" r="3" /></svg>
                  </summary>
                  <div>
                    <header><i>03</i><span><b>response profile</b><small>tune this conversation</small></span></header>
                    <label><input name="ai-hypothesize" type="checkbox" checked={preferences.hypothesize} onChange={(event) => onPreferences({ ...preferences, hypothesize: event.target.checked })} /><span><b>offer hypotheses</b><small>use clearly labeled historical or outside context</small></span></label>
                    <label><input name="ai-web-search" type="checkbox" checked={preferences.webSearch} onChange={(event) => onPreferences({ ...preferences, webSearch: event.target.checked })} /><span><b>search and ground</b><small>look up causal, historical, and current questions on the live web</small></span></label>
                    <label><input name="ai-data-access" type="checkbox" checked={preferences.dataAccess} onChange={(event) => onPreferences({ ...preferences, dataAccess: event.target.checked })} /><span><b>use workspace data</b><small>let the assistant query sources cached in this browser</small></span></label>
                    <label><input name="ai-concise" type="checkbox" checked={preferences.concise} onChange={(event) => onPreferences({ ...preferences, concise: event.target.checked })} /><span><b>keep it concise</b><small>lead with the answer and trim repeated caveats</small></span></label>
                    <label><input name="ai-challenge" type="checkbox" checked={preferences.challenge} onChange={(event) => onPreferences({ ...preferences, challenge: event.target.checked })} /><span><b>challenge my framing</b><small>surface weak assumptions and alternative readings</small></span></label>
                    <label><input name="ai-technical" type="checkbox" checked={preferences.technical} onChange={(event) => onPreferences({ ...preferences, technical: event.target.checked })} /><span><b>show technical detail</b><small>include methodology and GGSQL mechanics</small></span></label>
                    <label className="ai-data-setting"><input name="include-preview-rows" type="checkbox" checked={includeSamples} onChange={(event) => onIncludeSamples(event.target.checked)} /><span><b>send selected data</b><small>share column names and up to 20 selected or preview rows</small></span></label>
                  </div>
                  </details>
                </div>
                <button className="ai-send-button" type="button" title="Send (Enter) · new line (Shift+Enter)" disabled={busy || !prompt.trim() || !ready} onClick={submit}>send<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10h11m-4-4 4 4-4 4" /></svg></button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>,
    document.body,
  );
}

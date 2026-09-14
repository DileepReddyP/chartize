"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { AiApprovalRequest } from "@chartize/contracts";
import { AiResponseControls, AiApproach } from "./ai-response-controls";
import { AiLogin } from "./ai-login";
import { useProfile } from "./profile-provider";
import type { AiContext, AiConversationMessage, AiPlacement, AiResponsePreferences } from "@/lib/workspace/store";
import { AttachmentIcon, DATA_FILE_ACCEPT, filesFromDrop } from "./data-upload-control";
import { PopupCloseButton } from "./popup-close-button";

export type { AiConversationMessage } from "@/lib/workspace/store";

interface AiAssistantProps {
  context: AiContext;
  placement: AiPlacement;
  contextNote: string;
  hasSelection: boolean;
  prompt: string;
  busy: boolean;
  ready: boolean;
  status: string;
  history: AiConversationMessage[];
  focusVersion: number;
  preferences: AiResponsePreferences;
  leftPaneRatio: number;
  onClose: () => void;
  onPrompt: (value: string) => void;
  onPreferences: (value: AiResponsePreferences) => void;
  onFiles: (files: File[]) => Promise<void> | void;
  onAsk: (task: "generate" | "repair" | "explain", request?: string) => void;
  onRetry: (assistantMessageIndex: number, approval?: AiApprovalRequest) => void;
}

const contextCopy: Record<AiContext, {
  mode: string;
  placeholder: string;
  loginTitle: string;
}> = {
  code: {
    mode: "code at cursor",
    placeholder: "Ask about this GGSQL or describe a code change…",
    loginTitle: "log in to work on this query",
  },
  chart: {
    mode: "rendered chart",
    placeholder: "Ask about this chart or describe a change…",
    loginTitle: "log in to discuss this chart",
  },
  data: {
    mode: "data table",
    placeholder: "Ask about this table, its fields, or exact values…",
    loginTitle: "log in to explore this data",
  },
  general: {
    mode: "workspace",
    placeholder: "What question do you want to answer with data?",
    loginTitle: "log in to use chartize ai",
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
  hasSelection,
  prompt,
  busy,
  ready,
  status,
  history,
  focusVersion,
  preferences,
  leftPaneRatio,
  onClose,
  onPrompt,
  onPreferences,
  onFiles,
  onAsk,
  onRetry,
}: AiAssistantProps) {
  const auth = useProfile();
  useEffect(() => { if (status.includes("Sign in to use Chartize AI") || status.includes("Your profile changed")) void auth.refresh(); }, [status, auth.refresh]);
  const copy = contextCopy[context];
  const hasChartSelection = context === "chart" && hasSelection;
  const hasDataSelection = context === "data" && hasSelection;
  const mode = hasChartSelection ? "chart selection" : hasDataSelection ? "data selection" : copy.mode;
  const placeholder = hasChartSelection
    ? /map|region|county|state|feature/i.test(contextNote)
      ? "Ask about the selected places or compare them…"
      : /visual item|data item|data point|bar/i.test(contextNote)
        ? "Ask about this selected data point…"
        : "Ask what changed in this selected range, or why…"
    : hasDataSelection
      ? "Ask about these rows, columns, or values…"
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
    if (busy || !prompt.trim() || !ready || !auth.user || !auth.ready) return;
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
            <div><h2>chartize ai</h2><small>{mode}</small></div>
          </div>
          <PopupCloseButton onClick={onClose} label="Close AI conversation" />
        </header>
        <div ref={conversationRef} className="ai-conversation" aria-live="polite">
          {history.map((message, index) => (
            <article key={`${message.role}-${index}`} className={message.role}>
              <RoleIcon role={message.role} />
              <b>{message.role === "user" ? "you" : "chartize ai"}</b>
              <MessageBody text={message.text} />
              {message.plan && <AiApproach plan={message.plan} />}
              {message.role === "assistant" && (
                <div className="ai-message-actions">
                  <button
                    type="button"
                    className="ai-message-redo"
                    title="Redo from the preceding prompt"
                    aria-label="Redo this response from the preceding prompt"
                    onClick={() => onRetry(index)}
                    disabled={busy || !auth.user || !auth.ready}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 7H4V3M4.6 7A8 8 0 0 1 18.8 5.2M16 17h4v4m-.6-4A8 8 0 0 1 5.2 18.8" /></svg>
                    redo
                  </button>
                  {message.approval && (
                    <button className="ai-approve-button" type="button" disabled={busy || !auth.user || !auth.ready} onClick={() => onRetry(index, message.approval)}>
                      {message.approval === "local_changes" ? "apply local changes once" : message.approval === "selected_data" ? "share these rows once" : message.approval === "workspace_data" ? "inspect data once" : "search the web once"}
                    </button>
                  )}
                </div>
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
        <div className="ai-compose-area" inert={!auth.user}>
          {status && !busy && <p className="ai-status">{status}</p>}
          <div key={contextNote} className="ai-active-context">
            <span className="ai-context-index">01</span>
            <div><b>active context</b><span>{contextNote}</span></div>
          </div>
          <p className="ai-data-note">chartize chooses tools as needed · relevant data may be sent to the ai to answer your question</p>
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
                <AiResponseControls preferences={preferences} onPreferences={onPreferences} />
                <button className="ai-send-button" type="button" title={auth.user ? "Send (Enter) · new line (Shift+Enter)" : "Sign in to chat"} disabled={busy || !prompt.trim() || !ready || !auth.user || !auth.ready} onClick={submit}>send<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10h11m-4-4 4 4-4 4" /></svg></button>
              </div>
            </div>
          </div>
        </div>
        {!auth.user && <><div className="ai-login-backdrop" aria-hidden="true" /><AiLogin title={hasChartSelection || hasDataSelection ? "log in to discuss this selection" : copy.loginTitle} /></>}
      </section>
    </div>,
    document.body,
  );
}

"use client";

import { useEffect, useState } from "react";

function ThinkingElapsed() {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const started = performance.now();
    const timer = window.setInterval(() => setElapsed((performance.now() - started) / 1000), 100);
    return () => window.clearInterval(timer);
  }, []);
  return <time className="ai-thinking-elapsed" dateTime={`PT${elapsed.toFixed(1)}S`} aria-hidden="true">{elapsed.toFixed(1)} s</time>;
}

/** Displays the current operation and recent tool activity for the active turn. */
export function AiThinking({ status, progress }: { status: string; progress: string[] }) {
  const message = status || "thinking…";
  const separator = message.indexOf(": ");
  const label = separator < 0 ? message : message.slice(0, separator);
  const detail = separator < 0 ? "" : message.slice(separator + 2);
  const recent = progress.filter((step) => step !== message).slice(-3);
  return (
    <div className="ai-thinking" role="status" aria-label="Chartize AI activity">
      <span className="ai-thinking-bars" aria-hidden="true"><i /><i /><i /><i /></span>
      <div className="ai-thinking-current" key={message}><b>{label}</b>{detail && <span>{detail}</span>}</div>
      <ThinkingElapsed />
      {recent.length > 0 && <ul className="ai-thinking-steps" aria-label="Recent activity">{recent.map((step, index) => <li key={`${index}-${step}`}>{step}</li>)}</ul>}
      <span className="ai-thinking-track" aria-hidden="true"><i /></span>
    </div>
  );
}

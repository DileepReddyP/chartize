"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";

interface EditableChartLabelProps {
  kind: "title" | "subtitle";
  value: string;
  onCommit: (value: string) => void;
}

export function EditableChartLabel({ kind, value, onCommit }: EditableChartLabelProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [editing, value]);

  useEffect(() => {
    if (!editing) return;
    input.current?.focus();
    input.current?.select();
  }, [editing]);

  const finish = () => {
    if (!editing) return;
    setEditing(false);
    const next = draft.trim();
    if (next !== value) onCommit(next);
  };
  const keyboard = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") event.currentTarget.blur();
    if (event.key === "Escape") {
      setDraft(value);
      setEditing(false);
    }
  };
  const content = editing ? (
    <input
      ref={input}
      className="chart-label-input"
      aria-label={`Edit chart ${kind}`}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={finish}
      onKeyDown={keyboard}
    />
  ) : (
    <button
      className="chart-label-text"
      type="button"
      title={`Double-click to edit chart ${kind}`}
      onDoubleClick={() => setEditing(true)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === "F2") setEditing(true);
      }}
    >{value || (kind === "title" ? "untitled visualization" : "add a subtitle")}</button>
  );

  return kind === "title" ? <h1>{content}</h1> : <p className={!value && !editing ? "empty" : ""}>{content}</p>;
}

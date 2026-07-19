"use client";

import type {
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
  RefObject,
} from "react";

interface PanelResizerProps {
  orientation: "vertical" | "horizontal";
  value: number;
  defaultValue: number;
  containerRef: RefObject<HTMLElement | null>;
  onChange: (ratio: number) => void;
  label: string;
}

export function PanelResizer({ orientation, value, defaultValue, containerRef, onChange, label }: PanelResizerProps) {
  const limits = orientation === "vertical" ? [0.3, 0.7] as const : [0.32, 0.72] as const;
  const clamp = (next: number) => Math.min(limits[1], Math.max(limits[0], next));
  const updateFromPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const bounds = containerRef.current?.getBoundingClientRect();
    if (!bounds) return;
    const next = orientation === "vertical"
      ? (event.clientX - bounds.left) / bounds.width
      : (event.clientY - bounds.top) / bounds.height;
    onChange(clamp(next));
  };
  const finish = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    document.body.classList.remove("resizing-panels");
  };
  const nudge = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const backward = orientation === "vertical" ? event.key === "ArrowLeft" : event.key === "ArrowUp";
    const forward = orientation === "vertical" ? event.key === "ArrowRight" : event.key === "ArrowDown";
    if (!backward && !forward) return;
    event.preventDefault();
    onChange(clamp(value + (backward ? -0.02 : 0.02)));
  };

  return (
    <div
      className={`panel-resizer ${orientation}`}
      role="separator"
      aria-label={label}
      aria-orientation={orientation}
      aria-valuemin={Math.round(limits[0] * 100)}
      aria-valuemax={Math.round(limits[1] * 100)}
      aria-valuenow={Math.round(value * 100)}
      tabIndex={0}
      title="Drag to resize · double-click to reset"
      onDoubleClick={() => onChange(defaultValue)}
      onKeyDown={nudge}
      onPointerDown={(event) => {
        event.preventDefault();
        event.currentTarget.focus();
        event.currentTarget.setPointerCapture(event.pointerId);
        document.body.classList.add("resizing-panels");
      }}
      onPointerMove={updateFromPointer}
      onPointerUp={finish}
      onPointerCancel={finish}
      onLostPointerCapture={() => document.body.classList.remove("resizing-panels")}
    ><span aria-hidden="true" /></div>
  );
}

"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import embed, { type Result as EmbedResult, type VisualizationSpec } from "vega-embed";
import type { MapViewport } from "@/lib/ggsql/geo-fit";
import { presentChartSpec, type ChartThreshold } from "@/lib/ggsql/vega-presentation";

export interface ChartViewHandle {
  toPng: () => Promise<string>;
  toSvg: () => Promise<string>;
  getDomains: () => { x?: [unknown, unknown]; y?: [unknown, unknown] };
}

export interface ChartRegionSelection {
  pixels: { x0: number; y0: number; x1: number; y1: number };
  x?: [unknown, unknown];
  y?: [unknown, unknown];
}

interface ChartViewProps {
  spec: Record<string, unknown> | null;
  onError: (message: string) => void;
  threshold?: ChartThreshold;
  domains?: { x?: [unknown, unknown]; y?: [unknown, unknown] };
  selection?: ChartRegionSelection | null;
  onRegionSelect?: (selection: ChartRegionSelection | null) => void;
  mapMode?: boolean;
  mapViewport?: MapViewport;
  onMapPan?: (horizontal: number, vertical: number) => void;
}

const DEFAULT_MAP_VIEWPORT: MapViewport = { zoom: 1, panX: 0, panY: 0 };

type SelectionPixels = ChartRegionSelection["pixels"];
type ResizeHandle = "nw" | "ne" | "sw" | "se";

function normalizedPixels(pixels: SelectionPixels): SelectionPixels {
  return {
    x0: Math.min(pixels.x0, pixels.x1),
    y0: Math.min(pixels.y0, pixels.y1),
    x1: Math.max(pixels.x0, pixels.x1),
    y1: Math.max(pixels.y0, pixels.y1),
  };
}

export const ChartView = forwardRef<ChartViewHandle, ChartViewProps>(function ChartView({
  spec,
  onError,
  threshold,
  domains,
  selection,
  onRegionSelect,
  mapMode = false,
  mapViewport = DEFAULT_MAP_VIEWPORT,
  onMapPan,
}, ref) {
  const interaction = useRef<HTMLDivElement>(null);
  const element = useRef<HTMLDivElement>(null);
  const result = useRef<EmbedResult | null>(null);
  const [gesture, setGesture] = useState<{ pixels: SelectionPixels; handle?: ResizeHandle } | null>(null);
  const [mapGesture, setMapGesture] = useState<{ start: { x: number; y: number }; current: { x: number; y: number } } | null>(null);

  useImperativeHandle(ref, () => ({
    async toPng() {
      if (!result.current) throw new Error("There is no rendered chart to export.");
      return result.current.view.toImageURL("png", 2);
    },
    async toSvg() {
      if (!result.current) throw new Error("There is no rendered chart to export.");
      return result.current.view.toImageURL("svg");
    },
    getDomains() {
      const read = (name: "x" | "y") => {
        try {
          const scale = result.current?.view.scale(name) as { domain?: () => unknown[] } | undefined;
          const domain = scale?.domain?.();
          return domain?.length === 2 ? [domain[0], domain[1]] as [unknown, unknown] : undefined;
        } catch {
          return undefined;
        }
      };
      const x = read("x");
      const y = read("y");
      return { ...(x ? { x } : {}), ...(y ? { y } : {}) };
    },
  }));

  useEffect(() => {
    if (!element.current) return;
    if (!spec) {
      result.current?.finalize();
      result.current = null;
      element.current.replaceChildren();
      return;
    }
    let cancelled = false;
    const resize = () => {
      if (!element.current || !result.current) return;
      void result.current.view
        .width(element.current.clientWidth)
        .height(element.current.clientHeight)
        .runAsync();
    };
    const observer = new ResizeObserver(() => {
      resize();
    });
    observer.observe(element.current);
    void embed(element.current, presentChartSpec(spec, threshold, domains, mapViewport) as VisualizationSpec, {
      actions: false,
      renderer: "canvas",
      tooltip: true,
      logLevel: 1,
    })
      .then((embedded) => {
        if (cancelled) embedded.finalize();
        else {
          result.current = embedded;
          resize();
        }
      })
      .catch((error: unknown) => onError(error instanceof Error ? error.message : String(error)));
    return () => {
      cancelled = true;
      observer.disconnect();
      result.current?.finalize();
      result.current = null;
    };
  }, [domains, mapViewport, spec, onError, threshold]);

  const point = (event: ReactPointerEvent<HTMLElement>) => {
    const bounds = interaction.current?.getBoundingClientRect();
    if (!bounds) return { x: 0, y: 0 };
    return {
      x: Math.max(0, Math.min(bounds.width, event.clientX - bounds.left)),
      y: Math.max(0, Math.min(bounds.height, event.clientY - bounds.top)),
    };
  };
  const invert = (name: "x" | "y", value: number) => {
    try {
      const scale = result.current?.view.scale(name) as { invert?: (input: number) => unknown } | undefined;
      return scale?.invert?.(value);
    } catch {
      return undefined;
    }
  };
  const resizePixels = (pixels: SelectionPixels, handle: ResizeHandle, next: { x: number; y: number }) => ({
    ...pixels,
    ...(handle.includes("w") ? { x0: next.x } : { x1: next.x }),
    ...(handle.includes("n") ? { y0: next.y } : { y1: next.y }),
  });
  const commitSelection = (pixels: SelectionPixels) => {
    const next = normalizedPixels(pixels);
    if (next.x1 - next.x0 < 5 || next.y1 - next.y0 < 5) return;
    const xValues = [invert("x", next.x0), invert("x", next.x1)] as [unknown, unknown];
    const yValues = [invert("y", next.y1), invert("y", next.y0)] as [unknown, unknown];
    onRegionSelect?.({
      pixels: next,
      ...(xValues.every((value) => value !== undefined) ? { x: xValues } : {}),
      ...(yValues.every((value) => value !== undefined) ? { y: yValues } : {}),
    });
  };
  const startSelection = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !spec) return;
    const { x, y } = point(event);
    // Pointer capture is unavailable for synthetic events and a few embedded
    // browser surfaces. Selection still works there as long as the pointer
    // remains over the chart, so do not let capture support abort the gesture.
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* optional enhancement */ }
    if (mapMode && !event.shiftKey) {
      setMapGesture({ start: { x, y }, current: { x, y } });
      return;
    }
    setGesture({ pixels: { x0: x, y0: y, x1: x, y1: y } });
  };
  const moveSelection = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!gesture || gesture.handle) return;
    const { x, y } = point(event);
    setGesture((current) => current ? { ...current, pixels: { ...current.pixels, x1: x, y1: y } } : current);
  };
  const finishSelection = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!gesture || gesture.handle) return;
    const { x, y } = point(event);
    const next = { ...gesture.pixels, x1: x, y1: y };
    setGesture(null);
    commitSelection(next);
  };
  const startResize = (handle: ResizeHandle, event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0 || !selection) return;
    event.stopPropagation();
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* optional enhancement */ }
    setGesture({ pixels: normalizedPixels(selection.pixels), handle });
  };
  const moveResize = (event: ReactPointerEvent<HTMLElement>) => {
    setGesture((current) => current?.handle
      ? { ...current, pixels: resizePixels(current.pixels, current.handle, point(event)) }
      : current);
  };
  const finishResize = (event: ReactPointerEvent<HTMLElement>) => {
    if (!gesture?.handle) return;
    const next = resizePixels(gesture.pixels, gesture.handle, point(event));
    setGesture(null);
    commitSelection(next);
  };
  const moveGesture = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (mapGesture) {
      setMapGesture((current) => current ? { ...current, current: point(event) } : current);
      return;
    }
    if (gesture?.handle) moveResize(event);
    else moveSelection(event);
  };
  const finishGesture = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (mapGesture) {
      const current = point(event);
      const bounds = interaction.current?.getBoundingClientRect();
      const horizontal = bounds?.width ? -(current.x - mapGesture.start.x) / bounds.width : 0;
      const vertical = bounds?.height ? (current.y - mapGesture.start.y) / bounds.height : 0;
      setMapGesture(null);
      if (Math.abs(horizontal) > 0.003 || Math.abs(vertical) > 0.003) onMapPan?.(horizontal, vertical);
      return;
    }
    if (gesture?.handle) finishResize(event);
    else finishSelection(event);
  };

  if (!spec) {
    return (
      <div className="empty-chart">
        <div><b>Ask a question of the data.</b>Select a dataset, build a view, or write GGSQL below.</div>
      </div>
    );
  }

  return (
    <div
      ref={interaction}
      className={`chart-interaction ${mapMode ? "map-interaction" : ""}`}
      tabIndex={0}
      aria-label={mapMode ? "Map. Drag to pan; hold Shift and drag to select a region." : "Chart. Drag to select a region; resize a selection with its corner handles."}
      onKeyDown={(event) => { if (event.key === "Escape") { setGesture(null); setMapGesture(null); onRegionSelect?.(null); } }}
      onPointerDown={startSelection}
      onPointerMove={moveGesture}
      onPointerUp={finishGesture}
      onPointerCancel={() => { setGesture(null); setMapGesture(null); }}
    >
      <div
        className="chart-embed"
        ref={element}
        style={mapGesture ? { transform: `translate(${mapGesture.current.x - mapGesture.start.x}px, ${mapGesture.current.y - mapGesture.start.y}px)` } : undefined}
      />
      {(gesture?.pixels ?? selection?.pixels) && (() => {
        const pixels = normalizedPixels((gesture?.pixels ?? selection?.pixels)!);
        const persistent = Boolean(selection && (!gesture || gesture.handle));
        return (
        <span
          className={`chart-brush ${persistent ? "persistent" : "draft"}`}
          style={{ left: pixels.x0, top: pixels.y0, width: pixels.x1 - pixels.x0, height: pixels.y1 - pixels.y0 }}
        >
          {persistent && (["nw", "ne", "sw", "se"] as const).map((handle) => (
            <button
              key={handle}
              className={`chart-brush-handle ${handle}`}
              type="button"
              aria-label={`Resize selection from ${handle} corner`}
              onPointerDown={(event) => startResize(handle, event)}
              onPointerCancel={() => setGesture(null)}
            />
          ))}
        </span>
        );
      })()}
    </div>
  );
});

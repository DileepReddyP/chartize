"use client";

import { forwardRef, useEffect, useImperativeHandle, useReducer, useRef, type CSSProperties, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from "react";
import embed, { type Result as EmbedResult, type VisualizationSpec } from "vega-embed";
import type { TablePreview } from "@chartize/contracts";
import type { MapViewport } from "@/lib/ggsql/geo-fit";
import { pngWithHeader, svgWithHeader } from "@/lib/ggsql/chart-export";
import { presentChartSpec, type ChartLegendTitles, type ChartThreshold } from "@/lib/ggsql/vega-presentation";
import { mapFeatureSelectionFromDatum, type MapFeatureSelection } from "@/lib/workspace/chart-data";

export interface ChartViewHandle {
  toPng: (includeHeader?: boolean) => Promise<string>;
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
  exportTitle?: string;
  exportSubtitle?: string;
  onError: (message: string) => void;
  threshold?: ChartThreshold;
  domains?: { x?: [unknown, unknown]; y?: [unknown, unknown] };
  legendTitles?: ChartLegendTitles;
  selection?: ChartRegionSelection | null;
  onRegionSelect?: (selection: ChartRegionSelection | null) => void;
  mapMode?: boolean;
  mapViewport?: MapViewport;
  onMapPan?: (horizontal: number, vertical: number) => void;
  onMapZoom?: (factor: number) => void;
  onChartZoom?: (factor: number) => void;
  onChartPan?: (horizontal: number, vertical: number) => void;
  mapFeatureSelections?: MapFeatureSelection[];
  onMapFeatureSelect?: (selection: MapFeatureSelection | null, additive?: boolean) => void;
  onAskMapFeature?: (origin: HTMLElement) => void;
  mapFeatureAiActive?: boolean;
  featureData?: Pick<TablePreview, "columns" | "rows">;
}

const DEFAULT_MAP_VIEWPORT: MapViewport = { zoom: 1, panX: 0, panY: 0 };

type SelectionPixels = ChartRegionSelection["pixels"];
type ResizeHandle = "nw" | "ne" | "sw" | "se";
type ChartInteraction =
  | { kind: "idle" }
  | { kind: "selection"; pixels: SelectionPixels }
  | { kind: "resize"; pixels: SelectionPixels; handle: ResizeHandle }
  | { kind: "map"; start: { x: number; y: number }; current: { x: number; y: number } };

function interactionReducer(_state: ChartInteraction, next: ChartInteraction) {
  return next;
}

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
  exportTitle = "",
  exportSubtitle = "",
  onError,
  threshold,
  domains,
  legendTitles,
  selection,
  onRegionSelect,
  mapMode = false,
  mapViewport = DEFAULT_MAP_VIEWPORT,
  onMapPan,
  onMapZoom,
  onChartZoom,
  onChartPan,
  mapFeatureSelections = [],
  onMapFeatureSelect,
  onAskMapFeature,
  mapFeatureAiActive = false,
  featureData,
}, ref) {
  const interaction = useRef<HTMLDivElement>(null);
  const element = useRef<HTMLDivElement>(null);
  const result = useRef<EmbedResult | null>(null);
  const [interactionState, setInteractionState] = useReducer(interactionReducer, { kind: "idle" });
  const gesture = interactionState.kind === "selection"
    ? { pixels: interactionState.pixels }
    : interactionState.kind === "resize"
      ? { pixels: interactionState.pixels, handle: interactionState.handle }
      : null;
  const mapGesture = interactionState.kind === "map" ? interactionState : null;
  const wheelFrame = useRef<number | null>(null);
  const wheelIntent = useRef({ x: 0, y: 0, pinch: false, shift: false });
  const suppressFeatureClick = useRef(false);
  const mapFeatureSelectRef = useRef(onMapFeatureSelect);

  useEffect(() => { mapFeatureSelectRef.current = onMapFeatureSelect; }, [onMapFeatureSelect]);

  useEffect(() => () => {
    if (wheelFrame.current !== null) cancelAnimationFrame(wheelFrame.current);
  }, []);

  useImperativeHandle(ref, () => ({
    async toPng(includeHeader = true) {
      if (!result.current) throw new Error("There is no rendered chart to export.");
      const chartUrl = await result.current.view.toImageURL("png", 2);
      return includeHeader ? pngWithHeader(chartUrl, exportTitle, exportSubtitle) : chartUrl;
    },
    async toSvg() {
      if (!result.current) throw new Error("There is no rendered chart to export.");
      return svgWithHeader(await result.current.view.toImageURL("svg"), exportTitle, exportSubtitle);
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
    let featureView: {
      addEventListener: (type: string, handler: (event: Event, item?: { datum?: unknown }) => void) => void;
      removeEventListener: (type: string, handler: (event: Event, item?: { datum?: unknown }) => void) => void;
    } | null = null;
    let featureListener: ((event: Event, item?: { datum?: unknown }) => void) | null = null;
    void embed(element.current, presentChartSpec(spec, threshold, domains, mapViewport, legendTitles) as VisualizationSpec, {
      actions: false,
      renderer: "canvas",
      tooltip: true,
      logLevel: 1,
    })
      .then((embedded) => {
        if (cancelled) embedded.finalize();
        else {
          result.current = embedded;
          if (mapMode && mapFeatureSelectRef.current) {
            featureView = embedded.view as unknown as typeof featureView;
            featureListener = (event, item) => {
              if (suppressFeatureClick.current) return;
              const bounds = interaction.current?.getBoundingClientRect();
              const pointer = event as MouseEvent;
              if (!bounds || !Number.isFinite(pointer.clientX) || !Number.isFinite(pointer.clientY)) return;
              const nextSelection = mapFeatureSelectionFromDatum(item?.datum, {
                x: Math.max(0, Math.min(bounds.width, pointer.clientX - bounds.left)),
                y: Math.max(0, Math.min(bounds.height, pointer.clientY - bounds.top)),
              }, featureData);
              mapFeatureSelectRef.current?.(nextSelection, pointer.shiftKey);
            };
            featureView?.addEventListener("click", featureListener);
          }
          resize();
        }
      })
      .catch((error: unknown) => onError(error instanceof Error ? error.message : String(error)));
    return () => {
      cancelled = true;
      observer.disconnect();
      if (featureView && featureListener) featureView.removeEventListener("click", featureListener);
      result.current?.finalize();
      result.current = null;
    };
  }, [domains, featureData, legendTitles, mapMode, mapViewport, onError, spec, threshold]);

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
    event.currentTarget.focus({ preventScroll: true });
    const { x, y } = point(event);
    // Pointer capture is unavailable for synthetic events and a few embedded
    // browser surfaces. Selection still works there as long as the pointer
    // remains over the chart, so do not let capture support abort the gesture.
    if (mapMode && !event.shiftKey) {
      setInteractionState({ kind: "map", start: { x, y }, current: { x, y } });
      return;
    }
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* optional enhancement */ }
    setInteractionState({ kind: "selection", pixels: { x0: x, y0: y, x1: x, y1: y } });
  };
  const moveSelection = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!gesture || gesture.handle) return;
    const { x, y } = point(event);
    setInteractionState({ kind: "selection", pixels: { ...gesture.pixels, x1: x, y1: y } });
  };
  const finishSelection = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!gesture || gesture.handle) return;
    const { x, y } = point(event);
    const next = { ...gesture.pixels, x1: x, y1: y };
    setInteractionState({ kind: "idle" });
    commitSelection(next);
  };
  const startResize = (handle: ResizeHandle, event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0 || !selection) return;
    event.stopPropagation();
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* optional enhancement */ }
    setInteractionState({ kind: "resize", pixels: normalizedPixels(selection.pixels), handle });
  };
  const moveResize = (event: ReactPointerEvent<HTMLElement>) => {
    if (gesture?.handle) setInteractionState({ kind: "resize", handle: gesture.handle, pixels: resizePixels(gesture.pixels, gesture.handle, point(event)) });
  };
  const finishResize = (event: ReactPointerEvent<HTMLElement>) => {
    if (!gesture?.handle) return;
    const next = resizePixels(gesture.pixels, gesture.handle, point(event));
    setInteractionState({ kind: "idle" });
    commitSelection(next);
  };
  const moveGesture = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (mapGesture) {
      const currentPoint = point(event);
      if (Math.hypot(currentPoint.x - mapGesture.start.x, currentPoint.y - mapGesture.start.y) > 4) {
        try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* optional enhancement */ }
      }
      setInteractionState({ ...mapGesture, current: currentPoint });
      return;
    }
    if (gesture?.handle) moveResize(event);
    else moveSelection(event);
  };
  const finishGesture = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (mapGesture) {
      const current = point(event);
      const bounds = interaction.current?.getBoundingClientRect();
      const moved = Math.hypot(current.x - mapGesture.start.x, current.y - mapGesture.start.y) > 4;
      const horizontal = bounds?.width ? -(current.x - mapGesture.start.x) / bounds.width : 0;
      const vertical = bounds?.height ? (current.y - mapGesture.start.y) / bounds.height : 0;
      setInteractionState({ kind: "idle" });
      suppressFeatureClick.current = moved;
      if (moved) {
        onMapFeatureSelect?.(null);
        onMapPan?.(horizontal, vertical);
        window.setTimeout(() => { suppressFeatureClick.current = false; }, 0);
      }
      return;
    }
    if (gesture?.handle) finishResize(event);
    else finishSelection(event);
  };
  const wheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    if (!spec) return;
    event.preventDefault();
    interaction.current?.focus({ preventScroll: true });
    wheelIntent.current.x += event.deltaX;
    wheelIntent.current.y += event.deltaY;
    wheelIntent.current.pinch ||= event.ctrlKey;
    wheelIntent.current.shift ||= event.shiftKey;
    if (wheelFrame.current !== null) return;
    wheelFrame.current = requestAnimationFrame(() => {
      wheelFrame.current = null;
      const intent = wheelIntent.current;
      wheelIntent.current = { x: 0, y: 0, pinch: false, shift: false };
      const bounds = interaction.current?.getBoundingClientRect();
      if (!bounds) return;
      if (mapMode) {
        if (intent.pinch) {
          onMapZoom?.(Math.max(.72, Math.min(1.38, Math.exp(-intent.y * .012))));
        } else {
          const horizontal = intent.shift ? intent.y / bounds.width : intent.x / bounds.width;
          onMapPan?.(horizontal, -intent.y / bounds.height);
        }
        return;
      }
      const horizontalIntent = intent.shift || Math.abs(intent.x) > Math.abs(intent.y);
      if (horizontalIntent && !intent.pinch) {
        onChartPan?.((intent.shift ? intent.y : intent.x) / bounds.width, 0);
      } else {
        const sensitivity = intent.pinch ? .012 : .0024;
        onChartZoom?.(Math.max(.72, Math.min(1.38, Math.exp(intent.y * sensitivity))));
      }
    });
  };

  if (!spec) {
    return (
      <div className="empty-chart">
        <div><b>Ask a question of the data.</b>Select a dataset, build a view, or write GGSQL below.</div>
      </div>
    );
  }

  const mapDragging = Boolean(mapGesture && Math.hypot(
    mapGesture.current.x - mapGesture.start.x,
    mapGesture.current.y - mapGesture.start.y,
  ) > 4);
  const activeMapFeature = mapFeatureSelections.at(-1) ?? null;

  return (
    <div
      ref={interaction}
      className={`chart-interaction ${mapMode ? "map-interaction" : ""}${mapDragging ? " is-panning" : ""}`}
      tabIndex={0}
      aria-label={mapMode ? "Map. Drag or scroll to pan, pinch to zoom, and hold Shift while dragging to select a region." : "Chart. Scroll or pinch to zoom, scroll sideways to pan, and drag to select a region."}
      onKeyDown={(event) => { if (event.key === "Escape") { setInteractionState({ kind: "idle" }); onRegionSelect?.(null); onMapFeatureSelect?.(null); } }}
      onPointerDown={startSelection}
      onPointerMove={moveGesture}
      onPointerUp={finishGesture}
      onPointerCancel={() => setInteractionState({ kind: "idle" })}
      onWheel={wheel}
    >
      <div
        className="chart-embed"
        ref={element}
        style={mapDragging && mapGesture ? { transform: `translate(${mapGesture.current.x - mapGesture.start.x}px, ${mapGesture.current.y - mapGesture.start.y}px)` } : undefined}
      />
      {mapMode && activeMapFeature && (
        <>
          {mapFeatureSelections.map((selection) => (
            <span
              key={selection.key}
              className="map-feature-pin"
              aria-hidden="true"
              style={{ left: selection.pixels.x, top: selection.pixels.y }}
            />
          ))}
          <aside
            className="map-feature-inspector"
            aria-label={`${mapFeatureSelections.length} selected ${mapFeatureSelections.length === 1 ? "place" : "places"}`}
            style={{
              "--feature-x": `${activeMapFeature.pixels.x + 14}px`,
              "--feature-y": `${activeMapFeature.pixels.y + 14}px`,
            } as CSSProperties}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <header>
              <div><span>{mapFeatureSelections.length === 1 ? "selected place" : `${mapFeatureSelections.length} selected places`}</span><h2>{activeMapFeature.title}</h2></div>
              <button type="button" aria-label="Close selected place" onClick={() => onMapFeatureSelect?.(null)}>×</button>
            </header>
            <dl>{activeMapFeature.values.map(({ field, value }) => <div key={field}><dt>{field}</dt><dd>{value}</dd></div>)}</dl>
            <p className="map-feature-selection-hint">shift-click another place to add or remove it</p>
            <label className={`map-feature-ask ai-promoter${mapFeatureAiActive ? " active" : ""}`}>
              <span aria-hidden="true">✦</span>
              <input
                name="map-feature-ai-prompt"
                readOnly
                value=""
                placeholder={mapFeatureAiActive ? "This place is attached to Chartize AI" : mapFeatureSelections.length === 1 ? "Ask about this place…" : "Ask about these places…"}
                aria-label={mapFeatureSelections.length === 1 ? "Ask Chartize about this place" : "Ask Chartize about these places"}
                onFocus={(event) => onAskMapFeature?.(event.currentTarget)}
              />
              <b>{mapFeatureAiActive ? "active" : "ask"}</b>
            </label>
          </aside>
        </>
      )}
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
              onPointerCancel={() => setInteractionState({ kind: "idle" })}
            />
          ))}
        </span>
        );
      })()}
    </div>
  );
});

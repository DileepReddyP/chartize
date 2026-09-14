"use client";

import { forwardRef, useEffect, useImperativeHandle, useReducer, useRef, type CSSProperties, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from "react";
import embed, { type Result as EmbedResult, type VisualizationSpec } from "vega-embed";
import * as vegaRuntime from "vega";
import type { TablePreview } from "@chartize/contracts";
import type { MapViewport } from "@/lib/ggsql/geo-fit";
import { pngWithHeader, svgWithHeader } from "@/lib/ggsql/chart-export";
import { presentChartSpec, type ChartDomains, type ChartLegendTitles, type ChartThreshold } from "@/lib/ggsql/vega-presentation";
import {
  MAX_VISUAL_ITEM_SELECTIONS,
  visualItemSelectionFromDatum,
  type VisualItemSelection,
} from "@/lib/workspace/chart-data";

export interface ChartViewHandle {
  toPng: (includeHeader?: boolean) => Promise<string>;
  toSvg: () => Promise<string>;
  getDomains: () => { x?: [unknown, unknown]; y?: [unknown, unknown] };
}

export interface ChartRegionSelection {
  pixels: { x0: number; y0: number; x1: number; y1: number };
  x?: [unknown, unknown] | undefined;
  y?: [unknown, unknown] | undefined;
}

interface ChartViewProps {
  spec: Record<string, unknown> | null;
  interactive?: boolean;
  exportTitle?: string;
  exportSubtitle?: string;
  onError: (message: string) => void;
  threshold?: ChartThreshold;
  domains?: ChartDomains;
  legendTitles?: ChartLegendTitles;
  selection?: ChartRegionSelection | null;
  onRegionSelect?: (selection: ChartRegionSelection | null) => void;
  mapMode?: boolean;
  mapViewport?: MapViewport;
  onMapPan?: (horizontal: number, vertical: number) => void;
  onMapZoom?: (factor: number) => void;
  onChartZoom?: (factor: number) => void;
  onChartPan?: (horizontal: number, vertical: number) => void;
  onResetView?: () => void;
  mapFeatureSelections?: VisualItemSelection[];
  onMapFeatureSelect?: (selection: VisualItemSelection | null, additive?: boolean) => void;
  onVisualItemsSelect?: (selections: VisualItemSelection[]) => void;
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

function compactSelectionValue(value: unknown) {
  if (value instanceof Date) return value.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  if (typeof value === "number") return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (typeof value === "string") {
    const date = /^\d{4}-\d{2}-\d{2}(?:[T\s].*)?$/.test(value) ? new Date(value) : null;
    if (date && Number.isFinite(date.getTime())) return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    return value.length > 32 ? `${value.slice(0, 31)}…` : value;
  }
  return String(value ?? "");
}

function compactVisualItemDetails(selection: VisualItemSelection) {
  return selection.values
    .filter(({ value }) => value !== selection.title)
    .slice(0, 2)
    .map(({ field, value }) => `${field.replaceAll("_", " ")} ${value}`)
    .join(" · ");
}

function compactRegionDetails(selection: ChartRegionSelection, count: number, mapMode: boolean) {
  const range = (label: string, values?: [unknown, unknown]) => values
    ? `${label} ${compactSelectionValue(values[0])}–${compactSelectionValue(values[1])}`
    : "";
  const countLabel = count
    ? `${count.toLocaleString()} ${mapMode ? (count === 1 ? "place" : "places") : (count === 1 ? "data point" : "data points")}`
    : "";
  return [countLabel, range("x", selection.x), range("y", selection.y)].filter(Boolean).join(" · ") || "selected chart area";
}

type SceneMark = { marktype?: string; role?: string };
type SceneItem = vegaRuntime.Item<Record<string, unknown>> & {
  bounds?: { x1: number; y1: number; x2: number; y2: number };
  x?: number;
  y?: number;
};

const selectableMarkTypes = new Set(["arc", "area", "line", "path", "rect", "rule", "shape", "symbol", "trail"]);
const sceneIntersect = (vegaRuntime as unknown as {
  intersect: (scene: unknown, bounds: vegaRuntime.Bounds, filter: (mark: SceneMark) => boolean) => SceneItem[];
}).intersect;

function visualItemsInside(
  embedded: EmbedResult | null,
  pixels: SelectionPixels,
  table: Pick<TablePreview, "columns" | "rows"> | undefined,
  mapMode: boolean,
) {
  if (!embedded || typeof sceneIntersect !== "function") return [];
  const scenegraph = embedded.view.scenegraph() as unknown as { root?: unknown };
  if (!scenegraph.root) return [];
  const next = normalizedPixels(pixels);
  const bounds = new vegaRuntime.Bounds().set(
    next.x0,
    next.y0,
    next.x1,
    next.y1,
  );
  const hits = sceneIntersect(scenegraph.root, bounds, (mark) => (
    mark.role === "mark" && Boolean(mark.marktype && selectableMarkTypes.has(mark.marktype))
  ));
  const selections = new Map<string, VisualItemSelection>();
  for (const item of hits) {
    const itemBounds = item.bounds;
    // `vega.intersect` traverses from the scenegraph root, so its item bounds
    // are already in view/canvas coordinates. Applying view.origin() again
    // shifts selections by the plot padding (most visibly on tiled charts).
    const x = itemBounds ? (itemBounds.x1 + itemBounds.x2) / 2 : (item.x ?? (next.x0 + next.x1) / 2);
    const y = itemBounds ? (itemBounds.y1 + itemBounds.y2) / 2 : (item.y ?? (next.y0 + next.y1) / 2);
    const selection = visualItemSelectionFromDatum(item.datum, { x, y }, table, mapMode);
    if (selection && !selections.has(selection.key)) selections.set(selection.key, selection);
    if (selections.size >= MAX_VISUAL_ITEM_SELECTIONS) break;
  }
  return [...selections.values()];
}

export const ChartView = forwardRef<ChartViewHandle, ChartViewProps>(function ChartView({
  spec,
  interactive = true,
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
  onResetView,
  mapFeatureSelections = [],
  onMapFeatureSelect,
  onVisualItemsSelect,
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
  }, [domains, legendTitles, mapViewport, onError, spec, threshold]);

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
    onVisualItemsSelect?.(visualItemsInside(result.current, next, featureData, mapMode));
  };
  const selectVisualItemAt = (x: number, y: number, additive: boolean) => {
    const radius = 7;
    const hits = visualItemsInside(result.current, {
      x0: x - radius,
      y0: y - radius,
      x1: x + radius,
      y1: y + radius,
    }, featureData, mapMode);
    const nearest = hits.sort((left, right) => (
      Math.hypot(left.pixels.x - x, left.pixels.y - y)
      - Math.hypot(right.pixels.x - x, right.pixels.y - y)
    ))[0] ?? null;
    onMapFeatureSelect?.(nearest, additive);
  };
  const startSelection = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !spec) return;
    event.currentTarget.focus({ preventScroll: true });
    const { x, y } = point(event);
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
    const moved = Math.abs(next.x1 - next.x0) >= 5 && Math.abs(next.y1 - next.y0) >= 5;
    setInteractionState({ kind: "idle" });
    if (moved) commitSelection(next);
    else selectVisualItemAt(x, y, event.shiftKey);
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
      if (moved) {
        onMapFeatureSelect?.(null);
        onMapPan?.(horizontal, vertical);
      } else selectVisualItemAt(current.x, current.y, event.shiftKey);
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

  const activeVisualItem = mapFeatureSelections.at(-1) ?? null;
  const directlyLabeledItems = mapFeatureSelections.length <= 8
    ? new Set(mapFeatureSelections.map(({ key }) => key))
    : new Set(activeVisualItem ? [activeVisualItem.key] : []);

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

  return (
    <div
      ref={interaction}
      className={`chart-interaction ${mapMode ? "map-interaction" : ""}${mapDragging ? " is-panning" : ""}`}
      tabIndex={interactive ? 0 : -1}
      aria-label={!interactive ? (mapMode ? "Map visualization" : "Chart visualization") : mapMode ? "Map. Drag or scroll to pan, pinch to zoom, hold Shift while dragging to select a region, and double-click to reset." : "Chart. Scroll or pinch to zoom, scroll sideways to pan, drag to select a region, and double-click to reset."}
      onKeyDown={interactive ? (event) => { if (event.key === "Escape") { setInteractionState({ kind: "idle" }); onRegionSelect?.(null); onMapFeatureSelect?.(null); } } : undefined}
      onPointerDown={interactive ? startSelection : undefined}
      onPointerMove={interactive ? moveGesture : undefined}
      onPointerUp={interactive ? finishGesture : undefined}
      onPointerCancel={interactive ? () => setInteractionState({ kind: "idle" }) : undefined}
      onWheel={interactive ? wheel : undefined}
      onDoubleClickCapture={interactive ? (event) => {
        event.preventDefault();
        event.stopPropagation();
        setInteractionState({ kind: "idle" });
        onRegionSelect?.(null);
        onMapFeatureSelect?.(null);
        onResetView?.();
      } : undefined}
    >
      <div
        className="chart-embed"
        ref={element}
        style={mapDragging && mapGesture ? { transform: `translate(${mapGesture.current.x - mapGesture.start.x}px, ${mapGesture.current.y - mapGesture.start.y}px)` } : undefined}
      />
      {!selection && mapFeatureSelections.slice(-80).map((visualItem) => (
        <span
          key={visualItem.key}
          className="map-feature-pin"
          aria-hidden="true"
          style={{ left: visualItem.pixels.x, top: visualItem.pixels.y }}
        >
          {directlyLabeledItems.has(visualItem.key) && (
            <span className={`visual-item-label${visualItem.pixels.x > (interaction.current?.clientWidth ?? 1000) * .62 ? " to-left" : ""}`}>
              <b>{visualItem.title}</b>
              {compactVisualItemDetails(visualItem) && <small>{compactVisualItemDetails(visualItem)}</small>}
            </span>
          )}
        </span>
      ))}
      {(gesture?.pixels ?? selection?.pixels) && (() => {
        const pixels = normalizedPixels((gesture?.pixels ?? selection?.pixels)!);
        const persistent = Boolean(selection && (!gesture || gesture.handle));
        return (
        <>
          {persistent && <span
            className="chart-selection-shade"
            aria-hidden="true"
            style={{
              "--selection-left": `${pixels.x0}px`,
              "--selection-top": `${pixels.y0}px`,
              "--selection-right": `${pixels.x1}px`,
              "--selection-bottom": `${pixels.y1}px`,
            } as CSSProperties}
          ><i /><i /><i /><i /></span>}
          <span
            className={`chart-brush ${persistent ? "persistent" : "draft"}`}
            style={{ left: pixels.x0, top: pixels.y0, width: pixels.x1 - pixels.x0, height: pixels.y1 - pixels.y0 }}
          >
            {persistent && selection && <span className="chart-brush-summary"><b>{mapMode ? "selected area" : "selected range"}</b><small>{compactRegionDetails(selection, mapFeatureSelections.length, mapMode)}</small></span>}
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
        </>
        );
      })()}
    </div>
  );
});

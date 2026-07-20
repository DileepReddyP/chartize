"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from "react";
import embed, { type Result as EmbedResult, type VisualizationSpec } from "vega-embed";
import type { TablePreview } from "@chartize/contracts";
import type { MapViewport } from "@/lib/ggsql/geo-fit";
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
  mapFeatureSelection?: MapFeatureSelection | null;
  onMapFeatureSelect?: (selection: MapFeatureSelection | null) => void;
  onAskMapFeature?: (origin: HTMLElement) => void;
  mapFeatureAiActive?: boolean;
  featureData?: Pick<TablePreview, "columns" | "rows">;
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

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("The rendered chart image could not be read."));
    image.src = url;
  });
}

function canvasLines(context: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const lines: string[] = [];
  let line = words[0]!;
  for (const word of words.slice(1)) {
    const candidate = `${line} ${word}`;
    if (context.measureText(candidate).width <= maxWidth) line = candidate;
    else { lines.push(line); line = word; }
  }
  lines.push(line);
  return lines;
}

async function pngWithHeader(chartUrl: string, title: string, subtitle: string) {
  if (!title.trim() && !subtitle.trim()) return chartUrl;
  const image = await loadImage(chartUrl);
  const scale = image.naturalWidth >= 1_000 ? 2 : 1;
  const padding = 28 * scale;
  const canvas = document.createElement("canvas");
  const measure = canvas.getContext("2d");
  if (!measure) throw new Error("Canvas export is unavailable.");
  measure.font = `300 ${34 * scale}px system-ui, sans-serif`;
  const titleLines = canvasLines(measure, title, image.naturalWidth - padding * 2);
  measure.font = `400 ${14 * scale}px system-ui, sans-serif`;
  const subtitleLines = canvasLines(measure, subtitle, image.naturalWidth - padding * 2);
  const headerHeight = padding
    + titleLines.length * 39 * scale
    + (subtitleLines.length ? 8 * scale + subtitleLines.length * 20 * scale : 0)
    + 18 * scale;
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight + headerHeight;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas export is unavailable.");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#0a0f0d";
  context.font = `300 ${34 * scale}px system-ui, sans-serif`;
  titleLines.forEach((line, index) => context.fillText(line, padding, padding + 32 * scale + index * 39 * scale));
  context.fillStyle = "#596662";
  context.font = `400 ${14 * scale}px system-ui, sans-serif`;
  const subtitleTop = padding + titleLines.length * 39 * scale + 8 * scale;
  subtitleLines.forEach((line, index) => context.fillText(line, padding, subtitleTop + 14 * scale + index * 20 * scale));
  context.drawImage(image, 0, headerHeight);
  return canvas.toDataURL("image/png");
}

function xmlText(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function approximateLines(text: string, maxCharacters: number) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && candidate.length > maxCharacters) { lines.push(line); line = word; }
    else line = candidate;
  }
  if (line) lines.push(line);
  return lines;
}

async function svgWithHeader(chartUrl: string, title: string, subtitle: string) {
  if (!title.trim() && !subtitle.trim()) return chartUrl;
  const source = await (await fetch(chartUrl)).text();
  const parsed = new DOMParser().parseFromString(source, "image/svg+xml");
  const root = parsed.documentElement;
  if (root.nodeName.toLocaleLowerCase() !== "svg") throw new Error("The rendered SVG could not be read.");
  const viewBox = root.getAttribute("viewBox")?.split(/\s+/).map(Number);
  const width = Number.parseFloat(root.getAttribute("width") ?? "") || viewBox?.[2] || 800;
  const height = Number.parseFloat(root.getAttribute("height") ?? "") || viewBox?.[3] || 500;
  const scale = width >= 1_000 ? 2 : 1;
  const padding = 28 * scale;
  const titleSize = 34 * scale;
  const subtitleSize = 14 * scale;
  const titleLines = approximateLines(title, Math.max(12, Math.floor((width - padding * 2) / (titleSize * .54))));
  const subtitleLines = approximateLines(subtitle, Math.max(18, Math.floor((width - padding * 2) / (subtitleSize * .52))));
  const headerHeight = padding + titleLines.length * 39 * scale + (subtitleLines.length ? 8 * scale + subtitleLines.length * 20 * scale : 0) + 18 * scale;
  const titleText = titleLines.map((line, index) => `<text x="${padding}" y="${padding + 32 * scale + index * 39 * scale}" fill="#0a0f0d" font-family="system-ui, sans-serif" font-size="${titleSize}" font-weight="300">${xmlText(line)}</text>`).join("");
  const subtitleTop = padding + titleLines.length * 39 * scale + 8 * scale;
  const subtitleText = subtitleLines.map((line, index) => `<text x="${padding}" y="${subtitleTop + 14 * scale + index * 20 * scale}" fill="#596662" font-family="system-ui, sans-serif" font-size="${subtitleSize}" font-weight="400">${xmlText(line)}</text>`).join("");
  const exported = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height + headerHeight}" viewBox="0 0 ${width} ${height + headerHeight}"><rect width="100%" height="100%" fill="#ffffff"/>${titleText}${subtitleText}<g transform="translate(0 ${headerHeight})">${root.innerHTML}</g></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(exported)}`;
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
  mapFeatureSelection,
  onMapFeatureSelect,
  onAskMapFeature,
  mapFeatureAiActive = false,
  featureData,
}, ref) {
  const interaction = useRef<HTMLDivElement>(null);
  const element = useRef<HTMLDivElement>(null);
  const result = useRef<EmbedResult | null>(null);
  const [gesture, setGesture] = useState<{ pixels: SelectionPixels; handle?: ResizeHandle } | null>(null);
  const [mapGesture, setMapGesture] = useState<{ start: { x: number; y: number }; current: { x: number; y: number } } | null>(null);
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
              mapFeatureSelectRef.current?.(mapFeatureSelectionFromDatum(item?.datum, {
                x: Math.max(0, Math.min(bounds.width, pointer.clientX - bounds.left)),
                y: Math.max(0, Math.min(bounds.height, pointer.clientY - bounds.top)),
              }, featureData));
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
      setMapGesture({ start: { x, y }, current: { x, y } });
      return;
    }
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* optional enhancement */ }
    if (mapMode) onMapFeatureSelect?.(null);
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
      const currentPoint = point(event);
      if (Math.hypot(currentPoint.x - mapGesture.start.x, currentPoint.y - mapGesture.start.y) > 4) {
        try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* optional enhancement */ }
      }
      setMapGesture((current) => current ? { ...current, current: currentPoint } : current);
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
      setMapGesture(null);
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

  return (
    <div
      ref={interaction}
      className={`chart-interaction ${mapMode ? "map-interaction" : ""}${mapDragging ? " is-panning" : ""}`}
      tabIndex={0}
      aria-label={mapMode ? "Map. Drag or scroll to pan, pinch to zoom, and hold Shift while dragging to select a region." : "Chart. Scroll or pinch to zoom, scroll sideways to pan, and drag to select a region."}
      onKeyDown={(event) => { if (event.key === "Escape") { setGesture(null); setMapGesture(null); onRegionSelect?.(null); onMapFeatureSelect?.(null); } }}
      onPointerDown={startSelection}
      onPointerMove={moveGesture}
      onPointerUp={finishGesture}
      onPointerCancel={() => { setGesture(null); setMapGesture(null); }}
      onWheel={wheel}
    >
      <div
        className="chart-embed"
        ref={element}
        style={mapDragging && mapGesture ? { transform: `translate(${mapGesture.current.x - mapGesture.start.x}px, ${mapGesture.current.y - mapGesture.start.y}px)` } : undefined}
      />
      {mapMode && mapFeatureSelection && (
        <>
          <span
            className="map-feature-pin"
            aria-hidden="true"
            style={{ left: mapFeatureSelection.pixels.x, top: mapFeatureSelection.pixels.y }}
          />
          <aside
            className="map-feature-inspector"
            aria-label={`Selected place: ${mapFeatureSelection.title}`}
            style={{
              "--feature-x": `${mapFeatureSelection.pixels.x + 14}px`,
              "--feature-y": `${mapFeatureSelection.pixels.y + 14}px`,
            } as CSSProperties}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <header>
              <div><span>selected place</span><h2>{mapFeatureSelection.title}</h2></div>
              <button type="button" aria-label="Close selected place" onClick={() => onMapFeatureSelect?.(null)}>×</button>
            </header>
            {mapFeatureSelection.pending
              ? <div className="map-feature-status" role="status"><span className="spinner" aria-hidden="true" /> loading feature details…</div>
              : mapFeatureSelection.error
                ? <div className="map-feature-status error" role="alert">{mapFeatureSelection.error}</div>
                : <dl>{mapFeatureSelection.values.map(({ field, value }) => <div key={field}><dt>{field}</dt><dd>{value}</dd></div>)}</dl>}
            <button className={`map-feature-ask${mapFeatureAiActive ? " active" : ""}`} type="button" disabled={mapFeatureSelection.pending || Boolean(mapFeatureSelection.error)} onClick={(event) => onAskMapFeature?.(event.currentTarget)}><span aria-hidden="true">✦</span> {mapFeatureAiActive ? "active in chartize ai" : "ask about this place"}</button>
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
              onPointerCancel={() => setGesture(null)}
            />
          ))}
        </span>
        );
      })()}
    </div>
  );
});

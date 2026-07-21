"use client";

import { useEffect, useRef, useState } from "react";
import embed, { type Result as EmbedResult, type VisualizationSpec } from "vega-embed";
import type { MapViewport } from "@/lib/ggsql/geo-fit";
import { presentChartSpec } from "@/lib/ggsql/vega-presentation";

interface StaticChartPreviewProps {
  spec: Record<string, unknown>;
  label: string;
  mapViewport?: MapViewport;
  onError: (message: string) => void;
}

const SVG_RENDER_TIMEOUT_MS = 15_000;

async function withRenderTimeout<T>(operation: Promise<T>) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("This chart preview took too long to render.")), SVG_RENDER_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Homepage charts are reading surfaces, not editors. Render each Vega view
 * once, serialize it to SVG, and immediately finalize the live runtime. This
 * retains crisp responsive previews without keeping eight Vega instances and
 * their event machinery alive after the local worker has produced the specs.
 */
export function StaticChartPreview({ spec, label, mapViewport, onError }: StaticChartPreviewProps) {
  const host = useRef<HTMLDivElement>(null);
  const onErrorRef = useRef(onError);
  const [svg, setSvg] = useState("");

  useEffect(() => { onErrorRef.current = onError; }, [onError]);

  useEffect(() => {
    let cancelled = false;
    let acceptEmbeddedView = true;
    let embedded: EmbedResult | null = null;
    const render = async () => {
      const element = host.current;
      if (!element) return;
      setSvg("");
      if (cancelled) return;
      const mount = document.createElement("div");
      const embedding = embed(
        mount,
        presentChartSpec(spec, undefined, undefined, mapViewport) as VisualizationSpec,
        { actions: false, renderer: "svg", tooltip: false, logLevel: 1 },
      ).then((result) => {
        if (cancelled || !acceptEmbeddedView) {
          result.finalize();
          throw new Error("This chart preview was stopped.");
        }
        return result;
      });
      try {
        embedded = await withRenderTimeout(embedding);
      } catch (cause) {
        acceptEmbeddedView = false;
        throw cause;
      }
      if (cancelled || !host.current) {
        embedded.finalize();
        embedded = null;
        return;
      }
      try {
        const width = Math.max(240, Math.round(element.clientWidth));
        const height = Math.max(160, Math.round(element.clientHeight));
        await withRenderTimeout(embedded.view.width(width).height(height).runAsync());
        const rendered = await withRenderTimeout(embedded.view.toSVG());
        if (!cancelled) setSvg(rendered);
      } finally {
        embedded.finalize();
        embedded = null;
      }
    };
    void render().catch((cause) => {
      embedded?.finalize();
      embedded = null;
      if (!cancelled) onErrorRef.current(cause instanceof Error ? cause.message : String(cause));
    });
    return () => {
      cancelled = true;
      acceptEmbeddedView = false;
      embedded?.finalize();
    };
  }, [mapViewport, spec]);

  return (
    <div className="static-chart-preview" ref={host} role="img" aria-label={label}>
      {svg
        ? <div className="static-chart-svg" aria-hidden="true" dangerouslySetInnerHTML={{ __html: svg }} />
        : <span className="static-chart-loading" aria-hidden="true"><span className="spinner" /></span>}
    </div>
  );
}

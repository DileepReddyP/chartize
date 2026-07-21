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
    let embedded: EmbedResult | null = null;
    const render = async () => {
      const element = host.current;
      if (!element) return;
      setSvg("");
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      if (cancelled || !host.current) return;
      const mount = document.createElement("div");
      embedded = await embed(
        mount,
        presentChartSpec(spec, undefined, undefined, mapViewport) as VisualizationSpec,
        { actions: false, renderer: "svg", tooltip: false, logLevel: 1 },
      );
      const width = Math.max(240, Math.round(host.current.clientWidth));
      const height = Math.max(160, Math.round(host.current.clientHeight));
      await embedded.view.width(width).height(height).runAsync();
      const rendered = await embedded.view.toSVG();
      embedded.finalize();
      embedded = null;
      if (!cancelled) setSvg(rendered);
    };
    void render().catch((cause) => {
      embedded?.finalize();
      embedded = null;
      if (!cancelled) onErrorRef.current(cause instanceof Error ? cause.message : String(cause));
    });
    return () => {
      cancelled = true;
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

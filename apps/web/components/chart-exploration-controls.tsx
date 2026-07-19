"use client";

import type { MapViewportState } from "@/lib/workspace/store";

interface MapExplorationControlsProps {
  viewport: MapViewportState;
  onPan: (horizontal: number, vertical: number) => void;
  onZoom: (factor: number) => void;
  onReset: () => void;
}

export function MapExplorationControls({ viewport, onPan, onZoom, onReset }: MapExplorationControlsProps) {
  return (
    <nav className="chart-explore-controls map-controls" aria-label="Map exploration controls">
      <div className="map-compass" role="group" aria-label="Pan map">
        <button className="north" type="button" title="Pan north" aria-label="Pan map north" onClick={() => onPan(0, 0.12)}>↑</button>
        <button className="west" type="button" title="Pan west" aria-label="Pan map west" onClick={() => onPan(-0.12, 0)}>←</button>
        <button className="home" type="button" title="Recenter map" aria-label="Recenter map" onClick={onReset}><span>N</span><i /></button>
        <button className="east" type="button" title="Pan east" aria-label="Pan map east" onClick={() => onPan(0.12, 0)}>→</button>
        <button className="south" type="button" title="Pan south" aria-label="Pan map south" onClick={() => onPan(0, -0.12)}>↓</button>
      </div>
      <div className="map-zoom" role="group" aria-label="Zoom map">
        <button type="button" disabled={viewport.zoom >= 8} title="Zoom map in" aria-label="Zoom map in" onClick={() => onZoom(1.35)}>+</button>
        <span aria-live="polite">{Math.round(viewport.zoom * 100)}%</span>
        <button type="button" disabled={viewport.zoom <= 0.5} title="Zoom map out" aria-label="Zoom map out" onClick={() => onZoom(1 / 1.35)}>−</button>
      </div>
      <small>drag to pan · shift-drag to select</small>
    </nav>
  );
}

interface GraphExplorationControlsProps {
  canZoomSelection: boolean;
  canGoBack: boolean;
  canFit: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomSelection: () => void;
  onGoBack: () => void;
  onFit: () => void;
}

export function GraphExplorationControls({
  canZoomSelection,
  canGoBack,
  canFit,
  onZoomIn,
  onZoomOut,
  onZoomSelection,
  onGoBack,
  onFit,
}: GraphExplorationControlsProps) {
  return (
    <nav className="chart-explore-controls graph-controls" aria-label="Chart exploration controls">
      <button type="button" title="Zoom in around center" aria-label="Zoom chart in" onClick={onZoomIn}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10" cy="10" r="6" /><path d="m14.5 14.5 5 5M10 7v6M7 10h6" /></svg>
      </button>
      <button type="button" title="Zoom out around center" aria-label="Zoom chart out" onClick={onZoomOut}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10" cy="10" r="6" /><path d="m14.5 14.5 5 5M7 10h6" /></svg>
      </button>
      <button type="button" disabled={!canZoomSelection} title="Zoom to selected range" aria-label="Zoom to selected range" onClick={onZoomSelection}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8V5h3M16 5h3v3M19 16v3h-3M8 19H5v-3" /></svg>
      </button>
      <button type="button" disabled={!canGoBack} title="Return to previous view" aria-label="Return to previous chart view" onClick={onGoBack}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 7 4 11l4 4M5 11h8a5 5 0 1 1 0 10" /></svg>
      </button>
      <button type="button" disabled={!canFit} title="Fit full chart" aria-label="Fit full chart" onClick={onFit}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" /></svg>
      </button>
    </nav>
  );
}

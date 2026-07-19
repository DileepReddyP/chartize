"use client";

import type { FieldMetadata } from "@chartize/contracts";
import type { CSSProperties } from "react";
import { ColumnPicker, SourceTiles, type DwimSource } from "./dwim-panel";

export interface InlineControlAnchors {
  select: { left: number; top: number };
  from: { left: number; top: number };
}

interface InlineQueryControlsProps {
  anchors: InlineControlAnchors;
  sources: DwimSource[];
  activeSources: string[];
  selectedFields: Set<string>;
  catalogLoading: boolean;
  onSource: (source: string, enabled: boolean) => void;
  onColumn: (source: string, field: FieldMetadata, enabled: boolean) => void;
}

function position(value: { left: number; top: number }) {
  return { "--inline-left": `${value.left}px`, "--inline-top": `${value.top}px` } as CSSProperties;
}

export function InlineQueryControls({ anchors, sources, activeSources, selectedFields, catalogLoading, onSource, onColumn }: InlineQueryControlsProps) {
  return (
    <div className="inline-query-layer" aria-label="Direct SQL controls">
      <div className="inline-query-control inline-select-control" style={position(anchors.select)}>
        <ColumnPicker compact sources={sources} activeSources={activeSources} selectedFields={selectedFields} onColumn={onColumn} />
      </div>
      <details className="inline-query-control inline-source-control" style={position(anchors.from)} data-dismiss-on-outside>
        <summary title="Add or remove FROM sources" aria-label="Add or remove FROM sources">+</summary>
        <div className="inline-source-menu">
          <header><b>from</b><span>select one or more compatible sources</span></header>
          <SourceTiles compact sources={sources} activeSources={activeSources} onSource={onSource} loading={catalogLoading} />
        </div>
      </details>
    </div>
  );
}

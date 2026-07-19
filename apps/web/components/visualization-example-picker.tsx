"use client";

import { VISUALIZATION_EXAMPLES, type VisualizationExample } from "@/lib/ggsql/examples";

interface VisualizationExamplePickerProps {
  onSelect: (example: VisualizationExample) => void;
}

export function VisualizationExamplePicker({ onSelect }: VisualizationExamplePickerProps) {
  return (
    <details className="example-picker" data-dismiss-on-outside>
      <summary>examples</summary>
      <div>
        <header><strong>example visualizations</strong></header>
        {VISUALIZATION_EXAMPLES.map((example) => (
          <button key={example.id} type="button" onClick={(event) => {
            event.currentTarget.closest("details")?.removeAttribute("open");
            onSelect(example);
          }}>
            <strong>{example.title}</strong>
            <span>{example.description}</span>
            <small>{example.tags.join(" · ")}</small>
          </button>
        ))}
      </div>
    </details>
  );
}

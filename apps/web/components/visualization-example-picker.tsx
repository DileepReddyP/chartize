"use client";

import { EXAMPLE_CATEGORIES, VISUALIZATION_EXAMPLES, type VisualizationExample } from "@/lib/ggsql/examples";

interface VisualizationExamplePickerProps {
  onSelect: (example: VisualizationExample) => void;
}

export function VisualizationExamplePicker({ onSelect }: VisualizationExamplePickerProps) {
  return (
    <details className="example-picker" data-dismiss-on-outside>
      <summary aria-label="Example visualizations" title="Example visualizations"><svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2.5" y="2.5" width="4" height="4" /><rect x="9.5" y="2.5" width="4" height="4" /><rect x="2.5" y="9.5" width="4" height="4" /><rect x="9.5" y="9.5" width="4" height="4" /></svg><span className="topbar-button-label">examples</span></summary>
      <div>
        <header><strong>example visualizations</strong></header>
        {EXAMPLE_CATEGORIES.map((category, index) => {
          const examples = VISUALIZATION_EXAMPLES.filter((example) => example.category === category.id);
          if (!examples.length) return null;
          const headingId = `example-category-${category.id}`;
          return <section key={category.id} className={`example-category category-${category.id}`} aria-labelledby={headingId}><header><span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span><div><strong id={headingId}>{category.title}</strong><small>{category.description}</small></div></header><div>{examples.map((example) => (
            <button key={example.id} type="button" onClick={(event) => {
              event.currentTarget.closest("details")?.removeAttribute("open");
              onSelect(example);
            }}>
              <strong>{example.title}</strong>
              <span>{example.description}</span>
              <small>{example.tags.join(" · ")}</small>
            </button>
          ))}</div></section>;
        })}
      </div>
    </details>
  );
}

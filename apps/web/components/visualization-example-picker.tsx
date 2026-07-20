"use client";

import { EXAMPLE_CATEGORIES, VISUALIZATION_EXAMPLES, type VisualizationExample } from "@/lib/ggsql/examples";

interface VisualizationExamplePickerProps {
  onSelect: (example: VisualizationExample) => void;
}

export function VisualizationExamplePicker({ onSelect }: VisualizationExamplePickerProps) {
  return (
    <details className="example-picker" data-dismiss-on-outside>
      <summary>examples</summary>
      <div>
        <header><strong>example visualizations</strong></header>
        {EXAMPLE_CATEGORIES.map((category) => {
          const examples = VISUALIZATION_EXAMPLES.filter((example) => example.category === category.id);
          if (!examples.length) return null;
          return <section key={category.id} className={`example-category category-${category.id}`}><header><strong>{category.title}</strong><small>{category.description}</small></header><div>{examples.map((example) => (
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

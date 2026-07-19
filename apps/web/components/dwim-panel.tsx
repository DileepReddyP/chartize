"use client";

import type { FieldMetadata } from "@chartize/contracts";
import type { CSSProperties } from "react";
import { sourceAlias, type QuerySection, type VisualPointState } from "@/lib/ggsql/query-context";

export interface DwimSource {
  id: string;
  title: string;
  description: string;
  namespace: "chartize" | "user" | "ggsql";
  fields: FieldMetadata[];
  rows?: number;
  disabled?: boolean;
}

interface SourceTilesProps {
  sources: DwimSource[];
  activeSources: string[];
  onSource: (source: string, enabled: boolean) => void;
  compact?: boolean;
  loading?: boolean;
}

export function SourceTiles({ sources, activeSources, onSource, compact, loading }: SourceTilesProps) {
  return (
    <div className={`dwim-source-tiles ${compact ? "compact" : ""}`} aria-busy={loading}>
      {sources.map((source) => {
        const active = activeSources.includes(source.id);
        return (
          <button
            key={source.id}
            type="button"
            className={active ? "active" : ""}
            aria-pressed={active}
            disabled={source.disabled && !active}
            title={source.disabled ? "A query cannot mix VPS and browser-only sources." : source.description}
            onClick={() => onSource(source.id, !active)}
          >
            <span>{active ? "✓" : "+"}</span>
            <strong>{source.title}</strong>
            <small>{source.namespace}: {source.rows === undefined ? "browser" : `${source.rows.toLocaleString()} rows`}</small>
          </button>
        );
      })}
      {loading && <div className="source-tiles-loading" role="status"><span className="spinner" /><span>loading warehouse sources…</span></div>}
    </div>
  );
}

interface ColumnPickerProps {
  sources: DwimSource[];
  activeSources: string[];
  selectedFields: Set<string>;
  onColumn: (source: string, field: FieldMetadata, enabled: boolean) => void;
  onRemoveColumn?: (field: string) => void;
  compact?: boolean;
}

export function ColumnPicker({ sources, activeSources, selectedFields, onColumn, onRemoveColumn, compact }: ColumnPickerProps) {
  const selected = [...selectedFields];
  return (
    <div className={`dwim-column-control ${compact ? "compact" : ""}`}>
      {!compact && (
        <div className="dwim-selected-fields">
          {selected.map((field) => (
            <button key={field} type="button" title={`Remove ${field} from SELECT`} onClick={() => onRemoveColumn?.(field)}>
              {field}<span aria-hidden="true">×</span>
            </button>
          ))}
        </div>
      )}
      <details className="dwim-column-picker" data-dismiss-on-outside>
        <summary title="Add a field to SELECT" aria-label="Add a field to SELECT">+</summary>
        <div className="dwim-column-menu">
          {activeSources.map((sourceId, sourceIndex) => {
            const source = sources.find((candidate) => candidate.id === sourceId);
            if (!source) return null;
            const alias = sourceAlias(source.id, sourceIndex);
            return (
              <section key={source.id}>
                <header><b>{source.title}</b><span>{source.id}</span></header>
                <div>
                  {source.fields.map((field) => {
                    const qualified = `${alias}__${field.name}`;
                    const active = selectedFields.has(qualified) || (sourceIndex === 0 && selectedFields.has(field.name));
                    return (
                      <button key={field.name} type="button" className={active ? "active" : ""} onClick={() => onColumn(source.id, field, !active)}>
                        <span>{active ? "✓" : "+"}</span>{field.name}<small>{field.dataType.toLocaleLowerCase()}</small>
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </details>
    </div>
  );
}

interface DwimPanelProps {
  section: QuerySection;
  selectedText: string;
  position: { left: number; top: number };
  sources: DwimSource[];
  activeSources: string[];
  visualFields: FieldMetadata[];
  selectedFields: Set<string>;
  visual: VisualPointState;
  status: string;
  catalogLoading: boolean;
  onSource: (source: string, enabled: boolean) => void;
  onColumn: (source: string, field: FieldMetadata, enabled: boolean) => void;
  onRemoveColumn: (field: string) => void;
  onVisual: (next: Partial<VisualPointState>) => void;
  onFiles: (files: FileList) => void;
  onRunSelection: () => void;
  onPromoteAi: (origin: HTMLButtonElement) => void;
  onClose: () => void;
}

const marks = [
  "point", "line", "path", "segment", "rule", "area", "ribbon", "polygon", "text",
  "bar", "histogram", "density", "violin", "boxplot", "range", "smooth", "spatial", "tile",
];
const positions = ["identity", "stack", "dodge", "jitter"];
const scaleTypes = ["", "continuous", "discrete", "binned", "ordinal", "identity"];
const transforms = ["", "date", "log10", "sqrt", "reverse"];
const palettes = ["", "ggsql", "tableau10", "viridis", "kelly22", "greys", "ylgnbu", "bugn", "rdpu", "batlow", "hawaii", "roma", "vik", "turku"];
const projections = ["", "cartesian", "polar", "mercator", "orthographic", "equalearth", "albers", "lambert", "crs"];
const smoothMethods = ["", "nw", "ols", "tls"];
const smoothKernels = ["", "gaussian", "epanechnikov", "triangular", "rectangular", "biweight", "cosine"];
const lineTypes = ["", "solid", "dashed", "dotted", "dotdash"];

function FieldSelect({ label, value, fields, onChange }: {
  label: string;
  value: string;
  fields: FieldMetadata[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="dwim-field">
      <span>{label}</span>
      <select name={`visual-${label.toLocaleLowerCase().replace(/\s+/g, "-")}`} value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">none</option>
        {fields.map((field) => <option key={field.name} value={field.name}>{field.name}</option>)}
      </select>
    </label>
  );
}

function ChoiceSelect({ label, value, options, onChange }: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="dwim-field">
      <span>{label}</span>
      <select name={`visual-${label.toLocaleLowerCase().replace(/\s+/g, "-")}`} value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => <option key={option || "auto"} value={option}>{option || "auto"}</option>)}
      </select>
    </label>
  );
}

function TextControl({ label, value, placeholder, type = "text", min, max, step, onChange }: {
  label: string;
  value: string;
  placeholder?: string;
  type?: "text" | "number";
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: string) => void;
}) {
  return (
    <label className="dwim-field">
      <span>{label}</span>
      <input name={`visual-${label.toLocaleLowerCase().replace(/\s+/g, "-")}`} type={type} value={value} placeholder={placeholder} min={min} max={max} step={step} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

export function DwimPanel(props: DwimPanelProps) {
  const copy = props.section === "selection"
    ? { title: "selected code", placeholder: "Change or explain this selection…" }
    : props.section === "visual"
      ? { title: "visualise at point", placeholder: "Describe the visual change you mean…" }
      : { title: "sql at point", placeholder: "Describe the data operation you mean…" };
  const style = { "--dwim-left": `${props.position.left}px`, "--dwim-top": `${props.position.top}px` } as CSSProperties;

  return (
    <aside className={`dwim-panel section-${props.section}`} style={style} aria-label={`${copy.title} actions`}>
      <header className="dwim-heading">
        <h2>{copy.title}</h2>
        <button type="button" onClick={props.onClose} aria-label="Close contextual actions">×</button>
      </header>

      <button className="dwim-command ai-promoter" type="button" onClick={(event) => props.onPromoteAi(event.currentTarget)}>
        <span aria-hidden="true">✦</span><span>{copy.placeholder}</span><b>ask</b>
      </button>
      {props.status && <p className="dwim-status" role="status">{props.status}</p>}

      {props.section === "selection" && (
        <div className="dwim-selection">
          <pre>{props.selectedText}</pre>
          <div>
            <button type="button" onClick={() => void navigator.clipboard.writeText(props.selectedText)}>copy selection</button>
            <button type="button" onClick={props.onRunSelection}>run full query</button>
          </div>
        </div>
      )}

      {props.section === "sql" && (
        <div className="dwim-body sql-controls">
          <section className="dwim-source-section">
            <div className="dwim-section-label"><b>sources</b></div>
            <SourceTiles sources={props.sources} activeSources={props.activeSources} onSource={props.onSource} loading={props.catalogLoading} />
            <label className="dwim-upload">
              <input name="user-datasets" type="file" multiple accept=".csv,.tsv,.json,.ndjson,.parquet,.geoparquet,.geojson,.zip" onChange={(event) => event.target.files && props.onFiles(event.target.files)} />
              <span>＋ add user dataset</span>
            </label>
          </section>
          <section className="dwim-column-section">
            <div className="dwim-section-label"><b>select</b></div>
            <ColumnPicker sources={props.sources} activeSources={props.activeSources} selectedFields={props.selectedFields} onColumn={props.onColumn} onRemoveColumn={props.onRemoveColumn} />
          </section>
        </div>
      )}

      {props.section === "visual" && (
        <div className="dwim-body visual-controls">
          <section className="dwim-visual-section">
            <div className="dwim-section-label"><b>mark</b></div>
            <div className="dwim-marks">
              {marks.map((mark) => <button key={mark} type="button" className={props.visual.mark === mark ? "active" : ""} onClick={() => props.onVisual({ mark })}>{mark}</button>)}
            </div>
          </section>
          <section className="dwim-visual-section">
            <div className="dwim-section-label"><b>mapping</b></div>
            <div className="dwim-visual-grid">
              {props.visual.mark === "spatial" ? (
                <>
                  <FieldSelect label="geometry" value={props.visual.geometry} fields={props.visualFields} onChange={(geometry) => props.onVisual({ geometry })} />
                  <FieldSelect label="fill" value={props.visual.fill} fields={props.visualFields} onChange={(fill) => props.onVisual({ fill })} />
                  <FieldSelect label="colour" value={props.visual.color} fields={props.visualFields} onChange={(color) => props.onVisual({ color })} />
                  <FieldSelect label="opacity" value={props.visual.opacityField} fields={props.visualFields} onChange={(opacityField) => props.onVisual({ opacityField })} />
                </>
              ) : (
                <>
                  <FieldSelect label="x" value={props.visual.x} fields={props.visualFields} onChange={(x) => props.onVisual({ x })} />
                  <FieldSelect label="y" value={props.visual.y} fields={props.visualFields} onChange={(y) => props.onVisual({ y })} />
                  {props.visual.mark === "segment" && <><FieldSelect label="x end" value={props.visual.xEnd} fields={props.visualFields} onChange={(xEnd) => props.onVisual({ xEnd })} /><FieldSelect label="y end" value={props.visual.yEnd} fields={props.visualFields} onChange={(yEnd) => props.onVisual({ yEnd })} /></>}
                  {(props.visual.mark === "range" || props.visual.mark === "ribbon") && <><FieldSelect label="y min" value={props.visual.yMin} fields={props.visualFields} onChange={(yMin) => props.onVisual({ yMin })} /><FieldSelect label="y max" value={props.visual.yMax} fields={props.visualFields} onChange={(yMax) => props.onVisual({ yMax })} /></>}
                  {props.visual.mark === "range" && <><FieldSelect label="x min" value={props.visual.xMin} fields={props.visualFields} onChange={(xMin) => props.onVisual({ xMin })} /><FieldSelect label="x max" value={props.visual.xMax} fields={props.visualFields} onChange={(xMax) => props.onVisual({ xMax })} /></>}
                  {props.visual.mark === "rule" && <FieldSelect label="slope" value={props.visual.slope} fields={props.visualFields} onChange={(slope) => props.onVisual({ slope })} />}
                  {props.visual.mark === "smooth" && <FieldSelect label="weight" value={props.visual.weight} fields={props.visualFields} onChange={(weight) => props.onVisual({ weight })} />}
                  <FieldSelect label="colour" value={props.visual.color} fields={props.visualFields} onChange={(color) => props.onVisual({ color })} />
                  <FieldSelect label="fill" value={props.visual.fill} fields={props.visualFields} onChange={(fill) => props.onVisual({ fill })} />
                  <FieldSelect label="size" value={props.visual.size} fields={props.visualFields} onChange={(size) => props.onVisual({ size })} />
                  <FieldSelect label="shape" value={props.visual.shape} fields={props.visualFields} onChange={(shape) => props.onVisual({ shape })} />
                  <FieldSelect label="linetype" value={props.visual.linetype} fields={props.visualFields} onChange={(linetype) => props.onVisual({ linetype })} />
                  <FieldSelect label="linewidth" value={props.visual.linewidth} fields={props.visualFields} onChange={(linewidth) => props.onVisual({ linewidth })} />
                  <FieldSelect label="opacity" value={props.visual.opacityField} fields={props.visualFields} onChange={(opacityField) => props.onVisual({ opacityField })} />
                </>
              )}
            </div>
          </section>
          <section className="dwim-visual-section">
            <div className="dwim-section-label"><b>appearance</b></div>
            <div className="dwim-visual-grid">
              <ChoiceSelect label="position" value={props.visual.position} options={positions} onChange={(position) => props.onVisual({ position })} />
              <TextControl label="opacity" type="number" min={0} max={1} step={0.05} value={props.visual.opacity} onChange={(opacity) => props.onVisual({ opacity })} />
              <TextControl label="fixed colour" value={props.visual.fixedColour} placeholder="#3cbbb1" onChange={(fixedColour) => props.onVisual({ fixedColour })} />
              <TextControl label="fixed fill" value={props.visual.fixedFill} placeholder="#3cbbb1" onChange={(fixedFill) => props.onVisual({ fixedFill })} />
              <TextControl label="series label" value={props.visual.colourLegendValue} placeholder="legend label" onChange={(colourLegendValue) => props.onVisual({ colourLegendValue })} />
              <TextControl label="fill label" value={props.visual.fillLegendValue} placeholder="legend label" onChange={(fillLegendValue) => props.onVisual({ fillLegendValue })} />
              <TextControl label="fixed size" type="number" min={0} value={props.visual.fixedSize} onChange={(fixedSize) => props.onVisual({ fixedSize })} />
              <TextControl label="line width" type="number" min={0} step={0.25} value={props.visual.fixedLinewidth} onChange={(fixedLinewidth) => props.onVisual({ fixedLinewidth })} />
              <ChoiceSelect label="line type" value={props.visual.fixedLinetype} options={lineTypes} onChange={(fixedLinetype) => props.onVisual({ fixedLinetype })} />
            </div>
          </section>
          {props.visual.mark === "smooth" && (
            <section className="dwim-visual-section">
              <div className="dwim-section-label"><b>model</b></div>
              <div className="dwim-visual-grid">
                <ChoiceSelect label="method" value={props.visual.smoothMethod} options={smoothMethods} onChange={(smoothMethod) => props.onVisual({ smoothMethod })} />
                <TextControl label="adjust" type="number" min={0.01} step={0.05} value={props.visual.smoothAdjust} placeholder="1" onChange={(smoothAdjust) => props.onVisual({ smoothAdjust })} />
                <TextControl label="bandwidth" type="number" min={0.01} step={0.05} value={props.visual.smoothBandwidth} placeholder="automatic" onChange={(smoothBandwidth) => props.onVisual({ smoothBandwidth })} />
                <ChoiceSelect label="kernel" value={props.visual.smoothKernel} options={smoothKernels} onChange={(smoothKernel) => props.onVisual({ smoothKernel })} />
              </div>
            </section>
          )}
          <section className="dwim-visual-section">
            <div className="dwim-section-label"><b>labels</b></div>
            <div className="dwim-visual-grid labels-grid">
              <TextControl label="title" value={props.visual.title} placeholder="chart title" onChange={(title) => props.onVisual({ title })} />
              <TextControl label="subtitle" value={props.visual.subtitle} placeholder="chart subtitle" onChange={(subtitle) => props.onVisual({ subtitle })} />
              <TextControl label="x axis" value={props.visual.labelX} placeholder="automatic" onChange={(labelX) => props.onVisual({ labelX })} />
              <TextControl label="y axis" value={props.visual.labelY} placeholder="automatic" onChange={(labelY) => props.onVisual({ labelY })} />
              <TextControl label="colour legend" value={props.visual.labelColor} placeholder="automatic" onChange={(labelColor) => props.onVisual({ labelColor })} />
              <TextControl label="fill legend" value={props.visual.labelFill} placeholder="automatic" onChange={(labelFill) => props.onVisual({ labelFill })} />
              <TextControl label="size legend" value={props.visual.labelSize} placeholder="automatic" onChange={(labelSize) => props.onVisual({ labelSize })} />
              <TextControl label="shape legend" value={props.visual.labelShape} placeholder="automatic" onChange={(labelShape) => props.onVisual({ labelShape })} />
              <TextControl label="linetype legend" value={props.visual.labelLinetype} placeholder="automatic" onChange={(labelLinetype) => props.onVisual({ labelLinetype })} />
              <TextControl label="linewidth legend" value={props.visual.labelLinewidth} placeholder="automatic" onChange={(labelLinewidth) => props.onVisual({ labelLinewidth })} />
              <TextControl label="opacity legend" value={props.visual.labelOpacity} placeholder="automatic" onChange={(labelOpacity) => props.onVisual({ labelOpacity })} />
            </div>
          </section>
          <section className="dwim-visual-section">
            <div className="dwim-section-label"><b>scales</b></div>
            <div className="dwim-scale-groups">
              <div><b>x</b><ChoiceSelect label="type" value={props.visual.scaleXType} options={scaleTypes} onChange={(scaleXType) => props.onVisual({ scaleXType })} /><ChoiceSelect label="transform" value={props.visual.scaleXTransform} options={transforms} onChange={(scaleXTransform) => props.onVisual({ scaleXTransform })} /><TextControl label="label format" value={props.visual.scaleXFormat} placeholder="%B %-d, %Y" onChange={(scaleXFormat) => props.onVisual({ scaleXFormat })} /></div>
              <div><b>y</b><ChoiceSelect label="type" value={props.visual.scaleYType} options={scaleTypes} onChange={(scaleYType) => props.onVisual({ scaleYType })} /><ChoiceSelect label="transform" value={props.visual.scaleYTransform} options={transforms} onChange={(scaleYTransform) => props.onVisual({ scaleYTransform })} /><TextControl label="label format" value={props.visual.scaleYFormat} placeholder=".1f" onChange={(scaleYFormat) => props.onVisual({ scaleYFormat })} /></div>
              <div><b>colour</b><ChoiceSelect label="type" value={props.visual.scaleColorType} options={scaleTypes} onChange={(scaleColorType) => props.onVisual({ scaleColorType })} /><ChoiceSelect label="palette" value={props.visual.scaleColorPalette} options={palettes} onChange={(scaleColorPalette) => props.onVisual({ scaleColorPalette })} /></div>
            </div>
          </section>
          <section className="dwim-visual-section">
            <div className="dwim-section-label"><b>facet + project</b></div>
            <div className="dwim-visual-grid">
              <FieldSelect label="facet" value={props.visual.facet} fields={props.visualFields} onChange={(facet) => props.onVisual({ facet })} />
              <FieldSelect label="facet by" value={props.visual.facetBy} fields={props.visualFields} onChange={(facetBy) => props.onVisual({ facetBy })} />
              <ChoiceSelect label="free scales" value={props.visual.facetFree} options={["", "x", "y"]} onChange={(facetFree) => props.onVisual({ facetFree })} />
              <TextControl label="wrap columns" type="number" min={1} max={12} value={props.visual.facetColumns} placeholder="auto" onChange={(facetColumns) => props.onVisual({ facetColumns })} />
              <ChoiceSelect label="coordinates" value={props.visual.project} options={projections} onChange={(project) => props.onVisual({ project })} />
              {props.visual.project === "crs" && <TextControl label="CRS target" value={props.visual.projectTarget} placeholder="EPSG:4326 or proj string" onChange={(projectTarget) => props.onVisual({ projectTarget })} />}
            </div>
          </section>
        </div>
      )}
    </aside>
  );
}

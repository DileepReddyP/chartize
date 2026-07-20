"use client";

import type { FieldMetadata } from "@chartize/contracts";
import { useEffect, type CSSProperties } from "react";
import { sourceAlias, type QuerySection, type VisualPointState } from "@/lib/ggsql/query-context";
import { fieldsForAesthetic, guidanceForMark, patchForMark, type VisualAesthetic } from "@/lib/ggsql/visual-guidance";
import type { WorkspaceSource } from "@/lib/workspace/view-model";

export type DwimSource = WorkspaceSource;

interface SourceTilesProps {
  sources: DwimSource[];
  activeSources: string[];
  onSource: (source: string, enabled: boolean) => void;
  onRemoveSource?: (tableName: string) => void;
  compact?: boolean;
  loading?: boolean;
}

export function SourceTiles({ sources, activeSources, onSource, onRemoveSource, compact, loading }: SourceTilesProps) {
  return (
    <div className={`dwim-source-tiles ${compact ? "compact" : ""}`} aria-busy={loading}>
      {sources.map((source) => {
        const active = activeSources.includes(source.id);
        return (
          <div key={source.id} className={`dwim-source-tile ${active ? "active" : ""}`}>
            <button
              type="button"
              className="dwim-source-choice"
              aria-pressed={active}
              disabled={source.disabled && !active}
              title={source.disabled ? "A query cannot mix published and browser-only sources." : source.description}
              onClick={() => onSource(source.id, !active)}
            >
              <span>{active ? "✓" : "+"}</span>
              <strong>{source.title}</strong>
              <small>{source.namespace}: {source.rows === undefined ? "browser" : `${source.rows.toLocaleString()} rows`}</small>
            </button>
            {source.namespace === "user" && onRemoveSource && (
              <button
                className="dwim-source-remove"
                type="button"
                title={`Remove ${source.title} from this browser`}
                aria-label={`Remove ${source.title} from this browser`}
                onClick={() => onRemoveSource(source.id.slice("user:".length))}
              >×</button>
            )}
          </div>
        );
      })}
      {loading && <div className="source-tiles-loading" role="status"><span className="spinner" /><span>loading data sources…</span></div>}
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
  onPromoteAi: (origin: HTMLElement) => void;
  onClose: () => void;
}

const marks = [
  "point", "line", "path", "segment", "rule", "area", "ribbon", "polygon", "text",
  "bar", "histogram", "density", "violin", "boxplot", "range", "smooth", "spatial", "tile",
];
const primaryMarks = ["line", "bar", "point", "area", "ribbon", "spatial"];
const secondaryMarks = marks.filter((mark) => !primaryMarks.includes(mark));
const positions = ["identity", "stack", "dodge", "jitter"];
const scaleTypes = ["", "continuous", "discrete", "binned", "ordinal", "identity"];
const transforms = ["", "date", "log10", "sqrt", "reverse"];
const palettes = ["", "ggsql", "tableau10", "viridis", "kelly22", "greys", "ylgnbu", "bugn", "rdpu", "batlow", "hawaii", "roma", "vik", "turku"];
const projections = ["", "cartesian", "polar", "mercator", "orthographic", "equalearth", "albers", "lambert", "crs"];
const smoothMethods = ["", "nw", "ols", "tls"];
const smoothKernels = ["", "gaussian", "epanechnikov", "triangular", "rectangular", "biweight", "cosine"];
const lineTypes = ["", "solid", "dashed", "dotted", "dotdash"];

function FieldSelect({ label, value, fields, aesthetic, mark, onChange }: {
  label: string;
  value: string;
  fields: FieldMetadata[];
  aesthetic?: VisualAesthetic;
  mark?: string;
  onChange: (value: string) => void;
}) {
  const available = aesthetic ? fieldsForAesthetic(fields, aesthetic, mark ?? "") : fields;
  return (
    <label className="dwim-field">
      <span>{label}</span>
      <select name={`visual-${label.toLocaleLowerCase().replace(/\s+/g, "-")}`} value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">none</option>
        {available.map((field) => <option key={field.name} value={field.name}>{field.name}</option>)}
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

function ColorControl({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const color = /^#[0-9a-f]{6}$/i.test(value) ? value : "#3cbbb1";
  return (
    <label className={`dwim-field dwim-color-field ${value ? "" : "automatic"}`}>
      <span>{label}</span>
      <span className="native-color-control">
        <input name={`visual-${label.toLocaleLowerCase().replace(/\s+/g, "-")}`} type="color" value={color} onChange={(event) => onChange(event.target.value)} />
        <output>{value || "automatic"}</output>
        {value && <button type="button" title={`Reset ${label}`} aria-label={`Reset ${label}`} onClick={() => onChange("")}>×</button>}
      </span>
    </label>
  );
}

function InspectorSectionHeading({ index, title, value }: { index: string; title: string; value?: string }) {
  return (
    <header className="dwim-section-heading">
      <b><span>{index}</span>{title}</b>
      {value && <small>{value}</small>}
    </header>
  );
}

export function DwimPanel(props: DwimPanelProps) {
  const copy = props.section === "selection"
    ? { index: "03", eyebrow: "selected range", title: "selected code", placeholder: "Change or explain this selection…" }
    : props.section === "visual"
      ? { index: "02", eyebrow: "visual context", title: "visualise at point", placeholder: "Describe the visual change you mean…" }
      : { index: "01", eyebrow: "data context", title: "sql at point", placeholder: "Describe the data operation you mean…" };
  const style = { "--dwim-left": `${props.position.left}px`, "--dwim-top": `${props.position.top}px` } as CSSProperties;
  const primaryAesthetic = ["spatial", "bar", "area", "polygon", "tile"].includes(props.visual.mark)
    ? "fill"
    : ["ribbon", "range", "segment", "rule"].includes(props.visual.mark) ? "" : "colour";
  const fillForwardMark = ["spatial", "bar", "area", "ribbon", "polygon", "tile"].includes(props.visual.mark);
  const guidance = guidanceForMark(props.visual.mark, props.visual, props.visualFields);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented) props.onClose();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [props.onClose]);

  const chooseMark = (mark: string) => props.onVisual(patchForMark(mark, props.visual, props.visualFields));

  return (
    <aside className={`dwim-panel section-${props.section}`} style={style} aria-label={`${copy.title} actions`}>
      <header className="dwim-heading" data-index={copy.index}>
        <div><span>{copy.eyebrow}</span><h2>{copy.title}</h2></div>
        <button type="button" onClick={props.onClose} aria-label="Close contextual actions">×</button>
      </header>

      <label className="dwim-command ai-promoter">
        <span aria-hidden="true">✦</span>
        <input name={`dwim-ai-${props.section}`} readOnly value="" placeholder={copy.placeholder} aria-label={copy.placeholder} onFocus={(event) => props.onPromoteAi(event.currentTarget)} />
        <b>ask</b>
      </label>
      {props.status && <p className="dwim-status" role="status">{props.status}</p>}

      {props.section === "selection" && (
        <div className="dwim-selection">
          <InspectorSectionHeading index="01" title="selection" value={`${props.selectedText.length} characters`} />
          <pre>{props.selectedText}</pre>
          <div className="dwim-selection-actions">
            <button type="button" onClick={() => void navigator.clipboard.writeText(props.selectedText)}>copy selection</button>
            <button type="button" onClick={props.onRunSelection}>run full query</button>
          </div>
        </div>
      )}

      {props.section === "sql" && (
        <div className="dwim-body sql-controls">
          <section className="dwim-source-section">
            <InspectorSectionHeading index="01" title="sources" value={`${props.activeSources.length} selected`} />
            <SourceTiles sources={props.sources} activeSources={props.activeSources} onSource={props.onSource} loading={props.catalogLoading} />
            <label className="dwim-upload">
              <input name="user-datasets" type="file" multiple accept=".csv,.tsv,.json,.ndjson,.parquet,.geoparquet,.geojson,.zip" onChange={(event) => event.target.files && props.onFiles(event.target.files)} />
              <span>＋ add user dataset</span><small>csv · parquet · geojson</small>
            </label>
          </section>
          <section className="dwim-column-section">
            <InspectorSectionHeading index="02" title="columns" value={`${props.selectedFields.size} selected`} />
            <div className="dwim-column-section-body">
              <ColumnPicker sources={props.sources} activeSources={props.activeSources} selectedFields={props.selectedFields} onColumn={props.onColumn} onRemoveColumn={props.onRemoveColumn} />
            </div>
          </section>
        </div>
      )}

      {props.section === "visual" && (
        <div className="dwim-body visual-controls">
          <section className="visual-primary-section visual-title-section">
            <InspectorSectionHeading index="01" title="title + subtitle" value={props.visual.title || "automatic"} />
            <div className="visual-primary-grid visual-title-grid">
              <TextControl label="title" value={props.visual.title} placeholder="chart title" onChange={(title) => props.onVisual({ title })} />
              <TextControl label="subtitle" value={props.visual.subtitle} placeholder="chart subtitle" onChange={(subtitle) => props.onVisual({ subtitle })} />
            </div>
          </section>

          <section className="visual-primary-section visual-mark-section">
            <InspectorSectionHeading index="02" title="mark" value={props.visual.mark} />
            <div className="visual-primary-marks">
              {primaryMarks.map((mark) => <button key={mark} type="button" className={props.visual.mark === mark ? "active" : ""} onClick={() => chooseMark(mark)}>{mark}</button>)}
            </div>
            <details className="visual-inline-disclosure">
              <summary><span>more marks</span><b>{secondaryMarks.includes(props.visual.mark) ? props.visual.mark : `${secondaryMarks.length} available`}</b></summary>
              <div className="visual-secondary-marks">
                {secondaryMarks.map((mark) => <button key={mark} type="button" className={props.visual.mark === mark ? "active" : ""} onClick={() => chooseMark(mark)}>{mark}</button>)}
              </div>
            </details>
            {(guidance.tone === "attention" || guidance.summary !== "channels use SQL output") && (
              <div className={`visual-requirement ${guidance.tone}`}>
                <span aria-hidden="true">{guidance.tone === "ready" ? "✓" : "!"}</span>
                <div><b>{guidance.summary}</b><p>{guidance.detail}</p></div>
                {guidance.patch && guidance.action && <button type="button" onClick={() => props.onVisual(guidance.patch!)}>{guidance.action}</button>}
              </div>
            )}
          </section>

          <section className="visual-primary-section">
            <InspectorSectionHeading index="03" title="channels" value="source columns here taken from sql query" />
            <div className="visual-primary-grid visual-channel-grid">
              {props.visual.mark === "spatial" ? (
                <>
                  <FieldSelect label="geometry" value={props.visual.geometry} fields={props.visualFields} aesthetic="geometry" mark={props.visual.mark} onChange={(geometry) => props.onVisual({ geometry })} />
                  <FieldSelect label="fill" value={props.visual.fill} fields={props.visualFields} aesthetic="fill" mark={props.visual.mark} onChange={(fill) => props.onVisual({ fill })} />
                  <FieldSelect label="colour" value={props.visual.color} fields={props.visualFields} aesthetic="color" mark={props.visual.mark} onChange={(color) => props.onVisual({ color })} />
                </>
              ) : (
                <>
                  <FieldSelect label="x channel" value={props.visual.x} fields={props.visualFields} aesthetic="x" mark={props.visual.mark} onChange={(x) => props.onVisual({ x })} />
                  <TextControl label="x label" value={props.visual.labelX} placeholder="automatic" onChange={(labelX) => props.onVisual({ labelX })} />
                  {props.visual.mark === "ribbon"
                    ? <><FieldSelect label="y min" value={props.visual.yMin} fields={props.visualFields} aesthetic="yMin" mark={props.visual.mark} onChange={(yMin) => props.onVisual({ yMin })} /><FieldSelect label="y max" value={props.visual.yMax} fields={props.visualFields} aesthetic="yMax" mark={props.visual.mark} onChange={(yMax) => props.onVisual({ yMax })} /></>
                    : !["histogram", "density"].includes(props.visual.mark) && <FieldSelect label="y channel" value={props.visual.y} fields={props.visualFields} aesthetic="y" mark={props.visual.mark} onChange={(y) => props.onVisual({ y })} />}
                  <TextControl label="y label" value={props.visual.labelY} placeholder="automatic" onChange={(labelY) => props.onVisual({ labelY })} />
                  {props.visual.mark === "segment" && <><FieldSelect label="x end" value={props.visual.xEnd} fields={props.visualFields} aesthetic="xEnd" mark={props.visual.mark} onChange={(xEnd) => props.onVisual({ xEnd })} /><FieldSelect label="y end" value={props.visual.yEnd} fields={props.visualFields} aesthetic="yEnd" mark={props.visual.mark} onChange={(yEnd) => props.onVisual({ yEnd })} /></>}
                  {props.visual.mark === "range" && <><FieldSelect label="x min" value={props.visual.xMin} fields={props.visualFields} aesthetic="xMin" mark={props.visual.mark} onChange={(xMin) => props.onVisual({ xMin })} /><FieldSelect label="x max" value={props.visual.xMax} fields={props.visualFields} aesthetic="xMax" mark={props.visual.mark} onChange={(xMax) => props.onVisual({ xMax })} /><FieldSelect label="y min" value={props.visual.yMin} fields={props.visualFields} aesthetic="yMin" mark={props.visual.mark} onChange={(yMin) => props.onVisual({ yMin })} /><FieldSelect label="y max" value={props.visual.yMax} fields={props.visualFields} aesthetic="yMax" mark={props.visual.mark} onChange={(yMax) => props.onVisual({ yMax })} /></>}
                  {props.visual.mark === "rule" && <FieldSelect label="slope" value={props.visual.slope} fields={props.visualFields} aesthetic="slope" mark={props.visual.mark} onChange={(slope) => props.onVisual({ slope })} />}
                  {primaryAesthetic === "colour" && <FieldSelect label="colour" value={props.visual.color} fields={props.visualFields} aesthetic="color" mark={props.visual.mark} onChange={(color) => props.onVisual({ color })} />}
                  {primaryAesthetic === "fill" && <FieldSelect label="fill" value={props.visual.fill} fields={props.visualFields} aesthetic="fill" mark={props.visual.mark} onChange={(fill) => props.onVisual({ fill })} />}
                </>
              )}
            </div>
            <details className="visual-inline-disclosure">
              <summary><span>more encodings</span><b>optional</b></summary>
              <div className="visual-primary-grid visual-optional-grid">
                {primaryAesthetic !== "colour" && <FieldSelect label="colour" value={props.visual.color} fields={props.visualFields} aesthetic="color" mark={props.visual.mark} onChange={(color) => props.onVisual({ color })} />}
                {primaryAesthetic !== "fill" && <FieldSelect label="fill" value={props.visual.fill} fields={props.visualFields} aesthetic="fill" mark={props.visual.mark} onChange={(fill) => props.onVisual({ fill })} />}
                <FieldSelect label="size" value={props.visual.size} fields={props.visualFields} aesthetic="size" mark={props.visual.mark} onChange={(size) => props.onVisual({ size })} />
                <FieldSelect label="shape" value={props.visual.shape} fields={props.visualFields} aesthetic="shape" mark={props.visual.mark} onChange={(shape) => props.onVisual({ shape })} />
                <FieldSelect label="linetype" value={props.visual.linetype} fields={props.visualFields} aesthetic="linetype" mark={props.visual.mark} onChange={(linetype) => props.onVisual({ linetype })} />
                <FieldSelect label="linewidth" value={props.visual.linewidth} fields={props.visualFields} aesthetic="linewidth" mark={props.visual.mark} onChange={(linewidth) => props.onVisual({ linewidth })} />
                <FieldSelect label="opacity" value={props.visual.opacityField} fields={props.visualFields} aesthetic="opacity" mark={props.visual.mark} onChange={(opacityField) => props.onVisual({ opacityField })} />
                {props.visual.mark === "smooth" && <FieldSelect label="weight" value={props.visual.weight} fields={props.visualFields} aesthetic="weight" mark={props.visual.mark} onChange={(weight) => props.onVisual({ weight })} />}
              </div>
            </details>
          </section>

          <section className="visual-primary-section">
            <InspectorSectionHeading index="04" title="style" value={fillForwardMark ? "fill" : "stroke"} />
            <div className="visual-primary-grid">
              {fillForwardMark
                ? <ColorControl label="fixed fill" value={props.visual.fixedFill} onChange={(fixedFill) => props.onVisual({ fixedFill })} />
                : <ColorControl label="fixed colour" value={props.visual.fixedColour} onChange={(fixedColour) => props.onVisual({ fixedColour })} />}
              <TextControl label="opacity" type="number" min={0} max={1} step={0.05} value={props.visual.opacity} onChange={(opacity) => props.onVisual({ opacity })} />
              {fillForwardMark
                ? <ChoiceSelect label="position" value={props.visual.position} options={positions} onChange={(position) => props.onVisual({ position })} />
                : <TextControl label="line width" type="number" min={0} step={0.25} value={props.visual.fixedLinewidth} onChange={(fixedLinewidth) => props.onVisual({ fixedLinewidth })} />}
            </div>
            <details className="visual-inline-disclosure">
              <summary><span>more styling</span><b>appearance</b></summary>
              <div className="visual-primary-grid visual-optional-grid">
                <ChoiceSelect label="position" value={props.visual.position} options={positions} onChange={(position) => props.onVisual({ position })} />
                <ColorControl label="fixed colour" value={props.visual.fixedColour} onChange={(fixedColour) => props.onVisual({ fixedColour })} />
                <ColorControl label="fixed fill" value={props.visual.fixedFill} onChange={(fixedFill) => props.onVisual({ fixedFill })} />
                <TextControl label="fixed size" type="number" min={0} value={props.visual.fixedSize} onChange={(fixedSize) => props.onVisual({ fixedSize })} />
                <TextControl label="line width" type="number" min={0} step={0.25} value={props.visual.fixedLinewidth} onChange={(fixedLinewidth) => props.onVisual({ fixedLinewidth })} />
                <ChoiceSelect label="line type" value={props.visual.fixedLinetype} options={lineTypes} onChange={(fixedLinetype) => props.onVisual({ fixedLinetype })} />
                <TextControl label="series label" value={props.visual.colourLegendValue} placeholder="legend label" onChange={(colourLegendValue) => props.onVisual({ colourLegendValue })} />
                <TextControl label="fill label" value={props.visual.fillLegendValue} placeholder="legend label" onChange={(fillLegendValue) => props.onVisual({ fillLegendValue })} />
              </div>
            </details>
          </section>

          {props.visual.mark === "smooth" && (
            <section className="visual-primary-section visual-model-section">
              <InspectorSectionHeading index="M" title="model" value={props.visual.smoothMethod || "automatic"} />
              <div className="visual-primary-grid">
                <ChoiceSelect label="method" value={props.visual.smoothMethod} options={smoothMethods} onChange={(smoothMethod) => props.onVisual({ smoothMethod })} />
                <TextControl label="adjust" type="number" min={0.01} step={0.05} value={props.visual.smoothAdjust} placeholder="1" onChange={(smoothAdjust) => props.onVisual({ smoothAdjust })} />
                <TextControl label="bandwidth" type="number" min={0.01} step={0.05} value={props.visual.smoothBandwidth} placeholder="automatic" onChange={(smoothBandwidth) => props.onVisual({ smoothBandwidth })} />
                <ChoiceSelect label="kernel" value={props.visual.smoothKernel} options={smoothKernels} onChange={(smoothKernel) => props.onVisual({ smoothKernel })} />
              </div>
            </section>
          )}

          <details className="visual-disclosure">
            <summary><span><i>05</i>legends</span><b>{[props.visual.labelColor, props.visual.labelFill, props.visual.labelSize].filter(Boolean).join(" · ") || "automatic"}</b></summary>
            <div className="visual-disclosure-body labels-grid">
              <TextControl label="colour legend" value={props.visual.labelColor} placeholder="automatic" onChange={(labelColor) => props.onVisual({ labelColor })} />
              <TextControl label="fill legend" value={props.visual.labelFill} placeholder="automatic" onChange={(labelFill) => props.onVisual({ labelFill })} />
              <TextControl label="size legend" value={props.visual.labelSize} placeholder="automatic" onChange={(labelSize) => props.onVisual({ labelSize })} />
              <TextControl label="shape legend" value={props.visual.labelShape} placeholder="automatic" onChange={(labelShape) => props.onVisual({ labelShape })} />
              <TextControl label="linetype legend" value={props.visual.labelLinetype} placeholder="automatic" onChange={(labelLinetype) => props.onVisual({ labelLinetype })} />
              <TextControl label="linewidth legend" value={props.visual.labelLinewidth} placeholder="automatic" onChange={(labelLinewidth) => props.onVisual({ labelLinewidth })} />
              <TextControl label="opacity legend" value={props.visual.labelOpacity} placeholder="automatic" onChange={(labelOpacity) => props.onVisual({ labelOpacity })} />
            </div>
          </details>

          <details className="visual-disclosure">
            <summary><span><i>06</i>scales + format</span><b>{[props.visual.scaleXTransform, props.visual.scaleYTransform, props.visual.scaleColorPalette].filter(Boolean).join(" · ") || "automatic"}</b></summary>
            <div className="dwim-scale-groups">
              <div><b>x</b><ChoiceSelect label="type" value={props.visual.scaleXType} options={scaleTypes} onChange={(scaleXType) => props.onVisual({ scaleXType })} /><ChoiceSelect label="transform" value={props.visual.scaleXTransform} options={transforms} onChange={(scaleXTransform) => props.onVisual({ scaleXTransform })} /><TextControl label="label format" value={props.visual.scaleXFormat} placeholder="%B %-d, %Y" onChange={(scaleXFormat) => props.onVisual({ scaleXFormat })} /></div>
              <div><b>y</b><ChoiceSelect label="type" value={props.visual.scaleYType} options={scaleTypes} onChange={(scaleYType) => props.onVisual({ scaleYType })} /><ChoiceSelect label="transform" value={props.visual.scaleYTransform} options={transforms} onChange={(scaleYTransform) => props.onVisual({ scaleYTransform })} /><TextControl label="label format" value={props.visual.scaleYFormat} placeholder=".1f" onChange={(scaleYFormat) => props.onVisual({ scaleYFormat })} /></div>
              <div><b>colour</b><ChoiceSelect label="type" value={props.visual.scaleColorType} options={scaleTypes} onChange={(scaleColorType) => props.onVisual({ scaleColorType })} /><ChoiceSelect label="palette" value={props.visual.scaleColorPalette} options={palettes} onChange={(scaleColorPalette) => props.onVisual({ scaleColorPalette })} /></div>
            </div>
          </details>

          <details className="visual-disclosure">
            <summary><span><i>07</i>layout + projection</span><b>{props.visual.project || props.visual.facet || "none"}</b></summary>
            <div className="visual-disclosure-body">
              <FieldSelect label="facet" value={props.visual.facet} fields={props.visualFields} aesthetic="facet" mark={props.visual.mark} onChange={(facet) => props.onVisual({ facet })} />
              <FieldSelect label="facet by" value={props.visual.facetBy} fields={props.visualFields} aesthetic="facet" mark={props.visual.mark} onChange={(facetBy) => props.onVisual({ facetBy })} />
              <ChoiceSelect label="free scales" value={props.visual.facetFree} options={["", "x", "y"]} onChange={(facetFree) => props.onVisual({ facetFree })} />
              <TextControl label="wrap columns" type="number" min={1} max={12} value={props.visual.facetColumns} placeholder="auto" onChange={(facetColumns) => props.onVisual({ facetColumns })} />
              <ChoiceSelect label="coordinates" value={props.visual.project} options={projections} onChange={(project) => props.onVisual({ project })} />
              {props.visual.project === "crs" && <TextControl label="CRS target" value={props.visual.projectTarget} placeholder="EPSG:4326 or proj string" onChange={(projectTarget) => props.onVisual({ projectTarget })} />}
            </div>
          </details>
        </div>
      )}
    </aside>
  );
}

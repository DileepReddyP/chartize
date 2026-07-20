import type { FieldMetadata, TablePreview } from "@chartize/contracts";
import { z } from "zod";

export const MAX_VISUAL_ITEM_SELECTIONS = 500;

export const VisualItemSelectionSchema = z.object({
  key: z.string().min(1).max(1000),
  pixels: z.object({ x: z.number().nonnegative(), y: z.number().nonnegative() }),
  title: z.string().min(1).max(500),
  values: z.array(z.object({ field: z.string().min(1).max(300), value: z.string().max(1000) })).max(16),
  rowIndex: z.number().int().nonnegative().optional(),
});

export type VisualItemSelection = z.infer<typeof VisualItemSelectionSchema>;
// Persisted workspaces still use the original property name. Keep these
// aliases while the selection itself is shared by maps and ordinary marks.
export const MapFeatureSelectionSchema = VisualItemSelectionSchema;
export type MapFeatureSelection = VisualItemSelection;

interface ChartSelection {
  x?: [unknown, unknown];
  y?: [unknown, unknown];
}

function mapFeatureValue(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "number") {
    return Number.isInteger(value)
      ? value.toLocaleString("en-US")
      : value.toLocaleString("en-US", { maximumFractionDigits: 3 });
  }
  if (typeof value === "string" || typeof value === "boolean") return String(value);
  return "";
}

function mapFieldPriority(field: string, value: unknown) {
  if (/^(?:name|namelsad|geoname|locationname|county|county_name|place|place_name|area|area_name)$/i.test(field)) return 100;
  if (/^(?:state|state_name|region|region_name)$/i.test(field)) return 90;
  if (/(?:geoid|fips|statefp|countyfp|postal|abbr|code|id)$/i.test(field)) return 80;
  if (/label|title/i.test(field)) return 60;
  return typeof value === "string" ? 30 : 20;
}

function recordSelection(
  datum: Record<string, unknown>,
  pixels: { x: number; y: number },
  rowIndex?: number,
  fallbackTitle = "selected data point",
): VisualItemSelection | null {
  const geographyName = /^(?:name|namelsad|geoname|locationname|county|county_name|place|place_name|area|area_name|state|state_name|region|region_name)$/i;
  const candidates = Object.entries(datum)
    .filter(([field, value]) => (
      !field.startsWith("__ggsql_")
      && !/^(?:geometry|geom|wkb|geojson)$/i.test(field)
      && !(field === "type" && /^(?:feature|featurecollection|polygon|multipolygon)$/i.test(String(value)))
      && !/^(?:label_)?(?:lon|lat|longitude|latitude)$/i.test(field)
      && (value instanceof Date || ["string", "number", "boolean"].includes(typeof value))
      && value !== ""
      && value !== null
      && value !== undefined
    ))
    .map(([field, value], index) => ({ field, value, index, priority: mapFieldPriority(field, value) }))
    .sort((left, right) => right.priority - left.priority || left.index - right.index)
    .slice(0, 16)
    .map(({ field, value }) => ({ field, value: mapFeatureValue(value) }))
    .filter((entry) => entry.value !== "");
  if (!candidates.length) return null;
  const title = candidates.find((entry) => geographyName.test(entry.field))?.value
    ?? candidates.find((entry) => !/^\d+(?:\.\d+)?$/.test(entry.value))?.value
    ?? candidates.slice(0, 2).map(({ field, value }) => `${field.replaceAll("_", " ")} ${value}`).join(" · ")
    ?? fallbackTitle;
  return VisualItemSelectionSchema.parse({
    key: rowIndex === undefined
      ? candidates.map(({ field, value }) => `${field}:${value}`).join("|").slice(0, 1000)
      : `row:${rowIndex}`,
    pixels,
    title,
    values: candidates,
    ...(rowIndex === undefined ? {} : { rowIndex }),
  });
}

export function mapFeatureSelectionFromTableRow(
  columns: string[],
  row: unknown[],
  pixels: { x: number; y: number },
  rowIndex?: number,
) {
  return recordSelection(Object.fromEntries(columns.map((column, index) => [column, row[index]])), pixels, rowIndex, "selected map feature");
}

export function visualItemSelectionFromTableRow(
  columns: string[],
  row: unknown[],
  pixels: { x: number; y: number },
  rowIndex?: number,
) {
  return recordSelection(Object.fromEntries(columns.map((column, index) => [column, row[index]])), pixels, rowIndex);
}

/** Convert a Vega spatial mark datum into a small, human-readable place record. */
export function mapFeatureSelectionFromDatum(
  input: unknown,
  pixels: { x: number; y: number },
  table?: Pick<TablePreview, "columns" | "rows">,
): MapFeatureSelection | null {
  return visualItemSelectionFromDatum(input, pixels, table, true);
}

/** Convert a Vega mark datum into compact context for a point, bar, line sample, range, or place. */
export function visualItemSelectionFromDatum(
  input: unknown,
  pixels: { x: number; y: number },
  table?: Pick<TablePreview, "columns" | "rows">,
  mapMode = false,
): VisualItemSelection | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  let datum = input as Record<string, unknown>;
  if (datum.datum && typeof datum.datum === "object" && !Array.isArray(datum.datum)) {
    datum = datum.datum as Record<string, unknown>;
  }
  const rawRowIndex = datum.__ggsql_row_index__;
  const parsedRowIndex = typeof rawRowIndex === "string" && /^\d+$/.test(rawRowIndex)
    ? Number(rawRowIndex)
    : rawRowIndex;
  const rowIndex = typeof parsedRowIndex === "number" && Number.isInteger(parsedRowIndex) && parsedRowIndex >= 0
    ? parsedRowIndex
    : undefined;
  if (rowIndex !== undefined && table?.rows[rowIndex]) {
    const hydrated = (mapMode ? mapFeatureSelectionFromTableRow : visualItemSelectionFromTableRow)(table.columns, table.rows[rowIndex]!, pixels, rowIndex);
    if (hydrated) return hydrated;
  }
  const direct = recordSelection(datum, pixels, rowIndex, mapMode ? "selected map feature" : "selected data point");
  if (direct) return direct;
  return null;
}

/** The selected map rows are already present in the rendered relation. */
export function tableFromMapFeatureSelections(selections: MapFeatureSelection[]): TablePreview | null {
  return tableFromVisualItemSelections(selections);
}

export function tableFromVisualItemSelections(selections: VisualItemSelection[]): TablePreview | null {
  if (!selections.length) return null;
  const columns = [...new Set(selections.flatMap((selection) => selection.values.map(({ field }) => field)))];
  return {
    columns,
    rows: selections.map((selection) => {
      const values = new Map(selection.values.map(({ field, value }) => [field, value]));
      return columns.map((column) => values.get(column) ?? "");
    }),
    totalRows: selections.length,
    offset: 0,
    limit: selections.length,
  };
}

function labelText(value: unknown) {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && value.every((item) => typeof item === "string")) return value.join(" ");
  return undefined;
}

export function presentationFromSpec(spec: Record<string, unknown>) {
  if (typeof spec.title === "string") return { title: spec.title, subtitle: "" };
  if (!spec.title || typeof spec.title !== "object" || Array.isArray(spec.title)) return {};
  const title = spec.title as { text?: unknown; subtitle?: unknown };
  return { title: labelText(title.text), subtitle: labelText(title.subtitle) ?? "" };
}

export function previewFromSpec(spec: Record<string, unknown>): TablePreview {
  const data = spec.data as { values?: Array<Record<string, unknown>> } | undefined;
  const values = data?.values ?? [];
  if (!values.length) return { columns: [], rows: [], totalRows: 0, offset: 0, limit: 200 };
  const columns = Object.keys(values[0]!).filter((column) => !column.startsWith("__ggsql_") && column !== "geometry");
  return {
    columns,
    rows: values.slice(0, 200).map((row) => columns.map((column) => typeof row[column] === "object" ? JSON.stringify(row[column]) : String(row[column] ?? ""))),
    totalRows: values.length,
    offset: 0,
    limit: 200,
  };
}

function inferredField(name: string, values: string[]): FieldMetadata {
  const present = values.filter((value) => value.trim() !== "");
  const numeric = present.length > 0 && present.every((value) => Number.isFinite(Number(value)));
  const temporal = present.length > 0 && present.every((value) => /^\d{4}-\d{2}-\d{2}(?:[T\s].*)?$/.test(value));
  const boolean = present.length > 0 && present.every((value) => /^(?:true|false)$/i.test(value));
  return {
    name,
    dataType: temporal ? "DATE" : numeric ? "DOUBLE" : boolean ? "BOOLEAN" : "VARCHAR",
    nullable: true,
    semanticType: /geometry/i.test(name) ? "geometry" : temporal ? "temporal" : numeric ? "measure" : undefined,
  };
}

export function visualFieldsFromPreview(
  sourceFields: FieldMetadata[],
  preview: TablePreview,
  projectedFields?: string[],
): FieldMetadata[] {
  const byName = new Map(sourceFields.map((field) => [field.name, field]));
  preview.columns.forEach((name, columnIndex) => {
    if (byName.has(name)) return;
    const values = preview.rows.slice(0, 40).map((row) => row[columnIndex] ?? "");
    byName.set(name, inferredField(name, values));
  });
  if (!projectedFields) return [...byName.values()];
  const names = projectedFields.includes("*") ? preview.columns : projectedFields;
  return names.flatMap((name) => {
    const field = byName.get(name);
    return field ? [field] : [];
  });
}

export function selectionTableFromSpec(spec: Record<string, unknown> | null): TablePreview | null {
  if (!spec) return null;
  const data = spec.data as { values?: Array<Record<string, unknown>> } | undefined;
  const values = data?.values ?? [];
  if (!values.length) return null;
  // GGSQL rewrites mapped aesthetics to positional Vega fields. Preserve
  // those fields for accurate selection counts while hiding bookkeeping.
  // Layered views repeat the analytical rows once per mark, so choose the
  // first substantial x/y layer instead of telling AI the chart has N times
  // as many observations as it actually does.
  const byLayer = new Map<string, Array<Record<string, unknown>>>();
  values.forEach((row) => {
    const source = typeof row.__ggsql_source__ === "string" ? row.__ggsql_source__ : "__chartize_default__";
    const layer = byLayer.get(source) ?? [];
    layer.push(row);
    byLayer.set(source, layer);
  });
  const positionalRows = (rows: Array<Record<string, unknown>>) => rows.reduce((count, row) =>
    count + (row.__ggsql_aes_pos1__ != null && row.__ggsql_aes_pos2__ != null ? 1 : 0), 0);
  const layerValues = [...byLayer.values()].sort((left, right) =>
    positionalRows(right) - positionalRows(left) || right.length - left.length)[0] ?? values;
  const columns = Object.keys(layerValues[0]!).filter((column) =>
    (!column.startsWith("__ggsql_") || column.startsWith("__ggsql_aes_")) && column !== "geometry");
  return {
    columns,
    rows: layerValues.map((row) => columns.map((column) => typeof row[column] === "object" ? JSON.stringify(row[column]) : String(row[column] ?? ""))),
    totalRows: layerValues.length,
    offset: 0,
    limit: layerValues.length,
  };
}

export function normalizeDomainValue(value: unknown) {
  return value instanceof Date ? value.toISOString() : value;
}

export function centeredDomain(domain: [unknown, unknown] | undefined, factor: number): [unknown, unknown] | undefined {
  if (!domain) return undefined;
  const temporal = domain.some((value) => value instanceof Date)
    || domain.every((value) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value));
  const values = domain.map((value) => temporal ? new Date(String(value)).getTime() : Number(value));
  if (!values.every(Number.isFinite) || values[0] === values[1]) return undefined;
  const center = (values[0]! + values[1]!) / 2;
  const half = Math.abs(values[1]! - values[0]!) * factor / 2;
  const output: [number, number] = [center - half, center + half];
  return temporal ? output.map((value) => new Date(value).toISOString()) as [string, string] : output;
}

export function shiftedDomain(domain: [unknown, unknown] | undefined, fraction: number): [unknown, unknown] | undefined {
  if (!domain || !Number.isFinite(fraction)) return undefined;
  const temporal = domain.some((value) => value instanceof Date)
    || domain.every((value) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value));
  const values = domain.map((value) => temporal ? new Date(String(value)).getTime() : Number(value));
  if (!values.every(Number.isFinite) || values[0] === values[1]) return undefined;
  const offset = (values[1]! - values[0]!) * fraction;
  const output: [number, number] = [values[0]! + offset, values[1]! + offset];
  return temporal ? output.map((value) => new Date(value).toISOString()) as [string, string] : output;
}

function compactExtentValue(value: unknown, temporal: boolean) {
  if (temporal) {
    const timestamp = value instanceof Date ? value.getTime() : Date.parse(String(value));
    return Number.isFinite(timestamp) ? new Date(timestamp).toISOString().slice(0, 10) : String(value);
  }
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return String(value);
  return Math.abs(numeric) >= 1_000
    ? Math.round(numeric).toLocaleString("en-US")
    : Number(numeric.toFixed(2)).toLocaleString("en-US");
}

/** A small derived summary gives AI the visible chart extent without attaching raw rows. */
export function describeChartExtent(
  data: TablePreview,
  xField: string,
  yField: string,
  fields: FieldMetadata[],
  xLabel = xField,
  yLabel = yField,
) {
  const describe = (fieldName: string, label: string) => {
    const positional = fieldName === xField ? "__ggsql_aes_pos1__" : fieldName === yField ? "__ggsql_aes_pos2__" : "";
    const direct = data.columns.indexOf(fieldName);
    const index = direct >= 0 ? direct : positional ? data.columns.indexOf(positional) : -1;
    if (index < 0) return "";
    const field = fields.find((candidate) => candidate.name === fieldName);
    const raw = data.rows.map((row) => row[index]).filter((value) => value !== null && value !== undefined && value !== "");
    if (!raw.length) return "";
    const temporal = field?.semanticType === "temporal"
      || raw.every((value) => /^\d{4}-\d{2}-\d{2}/.test(String(value)));
    const comparable = raw.map((value) => temporal ? Date.parse(String(value)) : Number(value));
    if (!comparable.every(Number.isFinite)) return "";
    const minimumIndex = comparable.indexOf(Math.min(...comparable));
    const maximumIndex = comparable.indexOf(Math.max(...comparable));
    return `${label || fieldName} spans ${compactExtentValue(raw[minimumIndex], temporal)} to ${compactExtentValue(raw[maximumIndex], temporal)}`;
  };
  const details = [describe(xField, xLabel), describe(yField, yLabel)].filter(Boolean);
  const directXIndex = data.columns.indexOf(xField);
  const directYIndex = data.columns.indexOf(yField);
  const xIndex = directXIndex >= 0 ? directXIndex : data.columns.indexOf("__ggsql_aes_pos1__");
  const yIndex = directYIndex >= 0 ? directYIndex : data.columns.indexOf("__ggsql_aes_pos2__");
  let movement = "";
  if (xIndex >= 0 && yIndex >= 0) {
    const temporalX = fields.find((candidate) => candidate.name === xField)?.semanticType === "temporal"
      || data.rows.every((row) => !row[xIndex] || /^\d{4}-\d{2}-\d{2}/.test(String(row[xIndex])));
    const ordered = data.rows
      .map((row, index) => ({
        index,
        x: temporalX ? Date.parse(String(row[xIndex])) : Number(row[xIndex]),
        y: Number(row[yIndex]),
      }))
      .filter((point) => Number.isFinite(point.y));
    if (ordered.length > 1) {
      if (ordered.every((point) => Number.isFinite(point.x))) ordered.sort((left, right) => left.x - right.x || left.index - right.index);
      const first = ordered[0]!.y;
      const last = ordered.at(-1)!.y;
      const change = last - first;
      movement = `${yLabel || yField} moves from ${compactExtentValue(first, false)} to ${compactExtentValue(last, false)} (${change >= 0 ? "+" : ""}${compactExtentValue(change, false)})`;
    }
  }
  const count = data.totalRows || data.rows.length;
  return [`Rendered data has ${count.toLocaleString("en-US")} row${count === 1 ? "" : "s"}`, ...details, movement].filter(Boolean).join("; ");
}

function selectionComparable(value: unknown, temporal: boolean): number | string | null {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) return value.getTime();
  if (temporal) {
    const timestamp = Date.parse(String(value));
    if (Number.isFinite(timestamp)) return timestamp;
  }
  const numeric = typeof value === "number" ? value : Number(String(value).replace(/,/g, ""));
  if (Number.isFinite(numeric)) return numeric;
  return String(value);
}

function inSelectionRange(value: unknown, range: [unknown, unknown], temporal: boolean) {
  const comparable = selectionComparable(value, temporal);
  const first = selectionComparable(range[0], temporal);
  const second = selectionComparable(range[1], temporal);
  if (comparable === null || first === null || second === null) return false;
  if (typeof comparable === "number" && typeof first === "number" && typeof second === "number") {
    return comparable >= Math.min(first, second) && comparable <= Math.max(first, second);
  }
  const text = String(comparable);
  const lower = [String(first), String(second)].sort()[0]!;
  const upper = [String(first), String(second)].sort()[1]!;
  return text >= lower && text <= upper;
}

function formatSelectionValue(value: unknown, temporal: boolean) {
  if (value instanceof Date || temporal) {
    const timestamp = value instanceof Date ? value.getTime() : Date.parse(String(value));
    if (Number.isFinite(timestamp)) return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(timestamp);
  }
  if (typeof value === "number") return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
  return String(value ?? "?");
}

export function describeChartSelection(
  selection: ChartSelection | null,
  data: TablePreview,
  xField: string,
  yField: string,
  fields: FieldMetadata[],
  xLabel: string,
  yLabel: string,
) {
  if (!selection?.x || !selection.y || !xField || !yField) {
    return { summary: "visual range selected", rows: [] as string[][] };
  }
  const directXIndex = data.columns.indexOf(xField);
  const directYIndex = data.columns.indexOf(yField);
  const xIndex = directXIndex >= 0 ? directXIndex : data.columns.indexOf("__ggsql_aes_pos1__");
  const yIndex = directYIndex >= 0 ? directYIndex : data.columns.indexOf("__ggsql_aes_pos2__");
  const xMetadata = fields.find((field) => field.name === xField);
  const yMetadata = fields.find((field) => field.name === yField);
  const xTemporal = xMetadata?.semanticType === "temporal" || /date|time/i.test(xMetadata?.dataType ?? "") || selection.x.some((value) => value instanceof Date);
  const yTemporal = yMetadata?.semanticType === "temporal" || /date|time/i.test(yMetadata?.dataType ?? "") || selection.y.some((value) => value instanceof Date);
  const rows = xIndex < 0 || yIndex < 0 ? [] : data.rows.filter((row) =>
    inSelectionRange(row[xIndex], selection.x!, xTemporal) && inSelectionRange(row[yIndex], selection.y!, yTemporal));
  const xRange = `${formatSelectionValue(selection.x[0], xTemporal)}–${formatSelectionValue(selection.x[1], xTemporal)}`;
  const yRange = `${formatSelectionValue(selection.y[0], yTemporal)}–${formatSelectionValue(selection.y[1], yTemporal)}`;
  return {
    summary: `${rows.length.toLocaleString()} data point${rows.length === 1 ? "" : "s"} selected · ${xLabel || xField}: ${xRange} · ${yLabel || yField}: ${yRange}`,
    rows,
  };
}

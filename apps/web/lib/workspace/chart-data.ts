import type { FieldMetadata, TablePreview } from "@chartize/contracts";

interface ChartSelection {
  x?: [unknown, unknown];
  y?: [unknown, unknown];
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
  const columns = Object.keys(values[0]!).filter((column) =>
    (!column.startsWith("__ggsql_") || column.startsWith("__ggsql_aes_")) && column !== "geometry");
  return {
    columns,
    rows: values.map((row) => columns.map((column) => typeof row[column] === "object" ? JSON.stringify(row[column]) : String(row[column] ?? ""))),
    totalRows: values.length,
    offset: 0,
    limit: values.length,
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

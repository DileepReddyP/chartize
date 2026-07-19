import type { FieldMetadata } from "@chartize/contracts";
import type { VisualPointState } from "./query-context";

export type VisualAesthetic =
  | "x" | "y" | "xEnd" | "yEnd" | "xMin" | "xMax" | "yMin" | "yMax"
  | "slope" | "color" | "fill" | "size" | "shape" | "linetype" | "linewidth"
  | "opacity" | "weight" | "geometry" | "facet";

export interface VisualGuidance {
  tone: "ready" | "attention";
  summary: string;
  detail: string;
  patch?: Partial<VisualPointState>;
  action?: string;
}

export function isNumericField(field: FieldMetadata) {
  return field.semanticType === "measure" || /int|float|double|decimal|numeric|number|real/i.test(field.dataType);
}

export function isTemporalField(field: FieldMetadata) {
  return field.semanticType === "temporal" || /date|time|timestamp|year/i.test(`${field.dataType} ${field.name}`);
}

export function isGeometryField(field: FieldMetadata) {
  return field.semanticType === "geometry" || /geometry|geography|wkb|wkt/i.test(`${field.dataType} ${field.name}`);
}

function isCategoricalField(field: FieldMetadata) {
  return !isNumericField(field) && !isGeometryField(field);
}

function first(fields: FieldMetadata[], predicate: (field: FieldMetadata) => boolean, except = "") {
  return fields.find((field) => field.name !== except && predicate(field))?.name ?? "";
}

function fieldNamed(fields: FieldMetadata[], name: string) {
  return fields.find((field) => field.name === name);
}

export function fieldsForAesthetic(fields: FieldMetadata[], aesthetic: VisualAesthetic, mark: string) {
  if (aesthetic === "geometry") return fields.filter(isGeometryField);
  if (["size", "linewidth", "opacity", "weight", "slope", "xMin", "xMax", "yMin", "yMax"].includes(aesthetic)) {
    return fields.filter(isNumericField);
  }
  if (["shape", "linetype", "facet"].includes(aesthetic)) return fields.filter(isCategoricalField);
  if (aesthetic === "color" || aesthetic === "fill") return fields.filter((field) => !isGeometryField(field));
  if ((mark === "histogram" || mark === "density") && aesthetic === "x") return fields.filter(isNumericField);
  if (mark === "smooth" && (aesthetic === "x" || aesthetic === "y")) return fields.filter(isNumericField);
  if (["line", "path", "area", "ribbon", "bar", "violin", "boxplot"].includes(mark) && aesthetic === "y") {
    return fields.filter(isNumericField);
  }
  return fields.filter((field) => !isGeometryField(field));
}

export function patchForMark(mark: string, visual: VisualPointState, fields: FieldMetadata[]): Partial<VisualPointState> {
  const numericX = fieldNamed(fields, visual.x) && isNumericField(fieldNamed(fields, visual.x)!)
    ? visual.x
    : first(fields, isNumericField);
  const numericY = fieldNamed(fields, visual.y) && isNumericField(fieldNamed(fields, visual.y)!)
    ? visual.y
    : first(fields, isNumericField, numericX);
  const temporalX = fieldNamed(fields, visual.x) && isTemporalField(fieldNamed(fields, visual.x)!)
    ? visual.x
    : first(fields, isTemporalField);
  const categoryX = fieldNamed(fields, visual.x) && isCategoricalField(fieldNamed(fields, visual.x)!)
    ? visual.x
    : first(fields, isCategoricalField);

  if (mark === "histogram" || mark === "density") {
    return {
      mark,
      x: numericX,
      y: "",
      scaleXTransform: "",
      scaleXFormat: "",
      labelX: numericX === visual.x ? visual.labelX : "",
      labelY: mark === "histogram" ? "Count" : "Density",
    };
  }
  if (mark === "smooth") {
    return {
      mark,
      x: numericX,
      y: numericY,
      scaleXTransform: "",
      scaleXFormat: "",
      labelX: numericX === visual.x ? visual.labelX : "",
    };
  }
  if (mark === "spatial") {
    return { mark, geometry: fieldNamed(fields, visual.geometry) && isGeometryField(fieldNamed(fields, visual.geometry)!) ? visual.geometry : first(fields, isGeometryField), x: "", y: "" };
  }
  if (mark === "ribbon") {
    const yMin = fieldNamed(fields, visual.yMin) && isNumericField(fieldNamed(fields, visual.yMin)!) ? visual.yMin : first(fields, isNumericField);
    const yMax = fieldNamed(fields, visual.yMax) && isNumericField(fieldNamed(fields, visual.yMax)!) ? visual.yMax : first(fields, isNumericField, yMin);
    return { mark, x: temporalX || visual.x, y: "", yMin, yMax };
  }
  if (mark === "line" || mark === "path" || mark === "area") {
    return { mark, x: temporalX || visual.x || categoryX || numericX, y: numericY || numericX };
  }
  if (mark === "bar") return { mark, x: categoryX || visual.x || temporalX, y: numericY || numericX };
  return { mark };
}

export function guidanceForMark(mark: string, visual: VisualPointState, fields: FieldMetadata[]): VisualGuidance {
  if (!fields.length) return { tone: "attention", summary: "waiting for SQL output", detail: "Run a valid SELECT first; channels are drawn only from its returned columns." };
  const field = (name: string) => fieldNamed(fields, name);
  const numeric = fields.filter(isNumericField);

  if (mark === "histogram" || mark === "density") {
    if (!visual.x || !field(visual.x) || !isNumericField(field(visual.x)!)) {
      const temporal = field(visual.x) && isTemporalField(field(visual.x)!);
      return {
        tone: "attention",
        summary: `${mark} needs one numeric x field`,
        detail: temporal
          ? `${visual.x} is a date. Use a numeric field for the distribution, or keep a line chart to show change over time.`
          : "This mark bins x and calculates its own count or density; it does not need a y field.",
        patch: patchForMark(mark, visual, fields),
        action: numeric[0] ? `use ${numeric[0].name}` : undefined,
      };
    }
    return { tone: "ready", summary: `${mark} will bin ${visual.x}`, detail: mark === "histogram" ? "Y is computed as count." : "Y is computed as density." };
  }
  if (mark === "smooth") {
    const ready = field(visual.x) && field(visual.y) && isNumericField(field(visual.x)!) && isNumericField(field(visual.y)!);
    return ready
      ? { tone: "ready", summary: `${visual.y} modeled against ${visual.x}`, detail: "Choose OLS for a linear fit or NW for a flexible curve." }
      : { tone: "attention", summary: "smooth needs numeric x and y fields", detail: "Dates are not accepted directly by this statistical mark. Project time as a number in SQL if it is truly the predictor.", patch: patchForMark(mark, visual, fields), action: numeric.length >= 2 ? "use numeric pair" : undefined };
  }
  if (mark === "spatial") {
    const ready = field(visual.geometry) && isGeometryField(field(visual.geometry)!);
    return ready
      ? { tone: "ready", summary: `${visual.geometry} defines the map`, detail: "Fill or colour can encode any other selected SQL field." }
      : { tone: "attention", summary: "spatial needs a geometry field", detail: "Return a geometry/WKB column in SELECT, then map it to geometry.", patch: patchForMark(mark, visual, fields), action: fields.some(isGeometryField) ? "use geometry" : undefined };
  }
  if (mark === "ribbon") {
    const ready = visual.x && field(visual.yMin) && field(visual.yMax) && isNumericField(field(visual.yMin)!) && isNumericField(field(visual.yMax)!);
    return ready
      ? { tone: "ready", summary: `${visual.yMin}–${visual.yMax} forms the band`, detail: "Add a line layer separately when you also want the estimate." }
      : { tone: "attention", summary: "ribbon needs x, y min, and y max", detail: "Both bounds must be numeric columns returned by SQL.", patch: patchForMark(mark, visual, fields), action: numeric.length >= 2 ? "use numeric bounds" : undefined };
  }
  if (["line", "path", "area", "bar"].includes(mark)) {
    const ready = Boolean(visual.x && visual.y && field(visual.x) && field(visual.y));
    return ready
      ? { tone: "ready", summary: `${visual.x} → ${visual.y}`, detail: isTemporalField(field(visual.x)!) ? "Time on x and a numeric value on y are compatible." : "Both channels come from the SQL result." }
      : { tone: "attention", summary: `${mark} needs x and y`, detail: "Choose only from columns returned by the current SQL.", patch: patchForMark(mark, visual, fields), action: "choose compatible fields" };
  }
  return { tone: "ready", summary: "channels use SQL output", detail: "Unavailable source columns are hidden until SELECT returns them." };
}

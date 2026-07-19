import { z } from "zod";

export const FieldMetadataSchema = z.object({
  name: z.string(),
  dataType: z.string(),
  nullable: z.boolean().default(true),
  description: z.string().optional(),
  semanticType: z
    .enum(["dimension", "measure", "temporal", "geography", "geometry", "identifier"])
    .optional(),
});

export const JoinHintSchema = z.object({
  leftField: z.string(),
  rightDataset: z.string(),
  rightField: z.string(),
  relationship: z.enum(["one-to-one", "one-to-many", "many-to-one", "many-to-many"]),
  label: z.string().optional(),
});

export const DatasetManifestSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  description: z.string().default(""),
  version: z.string(),
  tableName: z.string(),
  sourceUrl: z.string().default(""),
  license: z.string().default("Unknown"),
  attribution: z.string().default(""),
  rowCount: z.number().int().nonnegative().default(0),
  spatial: z.boolean().default(false),
  geometryType: z.string().optional(),
  geographyLevel: z.string().optional(),
  timeCoverage: z.string().optional(),
  publishedAt: z.string(),
  fields: z.array(FieldMetadataSchema).default([]),
  joinHints: z.array(JoinHintSchema).default([]),
});

export const DraftJoinSchema = z.object({
  table: z.string(),
  leftField: z.string(),
  rightField: z.string(),
  kind: z.enum(["LEFT", "INNER"]).default("LEFT"),
});

export const DraftFilterSchema = z.object({
  field: z.string(),
  operator: z.enum(["=", "!=", ">", ">=", "<", "<=", "contains"]),
  value: z.union([z.string(), z.number(), z.boolean()]),
});

export const VisualizationLayerSchema = z.object({
  mark: z.enum([
    "point",
    "line",
    "path",
    "segment",
    "bar",
    "area",
    "ribbon",
    "range",
    "polygon",
    "tile",
    "text",
    "rule",
    "smooth",
    "histogram",
    "density",
    "violin",
    "boxplot",
    "spatial",
  ]),
  x: z.string().default(""),
  y: z.string().default(""),
  xEnd: z.string().default(""),
  yEnd: z.string().default(""),
  xMin: z.string().default(""),
  xMax: z.string().default(""),
  yMin: z.string().default(""),
  yMax: z.string().default(""),
  slope: z.string().default(""),
  color: z.string().default(""),
  fill: z.string().default(""),
  size: z.string().default(""),
  shape: z.string().default(""),
  linetype: z.string().default(""),
  linewidth: z.string().default(""),
  opacityField: z.string().default(""),
  weight: z.string().default(""),
  geometry: z.string().default("geometry"),
  opacity: z.number().min(0).max(1).default(0.9),
  position: z.enum(["identity", "stack", "dodge", "jitter"]).default("identity"),
  colourLegendValue: z.string().default(""),
  fillLegendValue: z.string().default(""),
  fixedColour: z.string().default(""),
  fixedFill: z.string().default(""),
  fixedSize: z.number().nonnegative().default(0),
  fixedLinewidth: z.number().nonnegative().default(0),
  fixedLinetype: z.string().default(""),
  smoothMethod: z.enum(["", "nw", "ols", "tls"]).default(""),
  smoothAdjust: z.number().positive().default(1),
  smoothBandwidth: z.number().nonnegative().default(0),
  smoothKernel: z.enum(["", "gaussian", "epanechnikov", "triangular", "rectangular", "biweight", "cosine"]).default(""),
  place: z.boolean().default(false),
  literalX: z.string().default(""),
  literalY: z.string().default(""),
  literalXEnd: z.string().default(""),
  literalYEnd: z.string().default(""),
  literalSlope: z.string().default(""),
});

export const VisualizationScaleSchema = z.object({
  aesthetic: z.enum(["x", "y", "colour", "fill", "size", "opacity"]),
  type: z.enum(["", "continuous", "discrete", "binned", "ordinal", "identity"]).default(""),
  palette: z.string().default(""),
  transform: z.enum(["date", "datetime", "time", "linear", "integer", "log10", "sqrt"]).optional(),
  labelFormat: z.string().optional(),
});

export const AxisLabelsSchema = z.object({
  x: z.string().default(""),
  y: z.string().default(""),
  colour: z.string().default(""),
  fill: z.string().default(""),
  size: z.string().default(""),
  shape: z.string().default(""),
  linetype: z.string().default(""),
  linewidth: z.string().default(""),
  opacity: z.string().default(""),
});

export const DraftScenarioDeltaSchema = z.object({
  field: z.string(),
  delta: z.number(),
  as: z.string(),
  label: z.string().default("Hypothetical scenario"),
});

export const DraftReferenceRuleSchema = z.object({
  axis: z.enum(["x", "y"]),
  value: z.string(),
  label: z.string().default("Reference"),
  colour: z.string().default("#596662"),
  linetype: z.string().default("dashed"),
  linewidth: z.number().positive().default(1),
});

export const GgsqlDraftSchema = z.object({
  source: z.string(),
  joins: z.array(DraftJoinSchema).default([]),
  filters: z.array(DraftFilterSchema).default([]),
  groupBy: z.array(z.string()).default([]),
  aggregation: z.enum(["none", "count", "sum", "mean", "median", "min", "max"]).default("none"),
  aggregateField: z.string().default(""),
  scenarioDeltas: z.array(DraftScenarioDeltaSchema).default([]),
  referenceRules: z.array(DraftReferenceRuleSchema).default([]),
  layers: z.array(VisualizationLayerSchema).min(1),
  title: z.string().default("Untitled view"),
  subtitle: z.string().default(""),
  limit: z.number().int().min(1).max(100000).default(5000),
  projection: z.string().default(""),
  tooltipFields: z.array(z.string()).default([]),
  scales: z.array(VisualizationScaleSchema).default([]),
  axisLabels: AxisLabelsSchema.default({ x: "", y: "", colour: "", fill: "", size: "", shape: "", linetype: "", linewidth: "", opacity: "" }),
});

export const QueryRequestSchema = z.object({
  ggsql: z.string().min(1).max(100000),
});

export const TablePreviewSchema = z.object({
  columns: z.array(z.string()),
  rows: z.array(z.array(z.string())),
  totalRows: z.number().int().nonnegative(),
  offset: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
});

export const QueryResultSchema = z.object({
  spec: z.record(z.string(), z.unknown()),
  generatedSql: z.string(),
  rows: z.number().int().nonnegative(),
  columns: z.array(z.string()),
  selectedData: TablePreviewSchema,
  warnings: z.array(z.string()).default([]),
  durationMs: z.number().nonnegative(),
});

export const AiCitationSchema = z.object({
  title: z.string(),
  url: z.url(),
});

export const AiSuggestionSchema = z.object({
  query: z.string(),
  draft: GgsqlDraftSchema,
  explanation: z.string(),
  assumptions: z.array(z.string()),
  warnings: z.array(z.string()),
  sources: z.array(AiCitationSchema),
  researched: z.boolean(),
});

export type FieldMetadata = z.infer<typeof FieldMetadataSchema>;
export type JoinHint = z.infer<typeof JoinHintSchema>;
export type DatasetManifest = z.infer<typeof DatasetManifestSchema>;
export type VisualizationLayer = z.infer<typeof VisualizationLayerSchema>;
export type VisualizationScale = z.infer<typeof VisualizationScaleSchema>;
export type DraftScenarioDelta = z.infer<typeof DraftScenarioDeltaSchema>;
export type DraftReferenceRule = z.infer<typeof DraftReferenceRuleSchema>;
export type GgsqlDraft = z.infer<typeof GgsqlDraftSchema>;
export type QueryRequest = z.infer<typeof QueryRequestSchema>;
export type QueryResult = z.infer<typeof QueryResultSchema>;
export type TablePreview = z.infer<typeof TablePreviewSchema>;
export type AiSuggestion = z.infer<typeof AiSuggestionSchema>;
export type AiCitation = z.infer<typeof AiCitationSchema>;

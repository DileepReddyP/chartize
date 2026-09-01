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

export const DatasetArtifactRequestSchema = z.object({
  slug: z.string().regex(/^[a-z0-9_]+$/).max(100),
  version: z.string().min(1).max(100),
});

export const DatasetArtifactHeadersSchema = z.object({
  contentType: z.literal("application/vnd.apache.parquet"),
  etag: z.string().min(3).max(202),
  contentLength: z.number().int().positive(),
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
  lon: z.string().default(""),
  lat: z.string().default(""),
  label: z.string().default(""),
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
  fixedFontSize: z.number().nonnegative().default(0),
  fixedFontWeight: z.string().default(""),
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

export const AiResearchContextSchema = z.object({
  researched: z.literal(true),
  memo: z.string().max(6000),
  sources: z.array(AiCitationSchema).max(6),
});

export const AiContextSchema = z.enum(["code", "chart", "data", "general"]);

export const AiContextReferenceSchema = z.object({
  kind: AiContextSchema,
  note: z.string().min(1).max(1600),
});

const AiProviderReasoningItemSchema = z.object({
  id: z.string().min(1).max(300),
  type: z.literal("reasoning"),
  summary: z.array(z.object({
    type: z.literal("summary_text"),
    text: z.string().max(4000),
  })).max(8),
  encrypted_content: z.string().min(1).max(250_000),
  status: z.enum(["in_progress", "completed", "incomplete"]).optional(),
});

const AiProviderDataMessageSchema = z.object({
  role: z.literal("user"),
  content: z.string().min(1).max(100_000),
});

/**
 * Short-lived Responses API state used only while one browser-data turn is in
 * progress. It is returned to the browser worker and discarded with the turn;
 * normal workspace conversation state remains browser-local plain text.
 */
export const AiProviderContextSchema = z.object({
  items: z.array(z.union([AiProviderReasoningItemSchema, AiProviderDataMessageSchema])).max(32),
  consumedWorkspaceResults: z.number().int().min(0).max(12),
});

export const AiWorkspaceActionSchema = z.object({
  sql: z.string().min(1).max(50_000),
  purpose: z.string().min(1).max(500),
});

export const AiSuggestionSchema = z.object({
  query: z.string(),
  draft: GgsqlDraftSchema,
  explanation: z.string(),
  assumptions: z.array(z.string()),
  warnings: z.array(z.string()),
  sources: z.array(AiCitationSchema),
  researched: z.boolean(),
  workspaceActions: z.array(AiWorkspaceActionSchema).max(4).default([]),
});

export const AiUsageSchema = z.object({
  models: z.array(z.string()).min(1),
  calls: z.number().int().positive(),
  inputTokens: z.number().int().nonnegative(),
  cachedInputTokens: z.number().int().nonnegative(),
  cacheWriteTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  reasoningTokens: z.number().int().nonnegative(),
  totalTokens: z.number().int().nonnegative(),
});

export const AiDataRequestSchema = z.object({
  sql: z.string().min(1).max(20000),
  purpose: z.string().min(1).max(500),
  limit: z.number().int().min(1).max(100),
});

export const AiResponsePreferencesSchema = z.object({
  hypothesize: z.boolean(),
  webSearch: z.boolean(),
  dataAccess: z.boolean().default(true),
  allowLocalChanges: z.boolean().default(false),
  concise: z.boolean(),
  challenge: z.boolean(),
  technical: z.boolean(),
});

export const DEFAULT_AI_RESPONSE_PREFERENCES = Object.freeze(AiResponsePreferencesSchema.parse({
  hypothesize: true,
  webSearch: true,
  dataAccess: true,
  allowLocalChanges: false,
  concise: true,
  challenge: false,
  technical: false,
}));

export const AiApprovalRequestSchema = z.enum(["local_changes"]);

export const AiConversationMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  text: z.string(),
  approval: AiApprovalRequestSchema.optional(),
  context: AiContextReferenceSchema.optional(),
});

const AiTurnHistoryMessageSchema = AiConversationMessageSchema
  .pick({ role: true, text: true, context: true })
  .extend({ text: z.string().max(6000) });

export const AiWorkspaceDataResultSchema = z.object({
  sql: z.string().min(1).max(20_000),
  purpose: z.string().min(1).max(500),
  columns: z.array(z.string().max(300)).max(100),
  rows: z.array(z.array(z.string().max(1000)).max(100)).max(100),
  returnedRows: z.number().int().nonnegative(),
  truncated: z.boolean(),
  error: z.string().max(2000).optional(),
});

export const AiRuntimeErrorSchema = z.object({
  stage: z.enum(["engine", "query", "table", "map", "upload", "ai"]),
  message: z.string().min(1).max(4000),
  failedQuery: z.string().max(100_000).optional(),
});

export const AiTurnRequestSchema = z.object({
  task: z.enum(["generate", "repair", "explain"]),
  context: AiContextSchema,
  contextNote: z.string().max(4000),
  request: z.string().min(1).max(4000),
  currentQuery: z.string().max(100_000),
  queryStatus: z.enum(["blank", "rendered", "edited", "failed"]).default("rendered"),
  renderedQuery: z.string().max(100_000).optional(),
  source: z.string().max(300).optional(),
  schema: z.array(FieldMetadataSchema).max(500),
  availableSources: z.array(z.object({
    id: z.string().min(1).max(300),
    title: z.string().max(500),
    description: z.string().max(3000),
    fields: z.array(FieldMetadataSchema).max(500),
  })).max(100),
  view: z.object({
    title: z.string().max(1000),
    subtitle: z.string().max(2000),
    sources: z.array(z.object({
      id: z.string().max(300),
      title: z.string().max(500),
      description: z.string().max(3000),
    })).max(20),
  }),
  preferences: AiResponsePreferencesSchema,
  sampleData: z.object({
    columns: z.array(z.string().max(300)).max(100),
    rows: z.array(z.array(z.string().max(3000)).max(100)).max(20),
  }).optional(),
  history: z.array(AiTurnHistoryMessageSchema).max(24),
  runtimeErrors: z.array(AiRuntimeErrorSchema).max(8).default([]),
});

export const AiTurnEnvelopeSchema = AiTurnRequestSchema.extend({
  workspaceDataRound: z.number().int().min(0).max(3).default(0),
  workspaceData: z.array(AiWorkspaceDataResultSchema).max(12).default([]),
  researchContext: AiResearchContextSchema.optional(),
  providerContext: AiProviderContextSchema.optional(),
});

export const AiDataRequestResponseSchema = z.object({
  kind: z.literal("data_request"),
  requests: z.array(AiDataRequestSchema).min(1).max(4),
  researchContext: AiResearchContextSchema.optional(),
  providerContext: AiProviderContextSchema.optional(),
  usage: AiUsageSchema,
});

export const AiExplanationResponseSchema = z.object({
  kind: z.literal("explanation"),
  explanation: z.string(),
  approval: AiApprovalRequestSchema.optional(),
  assumptions: z.array(z.string()),
  warnings: z.array(z.string()),
  sources: z.array(AiCitationSchema),
  researched: z.boolean(),
  workspaceActions: z.array(AiWorkspaceActionSchema).max(4).default([]),
  usage: AiUsageSchema,
});

export const AiVisualizationResponseSchema = AiSuggestionSchema.extend({
  kind: z.literal("visualization"),
  usage: AiUsageSchema,
});

export const AiResponseSchema = z.discriminatedUnion("kind", [
  AiExplanationResponseSchema,
  AiVisualizationResponseSchema,
  AiDataRequestResponseSchema,
]);

export const AiStreamEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("progress"),
    message: z.string().min(1).max(200),
  }),
  z.object({
    type: z.literal("result"),
    response: AiResponseSchema,
  }),
  z.object({
    type: z.literal("error"),
    error: z.string().min(1).max(4000),
  }),
]);

export type FieldMetadata = z.infer<typeof FieldMetadataSchema>;
export type JoinHint = z.infer<typeof JoinHintSchema>;
export type DatasetManifest = z.infer<typeof DatasetManifestSchema>;
export type DatasetArtifactRequest = z.infer<typeof DatasetArtifactRequestSchema>;
export type DatasetArtifactHeaders = z.infer<typeof DatasetArtifactHeadersSchema>;
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
export type AiResearchContext = z.infer<typeof AiResearchContextSchema>;
export type AiContext = z.infer<typeof AiContextSchema>;
export type AiContextReference = z.infer<typeof AiContextReferenceSchema>;
export type AiProviderContext = z.infer<typeof AiProviderContextSchema>;
export type AiWorkspaceAction = z.infer<typeof AiWorkspaceActionSchema>;
export type AiUsage = z.infer<typeof AiUsageSchema>;
export type AiDataRequest = z.infer<typeof AiDataRequestSchema>;
export type AiResponsePreferences = z.infer<typeof AiResponsePreferencesSchema>;
export type AiApprovalRequest = z.infer<typeof AiApprovalRequestSchema>;
export type AiConversationMessage = z.infer<typeof AiConversationMessageSchema>;
export type AiWorkspaceDataResult = z.infer<typeof AiWorkspaceDataResultSchema>;
export type AiTurnRequest = z.infer<typeof AiTurnRequestSchema>;
export type AiRuntimeError = z.infer<typeof AiRuntimeErrorSchema>;
export type AiTurnEnvelope = z.infer<typeof AiTurnEnvelopeSchema>;
export type AiExplanationResponse = z.infer<typeof AiExplanationResponseSchema>;
export type AiVisualizationResponse = z.infer<typeof AiVisualizationResponseSchema>;
export type AiResponse = z.infer<typeof AiResponseSchema>;
export type AiStreamEvent = z.infer<typeof AiStreamEventSchema>;

import {
  AiContextSchema, AiConversationMessageSchema, AiResponsePreferencesSchema,
  AiRuntimeErrorSchema, AiUsageSchema, AiWorkspaceActionSchema, GgsqlDraftSchema,
} from "@chartize/contracts";
import { z } from "zod";
import { MAX_VISUAL_ITEM_SELECTIONS, MapFeatureSelectionSchema } from "./chart-data";

export const GridSelectionSchema = z.object({ columns: z.array(z.string()), rows: z.array(z.array(z.string())), summary: z.string() });
export const ChartSelectionSchema = z.object({
  pixels: z.object({ x0: z.number(), y0: z.number(), x1: z.number(), y1: z.number() }),
  x: z.tuple([z.unknown(), z.unknown()]).optional(),
  y: z.tuple([z.unknown(), z.unknown()]).optional(),
});
const DomainSchema = z.tuple([z.unknown(), z.unknown()]);
export const ChartDomainsSchema = z.object({ x: DomainSchema.optional(), y: DomainSchema.optional() });
export const MapViewportSchema = z.object({
  zoom: z.number().min(0.5).max(8),
  panX: z.number().min(-4).max(4),
  panY: z.number().min(-4).max(4),
});
export const LeftPaneRatioSchema = z.number().min(0.3).max(0.7);
export const CodePaneRatioSchema = z.number().min(0.32).max(0.72);
export const EditorFontSizeSchema = z.number().int().min(10).max(24);
export const FocusAreaSchema = z.enum(["code", "chart", "table"]);
export const WorkspaceActionsSchema = z.array(AiWorkspaceActionSchema).max(16);

/** The editable chart, selections and conversation saved for one workspace. */
export const WorkspaceDocumentSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  createdAt: z.string(),
  draft: GgsqlDraftSchema,
  query: z.string(),
  dockSource: z.string(),
  resultTab: z.enum(["chart", "selected"]),
  fullSort: z.object({ column: z.string(), direction: z.enum(["asc", "desc"]) }).nullable(),
  gridSelection: GridSelectionSchema.nullable(),
  selectionOrigin: z.enum(["dock", "result"]),
  chartSelection: ChartSelectionSchema.nullable(),
  chartDomains: ChartDomainsSchema,
  chartDomainHistory: z.array(ChartDomainsSchema).max(20),
  mapViewport: MapViewportSchema,
  mapFeatureSelections: z.array(MapFeatureSelectionSchema).max(MAX_VISUAL_ITEM_SELECTIONS).default([]),
  focusArea: FocusAreaSchema,
  editorFontSize: EditorFontSizeSchema,
  aiPlacement: z.enum(["left", "right"]),
  aiContext: AiContextSchema,
  aiContextNote: z.string(),
  aiPrompt: z.string(),
  aiMessage: z.string(),
  aiHistory: z.array(AiConversationMessageSchema),
  aiUsage: AiUsageSchema.nullable(),
  aiPreferences: AiResponsePreferencesSchema,
  runtimeErrors: z.array(AiRuntimeErrorSchema).max(8).default([]),
  workspaceActions: WorkspaceActionsSchema.default([]),
});

/** A profile's workspace collection and active document. */
export const WorkspaceSessionSchema = z.object({
  version: z.literal(1),
  activeWorkspaceId: z.string().min(1),
  workspaceDocuments: z.array(WorkspaceDocumentSchema).min(1).max(40),
  leftPaneRatio: LeftPaneRatioSchema,
  codePaneRatio: CodePaneRatioSchema,
}).superRefine((session, context) => {
  if (!session.workspaceDocuments.some((document) => document.id === session.activeWorkspaceId)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "The active workspace is missing from the saved session.", path: ["activeWorkspaceId"] });
  }
});

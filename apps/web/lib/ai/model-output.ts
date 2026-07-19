import {
  AiSuggestionSchema,
  GgsqlDraftSchema,
  VisualizationLayerSchema,
} from "@chartize/contracts";
import { z } from "zod";

// Structured-output models often use zero as an "unused" numeric sentinel.
// Accept that at the model boundary, then restore the workspace's semantic
// default before validating the result used by the application.
const ModelLayerSchema = VisualizationLayerSchema.extend({
  smoothAdjust: z.number().nonnegative(),
});

const ModelScaleSchema = z.object({
  aesthetic: z.enum(["x", "y", "colour", "fill", "size", "opacity"]),
  type: z.enum(["", "continuous", "discrete", "binned", "ordinal", "identity"]),
  palette: z.string(),
  transform: z.enum(["date", "datetime", "time", "linear", "integer", "log10", "sqrt"]).nullable(),
  labelFormat: z.string().nullable(),
});

export const ModelSuggestionSchema = AiSuggestionSchema.extend({
  draft: GgsqlDraftSchema.extend({
    layers: z.array(ModelLayerSchema).min(1),
    scales: z.array(ModelScaleSchema),
  }),
});

export type ModelSuggestion = z.infer<typeof ModelSuggestionSchema>;

export function normalizeModelSuggestion(modelResult: ModelSuggestion) {
  return AiSuggestionSchema.parse({
    ...modelResult,
    draft: {
      ...modelResult.draft,
      layers: modelResult.draft.layers.map((layer) => ({
        ...layer,
        smoothAdjust: layer.smoothAdjust > 0 ? layer.smoothAdjust : 1,
      })),
      scales: modelResult.draft.scales.map((scale) => ({
        ...scale,
        transform: scale.transform ?? undefined,
        labelFormat: scale.labelFormat ?? undefined,
      })),
    },
  });
}

export function publicAiError(error: unknown) {
  if (error instanceof z.ZodError) {
    return "Chartize AI returned an incomplete visualization draft. Please try again.";
  }
  return error instanceof Error ? error.message : "AI request failed.";
}

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

export const ModelSuggestionSchema = AiSuggestionSchema.omit({ sources: true, researched: true }).extend({
  draft: GgsqlDraftSchema.extend({
    layers: z.array(ModelLayerSchema).min(1),
    scales: z.array(ModelScaleSchema),
  }),
});

export const ModelExplanationSchema = z.object({
  explanation: z.string(),
  assumptions: z.array(z.string()),
  warnings: z.array(z.string()),
});

export type ModelSuggestion = z.infer<typeof ModelSuggestionSchema>;
export type ModelExplanation = z.infer<typeof ModelExplanationSchema>;

const VISUAL_CLAUSE = /^\s*(DRAW|PLACE|SCALE|FACET|LABEL|PROJECT)\b/i;
const LABEL_ENTRY = /^\s*(title|subtitle|x|y|colour|color|fill|size|shape|linetype|linewidth|opacity)\s*=>/i;

export function normalizeModelGgsql(query: string) {
  const lines = query.split("\n");
  let inLabel = false;
  for (let index = 0; index < lines.length; index += 1) {
    const clause = VISUAL_CLAUSE.exec(lines[index] ?? "")?.[1]?.toLocaleUpperCase();
    if (clause) inLabel = clause === "LABEL";
    if (!inLabel || !LABEL_ENTRY.test(lines[index] ?? "") || /^\s*LABEL\b/i.test(lines[index] ?? "")) continue;
    let previous = index - 1;
    while (previous >= 0 && !lines[previous]!.trim()) previous -= 1;
    if (previous >= 0 && !lines[previous]!.trimEnd().endsWith(",")) lines[previous] = `${lines[previous]!.trimEnd()},`;
  }

  const visualise = lines.findIndex((line) => /^\s*VISUALI[ZS]E\b/i.test(line));
  if (visualise >= 0) {
    const prefix = lines.slice(0, visualise + 1);
    const body = lines.slice(visualise + 1);
    const blocks: Array<{ kind: string; lines: string[] }> = [];
    for (const line of body) {
      const kind = VISUAL_CLAUSE.exec(line)?.[1]?.toLocaleUpperCase();
      if (kind) blocks.push({ kind, lines: [line] });
      else if (blocks.length) blocks.at(-1)!.lines.push(line);
      else prefix.push(line);
    }
    const project = blocks.filter((block) => block.kind === "PROJECT");
    if (project.length && blocks.some((block) => block.kind === "DRAW" || block.kind === "PLACE")) {
      lines.splice(0, lines.length, ...prefix, ...blocks.filter((block) => block.kind !== "PROJECT").flatMap((block) => block.lines), ...project.flatMap((block) => block.lines));
    }
  }

  return lines.join("\n")
    // GGSQL accepts named palettes as identifiers, not string literals. Keep
    // this grammar-shaped instead of maintaining an incomplete palette list.
    .replace(/\bTO\s+'([a-z][\w-]*)'(?![\w-])/gi, (_match, palette: string) => `TO ${palette}`)
    .replace(/\b(PROJECT\s+TO\s+[a-z][\w-]*)\s+WITH\s+SETTING\b/gi, "$1\n  SETTING")
    .trim();
}

export function normalizeModelSuggestion(
  modelResult: ModelSuggestion,
  metadata: { sources?: Array<{ title: string; url: string }>; researched?: boolean } = {},
) {
  return AiSuggestionSchema.parse({
    ...modelResult,
    query: normalizeModelGgsql(modelResult.query),
    explanation: modelResult.explanation.replaceAll("?utm_source=openai", ""),
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
    sources: metadata.sources ?? [],
    researched: metadata.researched ?? false,
  });
}

export function publicAiError(error: unknown) {
  if (error instanceof z.ZodError) {
    return "Chartize AI returned an incomplete visualization draft. Please try again.";
  }
  return error instanceof Error ? error.message : "AI request failed.";
}

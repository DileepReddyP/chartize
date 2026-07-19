import { AiSuggestionSchema, FieldMetadataSchema, GgsqlDraftSchema } from "@chartize/contracts";
import { NextResponse } from "next/server";
import { z } from "zod";
import { CHARTIZE_AI_INSTRUCTIONS, chartizeTurnInstructions, schemaContext } from "@/lib/ai/prompts";
import { structuredResponse } from "@/lib/ai/provider";

export const runtime = "nodejs";

const RequestSchema = z.object({
  task: z.enum(["generate", "repair", "explain"]),
  context: z.enum(["code", "chart", "general"]).default("general"),
  contextNote: z.string().max(4000).default(""),
  request: z.string().min(1).max(4000),
  currentQuery: z.string().max(100000).default(""),
  source: z.string().optional(),
  schema: z.array(FieldMetadataSchema).max(500),
  availableSources: z.array(z.object({
    id: z.string().min(1).max(300),
    title: z.string().max(500),
    description: z.string().max(3000).default(""),
    fields: z.array(FieldMetadataSchema).max(500),
  })).max(100).default([]),
  sampleRows: z.array(z.array(z.string())).max(20).optional(),
  history: z.array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().max(6000) })).max(24).default([]),
});

// Responses structured outputs require every object property to be required.
// Keep the broader workspace contract ergonomic, but make its two optional
// scale values explicitly nullable while the model is producing JSON.
const ModelScaleSchema = z.object({
  aesthetic: z.enum(["x", "y", "colour", "fill", "size", "opacity"]),
  type: z.enum(["", "continuous", "discrete", "binned", "ordinal", "identity"]),
  palette: z.string(),
  transform: z.enum(["date", "datetime", "time", "linear", "integer", "log10", "sqrt"]).nullable(),
  labelFormat: z.string().nullable(),
});
const ModelSuggestionSchema = AiSuggestionSchema.extend({
  draft: GgsqlDraftSchema.extend({ scales: z.array(ModelScaleSchema) }),
});

export async function POST(request: Request) {
  try {
    const body = RequestSchema.parse(await request.json());
    const source = body.source ?? inferSource(body.currentQuery) ?? "chartize:presidential_approval_average";
    const availableSources = body.availableSources.length
      ? body.availableSources
      : [{ id: source, title: source, description: "Current source", fields: body.schema }];
    const allowedSources = availableSources.map((candidate) => candidate.id);
    const sampleNotice = body.sampleRows
      ? `The user explicitly consented to include these first ${body.sampleRows.length} sample rows:\n${JSON.stringify(body.sampleRows)}`
      : "No row values were shared. Work only from field metadata.";
    const workspaceTurn = [
      `User request: ${body.request}`,
      `Active workspace context: ${body.contextNote || "No narrower cursor or selection context."}`,
      `Dataset schema: ${schemaContext(source, body.schema)}`,
      `Available source catalog: ${JSON.stringify(availableSources)}`,
      `Current GGSQL:\n${body.currentQuery || "(none)"}`,
      sampleNotice,
    ].join("\n\n");
    const input = [
      ...body.history.map((message) => ({ role: message.role, content: message.text })),
      { role: "user" as const, content: workspaceTurn },
    ];

    const modelResult = await structuredResponse({
      name: "ggsql_suggestion",
      schema: ModelSuggestionSchema,
      instructions: `${CHARTIZE_AI_INSTRUCTIONS}\n\n${chartizeTurnInstructions(body.context, body.task)}\nKeep the active source unless the user asks to discover or use different data. The draft source must be one of these exact IDs: ${JSON.stringify(allowedSources)}.`,
      input,
    });
    const result = AiSuggestionSchema.parse({
      ...modelResult,
      draft: {
        ...modelResult.draft,
        scales: modelResult.draft.scales.map((scale) => ({
          ...scale,
          transform: scale.transform ?? undefined,
          labelFormat: scale.labelFormat ?? undefined,
        })),
      },
    });
    if (!allowedSources.includes(result.draft.source)) {
      throw new Error(`The model selected an unavailable source: ${result.draft.source}`);
    }
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "AI request failed." },
      { status: error instanceof z.ZodError ? 400 : 503 },
    );
  }
}

function inferSource(query: string) {
  return query.match(/\bFROM\s+(?:"([^"]+)"|(ggsql:[\w-]+)|([\w-]+))/i)?.slice(1).find(Boolean);
}

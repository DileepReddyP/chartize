import { FieldMetadataSchema } from "@chartize/contracts";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ModelSuggestionSchema, normalizeModelSuggestion, publicAiError } from "@/lib/ai/model-output";
import { CHARTIZE_AI_INSTRUCTIONS, chartizePreferenceInstructions, chartizeTurnInstructions, schemaContext } from "@/lib/ai/prompts";
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
  view: z.object({
    title: z.string().max(1000),
    subtitle: z.string().max(2000),
    sources: z.array(z.object({
      id: z.string().max(300),
      title: z.string().max(500),
      description: z.string().max(3000),
    })).max(20),
  }).optional(),
  preferences: z.object({
    hypothesize: z.boolean(),
    concise: z.boolean(),
    challenge: z.boolean(),
    technical: z.boolean(),
  }).default({ hypothesize: true, concise: true, challenge: false, technical: false }),
  sampleRows: z.array(z.array(z.string())).max(20).optional(),
  history: z.array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().max(6000) })).max(24).default([]),
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
      `Rendered view: ${JSON.stringify(body.view ?? { title: "", subtitle: "", sources: [] })}`,
      `Current date: ${new Date().toISOString().slice(0, 10)}`,
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
      instructions: `${CHARTIZE_AI_INSTRUCTIONS}\n\n${chartizeTurnInstructions(body.context, body.task)}\n${chartizePreferenceInstructions(body.preferences)}\nKeep the active source unless the user asks to discover or use different data. The draft source must be one of these exact IDs: ${JSON.stringify(allowedSources)}.`,
      input,
    });
    const result = normalizeModelSuggestion(modelResult);
    if (!allowedSources.includes(result.draft.source)) {
      throw new Error(`The model selected an unavailable source: ${result.draft.source}`);
    }
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: publicAiError(error) },
      { status: error instanceof z.ZodError ? 400 : 503 },
    );
  }
}

function inferSource(query: string) {
  return query.match(/\bFROM\s+(?:"([^"]+)"|(ggsql:[\w-]+)|([\w-]+))/i)?.slice(1).find(Boolean);
}

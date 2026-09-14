import { AiApprovalRequestSchema, GgsqlDraftSchema } from "@chartize/contracts";
import { z } from "zod";
import { isResultSqlStatement, sourcesFromQuery, splitGgsql, sqlStatements, visualLayersFromQuery, visualPointState, visualScalesFromQuery } from "../ggsql/query-context";
import { makeBlankDraft } from "../ggsql/serialize";

export const ModelAgentResponseSchema = z.object({
  action: z.enum(["answer", "update_visualization", "request_data"]),
  query: z.string().describe("The complete executable GGSQL for update_visualization only. Empty for answers and data requests; never put a prose answer or search query here."),
  explanation: z.string().describe("The complete user-visible answer, including the requested facts, dates and source links, or a description of the proposed visualization edit."),
  approval: AiApprovalRequestSchema.nullable().describe("Only when asking the user for permission BEFORE an action. Null for ordinary answers and work the user already requested. This is not a record of tools used."),
  localChangesAuthorized: z.boolean().describe("True only when the user requested or approved persistent changes to derived browser-local data."),
  assumptions: z.array(z.string()),
  warnings: z.array(z.string()),
  citations: z.array(z.string()).max(8),
  includeSelection: z.boolean().describe("For request_data: retrieve the current selected row values. A question about those values authorizes this read."),
  dataRequests: z.array(z.object({
    scope: z.enum(["rendered", "workspace"]).describe("rendered: query the exact rendered chart rows via the rendered_data table, with existing joins and filters already applied. workspace: query source tables directly."),
    sql: z.string().min(1).max(20_000),
    purpose: z.string().min(1).max(500),
    limit: z.number().int().min(1).max(100),
  })).max(4),
  workspaceActions: z.array(z.object({
    sql: z.string().min(1).max(50_000),
    purpose: z.string().min(1).max(500),
  })).max(4),
});

export type ModelAgentResponse = z.infer<typeof ModelAgentResponseSchema>;

export function draftFromGgsql(query: string, allowedSources: string[], fallbackSource = "") {
  const referenced = sourcesFromQuery(query);
  const source = referenced.find((candidate) => allowedSources.includes(candidate))
    || (allowedSources.includes(fallbackSource) ? fallbackSource : "")
    || allowedSources[0]
    || "";
  const visual = visualPointState(query);
  const layers = visualLayersFromQuery(query);
  const draft = makeBlankDraft(source);
  draft.layers = layers.length ? layers : draft.layers;
  draft.scales = visualScalesFromQuery(query);
  draft.title = visual.title;
  draft.subtitle = visual.subtitle;
  draft.projection = visual.project === "crs" ? visual.projectTarget : visual.project;
  draft.axisLabels = {
    x: visual.labelX,
    y: visual.labelY,
    colour: visual.labelColor,
    fill: visual.labelFill,
    size: visual.labelSize,
    shape: visual.labelShape,
    linetype: visual.labelLinetype,
    linewidth: visual.labelLinewidth,
    opacity: visual.labelOpacity,
  };
  const limit = /\bLIMIT\s+(\d+)\b/i.exec(query)?.[1];
  if (limit) draft.limit = Math.max(1, Math.min(100_000, Number(limit)));
  return GgsqlDraftSchema.parse(draft);
}

const PROVIDER_CITATION_TOKEN = /(?:cite|filecite)[^]*/g;

/** Strip provider-internal citation control tokens while preserving Markdown. */
export function sanitizeModelText(value: string) {
  return value
    .replace(PROVIDER_CITATION_TOKEN, "")
    .replace(/[ \t]+([,.;:!?])/g, "$1")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+$/gm, "")
    .trim();
}

const VISUAL_CLAUSE = /^\s*(DRAW|PLACE|SCALE|FACET|LABEL|PROJECT)\b/i;
const LABEL_ENTRY = /^\s*(title|subtitle|x|y|colour|color|fill|size|shape|linetype|linewidth|opacity)\s*=>/i;

export function normalizeModelGgsql(query: string) {
  let modelQuery = query.trim();
  const fenced = /^```(?:ggsql|sql)?\s*\n?([\s\S]*?)\n?```$/i.exec(modelQuery);
  if (fenced?.[1]) modelQuery = fenced[1].trim();
  modelQuery = modelQuery.replace(/^(?:ggsql|query)\s*:\s*/i, "").trim();

  const lines = modelQuery.split("\n");
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
    .replace(/\bTO\s+'([a-z][\w-]*)'(?![\w-])/gi, (_match, palette: string) => `TO ${palette}`)
    .replace(/\b(PROJECT\s+TO\s+[a-z][\w-]*)\s+WITH\s+SETTING\b/gi, "$1\n  SETTING")
    .trim();
}

/** Keep one-time browser-local SQL out of the editable visualization query. */
export function separateWorkspaceProgram(query: string) {
  const { sql, visual } = splitGgsql(query);
  const statements = sqlStatements(sql);
  if (statements.length <= 1) {
    if (statements.length && !isResultSqlStatement(statements[0]!)) {
      throw new Error("A visualization query must begin with SELECT or WITH; put one-time local SQL in workspaceActions.");
    }
    return { query: [sql, visual].filter(Boolean).join("\n\n"), setupSql: "" };
  }
  const resultStatement = statements.at(-1) ?? "";
  if (!isResultSqlStatement(resultStatement)) {
    throw new Error("Chartize AI did not finish its local SQL program with a SELECT or WITH query.");
  }
  return {
    query: [resultStatement, visual].filter(Boolean).join("\n\n"),
    setupSql: statements.slice(0, -1).map((statement) => `${statement};`).join("\n\n"),
  };
}

export function publicAiError(error: unknown) {
  if (error instanceof z.ZodError) {
    console.warn("Chartize AI schema mismatch", error.issues.map(({ path, code }) => ({ path, code })));
    return "Chartize AI returned an incomplete response. Please try again.";
  }
  return error instanceof Error ? error.message : "AI request failed.";
}

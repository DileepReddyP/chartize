import { z } from "zod";
import type { StructuredFunctionTool } from "./provider";
import {
  VISUALIZATION_TIP_TOPICS,
  VisualizationTipsArgumentsSchema,
  visualizationTipsFor,
} from "./visualization-tips";

const QueryWarehouseArgumentsSchema = z.object({
  sql: z.string().min(1).max(20_000),
  purpose: z.string().min(1).max(500),
  limit: z.number().int().min(1).max(100),
});

const WarehouseQueryResultSchema = z.object({
  columns: z.array(z.string()).max(100),
  rows: z.array(z.array(z.string())).max(101),
  returnedRows: z.number().int().nonnegative(),
  truncated: z.boolean(),
});

export interface WorkspaceToolContext {
  availableSourceIds: string[];
  engineUrl: string;
  allowDataQueries: boolean;
}

export function createWorkspaceFunctionTools(context: WorkspaceToolContext): StructuredFunctionTool[] {
  const queryableSources = context.availableSourceIds.filter((source) => source.startsWith("chartize:"));
  const tools: StructuredFunctionTool[] = [{
    name: "get_visualization_tips",
    description: "Retrieve Chartize's compact GGSQL 0.4.1 drawing cookbook for the visual techniques needed in this turn. Call this before writing or repairing text labels, endpoint labels, event annotations, dense or layered charts, maps, uncertainty, facets, scales, or statistical layers. The returned rules include row-cardinality invariants and executable patterns that are intentionally not all repeated in the base prompt.",
    parameters: {
      type: "object",
      properties: {
        topics: {
          type: "array",
          items: { type: "string", enum: [...VISUALIZATION_TIP_TOPICS] },
          minItems: 1,
          maxItems: 4,
          description: "One to four techniques relevant to the requested visualization edit.",
        },
      },
      required: ["topics"],
      additionalProperties: false,
    },
    execute: async (argumentsValue) => {
      const { topics } = VisualizationTipsArgumentsSchema.parse(argumentsValue);
      return visualizationTipsFor(topics);
    },
  }];

  if (context.allowDataQueries && queryableSources.length) {
    tools.unshift({
      name: "query_warehouse",
      description: `Run a bounded, read-only analytical SQL query over Chartize's server datasets and inspect the returned values. Use this to answer quantitative questions, verify ranges or aggregates, and choose chart encodings from evidence instead of guessing. One well-shaped query is preferable to a sequence of exploratory calls; issue independent calls together when several facts are truly needed. Queryable source IDs: ${queryableSources.join(", ")}.`,
      parameters: {
        type: "object",
        properties: {
          sql: { type: "string", description: "One read-only SELECT or WITH query. Use exact chartize: source IDs in FROM/JOIN clauses." },
          purpose: { type: "string", description: "A short statement of what this query needs to establish." },
          limit: { type: "integer", minimum: 1, maximum: 100, description: "Maximum rows to return." },
        },
        required: ["sql", "purpose", "limit"],
        additionalProperties: false,
      },
      execute: async (argumentsValue) => {
        const { sql, purpose, limit } = QueryWarehouseArgumentsSchema.parse(argumentsValue);
        const normalizedSql = normalizeWarehouseToolSql(sql, queryableSources);
        const response = await fetch(`${context.engineUrl}/api/ai/query-data`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sql: normalizedSql, limit }),
          cache: "no-store",
        });
        const payload: unknown = await response.json();
        if (!response.ok) {
          const message = typeof payload === "object" && payload !== null && "error" in payload && typeof payload.error === "string"
            ? payload.error
            : "The warehouse query failed.";
          throw new Error(message);
        }
        return { purpose, ...WarehouseQueryResultSchema.parse(payload) };
      },
    });
  }
  return tools;
}

export function normalizeWarehouseToolSql(sql: string, availableSourceIds: string[]) {
  let normalized = sql.trim().trimEnd().replace(/;$/, "").trim();
  const upper = normalized.toLocaleUpperCase();
  if (!(upper.startsWith("SELECT ") || upper.startsWith("WITH "))) {
    throw new Error("Warehouse tools accept one SELECT or WITH query only.");
  }
  if (normalized.includes(";")) throw new Error("Warehouse tools accept one SQL statement only.");

  const blocked = /\b(?:INSTALL|LOAD|COPY|ATTACH|DETACH|PRAGMA|CREATE|DROP|ALTER|INSERT|UPDATE|DELETE|EXPORT|IMPORT|CALL|READ_[A-Z0-9_]*|[A-Z0-9_]+_SCAN|GLOB|SNIFF_CSV|PARQUET_(?:FILE_)?METADATA|PARQUET_SCHEMA|QUERY_TABLE|ST_READ|HTTPFS|HTTP_GET|HTTP_POST|DUCKDB_[A-Z0-9_]*|SQLITE_[A-Z0-9_]*|PG_[A-Z0-9_]*|INFORMATION_SCHEMA)\b/i;
  const blockedMatch = normalized.match(blocked);
  if (blockedMatch) throw new Error(`The warehouse query contains a blocked operation: ${blockedMatch[0]}.`);

  const queryableSources = availableSourceIds.filter((source) => source.startsWith("chartize:"));
  for (const source of [...queryableSources].sort((left, right) => right.length - left.length)) {
    const slug = source.slice("chartize:".length);
    const escapedSource = escapeRegExp(source);
    normalized = normalized
      .replace(new RegExp(`"${escapedSource}"`, "gi"), `"${slug}"`)
      .replace(new RegExp(`(?<![A-Za-z0-9_])${escapedSource}(?![A-Za-z0-9_])`, "gi"), `"${slug}"`);
  }
  if (/\bchartize:/i.test(normalized)) {
    throw new Error("The query references a dataset that is not available in this workspace.");
  }
  return normalized;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

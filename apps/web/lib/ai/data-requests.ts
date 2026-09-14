import type { AiDataRequest, AiTurnEnvelope } from "@chartize/contracts";
import { isResultSqlStatement, splitGgsql, sqlStatements } from "../ggsql/query-context";

/** Resolves a rendered-data inspection against the exact query that produced the chart. */
export function resolveDataRequest(request: AiDataRequest & { scope: "rendered" | "workspace" }, body: AiTurnEnvelope): AiDataRequest {
  if (request.scope === "workspace") return { sql: request.sql, purpose: request.purpose, limit: request.limit };
  const renderedQuery = body.renderedQuery ?? (body.queryStatus === "rendered" ? body.currentQuery : "");
  const renderedSql = splitGgsql(renderedQuery).sql.trim().replace(/;\s*$/, "");
  if (!renderedSql || sqlStatements(renderedSql).length !== 1 || !isResultSqlStatement(renderedSql)) {
    throw new Error("There is no rendered query to inspect. Run the chart first.");
  }
  if (sqlStatements(request.sql).length !== 1 || !isResultSqlStatement(request.sql)) {
    throw new Error("Rendered-data inspection requires one read-only SELECT or WITH query.");
  }
  return {
    sql: `WITH rendered_data AS (\n${renderedSql}\n)\nSELECT * FROM (\n${request.sql.trim().replace(/;\s*$/, "")}\n) AS chartize_inspection`,
    purpose: request.purpose,
    limit: request.limit,
  };
}

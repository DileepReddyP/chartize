import {
  DatasetManifestSchema,
  TablePreviewSchema,
  type DatasetManifest,
  type TablePreview,
} from "@chartize/contracts";
import { z } from "zod";

interface WarehousePreviewRequest {
  slug: string;
  version: string;
  offset: number;
  sort?: { column: string; direction: "asc" | "desc" } | null;
}

let catalogRequest: Promise<DatasetManifest[]> | undefined;
const previewRequests = new Map<string, Promise<TablePreview>>();
const QueryRowsSchema = z.object({
  columns: z.array(z.string()),
  rows: z.array(z.array(z.string())),
});
const featureRowRequests = new Map<string, Promise<z.infer<typeof QueryRowsSchema>>>();

function retain<T>(cache: Map<string, Promise<T>>, key: string, request: Promise<T>, maximum: number) {
  cache.delete(key);
  cache.set(key, request);
  while (cache.size > maximum) cache.delete(cache.keys().next().value!);
  void request.catch(() => {
    if (cache.get(key) === request) cache.delete(key);
  });
  return request;
}

export function fetchWarehouseCatalog() {
  if (!catalogRequest) {
    const request = fetch("/engine/api/catalog")
      .then(async (response) => response.ok ? response.json() : [])
      .then((catalog: unknown) => DatasetManifestSchema.array().parse(catalog));
    catalogRequest = request;
    void request.catch(() => {
      if (catalogRequest === request) catalogRequest = undefined;
    });
  }
  return catalogRequest;
}

export function fetchWarehousePreview({ slug, version, offset, sort }: WarehousePreviewRequest) {
  const key = `${version}:${slug}:${offset}:${sort?.column ?? ""}:${sort?.direction ?? ""}`;
  const cached = previewRequests.get(key);
  if (cached) {
    previewRequests.delete(key);
    previewRequests.set(key, cached);
    return cached;
  }

  const parameters = new URLSearchParams({ limit: "100", offset: String(offset) });
  if (sort) {
    parameters.set("sort", sort.column);
    parameters.set("direction", sort.direction);
  }
  const request = fetch(`/engine/api/datasets/${encodeURIComponent(slug)}/preview?${parameters}`)
    .then(async (response) => {
      const body = await response.json() as unknown;
      if (!response.ok) {
        throw new Error(typeof body === "object" && body && "error" in body
          ? String(body.error)
          : "Table preview failed.");
      }
      return TablePreviewSchema.parse(body);
    });
  return retain(previewRequests, key, request, 32);
}

export function fetchWarehouseQueryRow(sql: string, offset: number) {
  const normalizedOffset = Math.max(0, Math.trunc(offset));
  const normalizedSql = sql.trim().replace(/;$/, "");
  const key = `${normalizedOffset}:${normalizedSql}`;
  const cached = featureRowRequests.get(key);
  if (cached) {
    featureRowRequests.delete(key);
    featureRowRequests.set(key, cached);
    return cached;
  }
  const request = fetch("/engine/api/ai/query-data", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      sql: `SELECT * FROM (${normalizedSql}) AS chartize_selected_feature LIMIT 1 OFFSET ${normalizedOffset}`,
      limit: 1,
    }),
  }).then(async (response) => {
    const body = await response.json() as unknown;
    if (!response.ok) {
      throw new Error(typeof body === "object" && body && "error" in body
        ? String(body.error)
        : "Feature details could not be loaded.");
    }
    return QueryRowsSchema.parse(body);
  });
  return retain(featureRowRequests, key, request, 64);
}

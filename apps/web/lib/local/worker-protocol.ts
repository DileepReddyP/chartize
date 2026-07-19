export type LocalFormat = "csv" | "tsv" | "parquet" | "geoparquet" | "json" | "ndjson" | "geojson" | "shapefile";

export type LocalWorkerRequest =
  | { id: string; type: "init"; spatialiteUrl: string }
  | { id: string; type: "register"; name: string; format: LocalFormat; data: ArrayBuffer }
  | { id: string; type: "run"; query: string }
  | { id: string; type: "sql"; query: string }
  | { id: string; type: "describe"; name: string }
  | { id: string; type: "tables" }
  | { id: string; type: "remove"; name: string };

export type LocalWorkerResponse =
  | { id: string; ok: true; data: unknown }
  | { id: string; ok: false; error: string };

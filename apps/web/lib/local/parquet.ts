import type { Feature, FeatureCollection, GeoJsonObject, Geometry } from "geojson";
import { parquetWriteBuffer } from "hyparquet-writer";

type Row = Record<string, unknown>;
type ColumnType = "BOOLEAN" | "DOUBLE" | "INT64" | "STRING" | "GEOMETRY";

function plainValue(value: unknown): unknown {
  if (value === null || value === undefined || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  return JSON.stringify(value);
}

function inferType(values: unknown[]): ColumnType {
  const present = values.filter((value) => value !== null && value !== undefined);
  if (present.length && present.every((value) => typeof value === "boolean")) return "BOOLEAN";
  if (present.length && present.every((value) => typeof value === "number" && Number.isSafeInteger(value))) return "INT64";
  if (present.length && present.every((value) => typeof value === "number")) return "DOUBLE";
  return "STRING";
}

function normalizeColumn(values: unknown[], type: ColumnType) {
  return type === "INT64"
    ? values.map((value) => typeof value === "number" ? BigInt(value) : value)
    : values;
}

export function rowsToParquet(rows: Row[]): Uint8Array {
  if (!rows.length) throw new Error("The dataset contains no rows.");
  const names = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const columnData = names.map((name) => {
    const values = rows.map((row) => plainValue(row[name]) ?? null);
    const type = inferType(values);
    return { name, data: normalizeColumn(values, type), type, nullable: true };
  });
  return new Uint8Array(parquetWriteBuffer({ columnData }));
}

function toFeatures(input: GeoJsonObject): Feature[] {
  if (input.type === "FeatureCollection") return (input as FeatureCollection).features;
  if (input.type === "Feature") return [input as Feature];
  return [{ type: "Feature", geometry: input as Geometry, properties: {} }];
}

export function geojsonToParquet(input: GeoJsonObject): { bytes: Uint8Array; rowCount: number; fields: string[] } {
  const features = toFeatures(input);
  if (!features.length) throw new Error("The GeoJSON contains no features.");

  const propertyNames = [
    ...new Set(features.flatMap((feature) => Object.keys(feature.properties ?? {}))),
  ].filter((name) => name !== "geometry" && name !== "__feature_id");

  const columnData: Array<{ name: string; data: unknown[]; type: ColumnType; nullable?: boolean }> = [
    {
      name: "__feature_id",
      data: features.map((feature, index) => String(feature.id ?? index)),
      type: "STRING",
      nullable: false,
    },
    ...propertyNames.map((name) => {
      const values = features.map((feature) => plainValue(feature.properties?.[name]) ?? null);
      const type = inferType(values);
      return { name, data: normalizeColumn(values, type), type, nullable: true };
    }),
    {
      name: "geometry",
      // hyparquet-writer records GeoParquet metadata and converts GeoJSON geometry to WKB.
      data: features.map((feature) => feature.geometry),
      type: "GEOMETRY",
      nullable: true,
    },
  ];

  return {
    bytes: new Uint8Array(parquetWriteBuffer({ columnData })),
    rowCount: features.length,
    fields: [...propertyNames, "geometry"],
  };
}

export function parseJsonRows(bytes: Uint8Array, ndjson = false): Row[] {
  const text = new TextDecoder().decode(bytes);
  const parsed = ndjson
    ? text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line) as unknown)
    : JSON.parse(text) as unknown;
  if (!Array.isArray(parsed) || parsed.some((row) => !row || typeof row !== "object" || Array.isArray(row))) {
    throw new Error("JSON datasets must be an array of objects; use GeoJSON mode for geographic features.");
  }
  return parsed as Row[];
}

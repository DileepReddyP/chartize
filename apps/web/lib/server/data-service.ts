import {
  DatasetManifestSchema,
  FieldMetadataSchema,
  type DatasetManifest,
  type FieldMetadata,
} from "@chartize/contracts";
import { DuckDBInstance, type DuckDBConnection, type DuckDBValue } from "@duckdb/node-api";
import { timingSafeEqual, randomUUID } from "node:crypto";
import {
  mkdir,
  realpath,
  rm,
  stat,
  statfs,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { unzipSync } from "fflate";
import { z } from "zod";

const SlugSchema = z.string().regex(/^[a-z0-9_]+$/).max(80);
const VersionSchema = z.string().min(1).max(100);
const UploadFieldsSchema = z.object({
  title: z.string().trim().min(1).max(500),
  slug: SlugSchema,
  description: z.string().max(5_000).default(""),
  source_url: z.string().max(2_000).default(""),
  license: z.string().max(500).default("Unknown"),
  attribution: z.string().max(2_000).default(""),
});

type JsonRow = Record<string, unknown>;

export class DataServiceError extends Error {
  constructor(message: string, readonly status = 500) {
    super(message);
    this.name = "DataServiceError";
  }
}

declare global {
  // Next's development module graph is rebuilt frequently. Keeping these on
  // globalThis prevents several native instances from opening the same file.
  var chartizeDuckDb: Promise<DuckDBInstance> | undefined;
  var chartizeDataWriteQueue: Promise<void> | undefined;
}

function dataRoot() {
  return path.resolve(process.env.CHARTIZE_DATA_ROOT ?? path.resolve(process.cwd(), "../../data"));
}

function maxImportBytes() {
  const parsed = Number(process.env.MAX_IMPORT_BYTES ?? 524_288_000);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 524_288_000;
}

function quoteIdentifier(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

function quoteLiteral(value: string) {
  return `'${value.replaceAll("'", "''")}'`;
}

function safeFilename(value: string) {
  const filename = path.basename(value || "upload.bin");
  return [...filename].map((character) => /[a-z0-9._-]/i.test(character) ? character : "_").join("") || "upload.bin";
}

function extension(value: string) {
  return path.extname(value).slice(1).toLocaleLowerCase();
}

function asString(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}

function asNullableString(value: unknown) {
  const text = asString(value);
  return text ? text : undefined;
}

function parseFields(value: unknown) {
  try {
    return FieldMetadataSchema.array().parse(JSON.parse(asString(value)));
  } catch {
    return [];
  }
}

function manifestFromRow(row: JsonRow): DatasetManifest {
  return DatasetManifestSchema.parse({
    id: asString(row.id),
    slug: asString(row.slug),
    title: asString(row.title),
    description: asString(row.description),
    version: asString(row.version),
    tableName: asString(row.table_name),
    sourceUrl: asString(row.source_url),
    license: asString(row.license),
    attribution: asString(row.attribution),
    rowCount: Number(row.row_count),
    spatial: Boolean(row.spatial),
    geometryType: asNullableString(row.geometry_type),
    geographyLevel: asNullableString(row.geography_level),
    timeCoverage: asNullableString(row.time_coverage),
    publishedAt: asString(row.published_at),
    fields: parseFields(row.fields_json),
    joinHints: [],
  });
}

async function rows(connection: DuckDBConnection, sql: string, values?: Record<string, DuckDBValue>) {
  const reader = await connection.runAndReadAll(sql, values);
  return reader.getRowObjectsJson() as JsonRow[];
}

async function initializeDatabase(instance: DuckDBInstance) {
  const connection = await instance.connect();
  try {
    await connection.run(`CREATE TABLE IF NOT EXISTS dataset_versions (
      id VARCHAR PRIMARY KEY,
      slug VARCHAR NOT NULL,
      title VARCHAR NOT NULL,
      description VARCHAR NOT NULL,
      version VARCHAR NOT NULL,
      table_name VARCHAR NOT NULL,
      source_url VARCHAR NOT NULL,
      license VARCHAR NOT NULL,
      attribution VARCHAR NOT NULL,
      row_count UBIGINT NOT NULL,
      spatial BOOLEAN NOT NULL,
      geometry_type VARCHAR,
      geography_level VARCHAR,
      time_coverage VARCHAR,
      published_at VARCHAR NOT NULL,
      fields_json VARCHAR NOT NULL,
      parquet_path VARCHAR NOT NULL,
      original_path VARCHAR NOT NULL,
      browser_compatible BOOLEAN NOT NULL DEFAULT TRUE,
      active BOOLEAN NOT NULL DEFAULT FALSE
    )`);
    await connection.run("ALTER TABLE dataset_versions ADD COLUMN IF NOT EXISTS browser_compatible BOOLEAN DEFAULT TRUE");
    await connection.run("CREATE INDEX IF NOT EXISTS dataset_versions_slug ON dataset_versions(slug)");
  } finally {
    connection.closeSync();
  }
}

async function database() {
  if (!globalThis.chartizeDuckDb) {
    globalThis.chartizeDuckDb = (async () => {
      const root = dataRoot();
      await mkdir(path.join(root, "datasets"), { recursive: true });
      const current = path.join(root, "chartize.duckdb");
      const instance = await DuckDBInstance.fromCache(current);
      await initializeDatabase(instance);
      return instance;
    })();
  }
  return globalThis.chartizeDuckDb;
}

async function withConnection<T>(operation: (connection: DuckDBConnection) => Promise<T>) {
  const connection = await (await database()).connect();
  try {
    return await operation(connection);
  } finally {
    connection.closeSync();
  }
}

function serializedWrite<T>(operation: () => Promise<T>) {
  const previous = globalThis.chartizeDataWriteQueue ?? Promise.resolve();
  const result = previous.then(operation, operation);
  globalThis.chartizeDataWriteQueue = result.then(() => undefined, () => undefined);
  return result;
}

const MANIFEST_SELECT = `SELECT id, slug, title, description, version, table_name,
  source_url, license, attribution, row_count, spatial, geometry_type,
  geography_level, time_coverage, published_at, fields_json
FROM dataset_versions WHERE active = TRUE`;

export async function listDatasets() {
  return withConnection(async (connection) =>
    (await rows(connection, `${MANIFEST_SELECT} ORDER BY title`)).map(manifestFromRow)
  );
}

async function activeManifest(connection: DuckDBConnection, slug: string) {
  const result = await rows(connection, `${MANIFEST_SELECT} AND slug = $slug`, { slug });
  if (!result[0]) throw new DataServiceError(`Dataset '${slug}' was not found.`, 404);
  return manifestFromRow(result[0]);
}

function candidateDatasetPaths(storedPath: string, slug: string, version: string) {
  const root = dataRoot();
  return [
    storedPath,
    path.resolve(root, storedPath),
    path.join(root, "datasets", slug, version.replace(/-browser\d+$/, ""), "data.parquet"),
    path.join(root, "datasets", slug, version, "data.parquet"),
  ];
}

export async function activeDatasetArtifact(slugInput: string, versionInput: string) {
  const slug = SlugSchema.parse(slugInput);
  const version = VersionSchema.parse(versionInput);
  const record = await withConnection(async (connection) => {
    const result = await rows(connection,
      "SELECT parquet_path, version FROM dataset_versions WHERE active = TRUE AND slug = $slug",
      { slug },
    );
    if (!result[0]) throw new DataServiceError(`Dataset '${slug}' was not found.`, 404);
    return { storedPath: asString(result[0].parquet_path), activeVersion: asString(result[0].version) };
  });
  if (record.activeVersion !== version) {
    throw new DataServiceError(`Dataset '${slug}' version '${version}' is not active. Refresh the catalog.`, 404);
  }

  const managedRoot = await realpath(path.join(dataRoot(), "datasets"));
  for (const candidate of candidateDatasetPaths(record.storedPath, slug, version)) {
    try {
      const resolved = await realpath(candidate);
      if (resolved !== managedRoot && !resolved.startsWith(`${managedRoot}${path.sep}`)) continue;
      const metadata = await stat(resolved);
      return { path: resolved, version, size: metadata.size };
    } catch {
      // Try the next portable/legacy location.
    }
  }
  throw new DataServiceError(`The Parquet artifact for '${slug}' is missing.`, 404);
}

export function assertAdminToken(provided: string | null | undefined) {
  const expected = process.env.ADMIN_TOKEN ?? "change-me-in-production";
  const actualBytes = Buffer.from(provided ?? "");
  const expectedBytes = Buffer.from(expected);
  if (actualBytes.length !== expectedBytes.length || !timingSafeEqual(actualBytes, expectedBytes)) {
    throw new DataServiceError("A valid x-admin-token is required.", 401);
  }
}

function safeZipPath(name: string) {
  const normalized = name.replaceAll("\\", "/");
  const parts = normalized.split("/").filter(Boolean);
  if (!parts.length || parts.some((part) => part === "..")) return null;
  return parts;
}

async function extractZip(bytes: Uint8Array, target: string) {
  let archive: Record<string, Uint8Array>;
  try {
    archive = unzipSync(bytes);
  } catch (cause) {
    throw new DataServiceError(`ZIP import failed: ${cause instanceof Error ? cause.message : String(cause)}`, 400);
  }
  const shapefiles: string[] = [];
  const tabular: string[] = [];
  for (const [name, content] of Object.entries(archive)) {
    const parts = safeZipPath(name);
    if (!parts || name.endsWith("/")) continue;
    const output = path.join(target, "unpacked", ...parts);
    await mkdir(path.dirname(output), { recursive: true });
    await writeFile(output, content);
    const ext = extension(output);
    if (ext === "shp") shapefiles.push(output);
    else if (["csv", "tsv", "json", "ndjson", "geojson", "parquet", "geoparquet", "gpkg", "fgb", "kml"].includes(ext)) tabular.push(output);
  }
  if (shapefiles[0]) return shapefiles[0];
  tabular.sort((left, right) => {
    const leftPreferred = path.basename(left).includes("__ALL_AREAS") ? 0 : 1;
    const rightPreferred = path.basename(right).includes("__ALL_AREAS") ? 0 : 1;
    return leftPreferred - rightPreferred || left.length - right.length || left.localeCompare(right);
  });
  if (!tabular[0]) throw new DataServiceError("ZIP imports must contain a supported spatial or tabular file.", 400);
  return tabular[0];
}

function inferSemanticType(name: string, dataType: string): FieldMetadata["semanticType"] {
  const lowerName = name.toLocaleLowerCase();
  const upperType = dataType.toLocaleUpperCase();
  if (lowerName === "geometry" || upperType.includes("GEOMETRY") || upperType.includes("BLOB")) return "geometry";
  if (/date|year|time/.test(lowerName)) return "temporal";
  if (lowerName.endsWith("_id") || ["fips", "geoid", "statefp", "countyfp", "locationid"].includes(lowerName)) return "identifier";
  if (/INT|DOUBLE|FLOAT|DECIMAL|NUMERIC|HUGEINT|REAL/.test(upperType)) return "measure";
  return "dimension";
}

async function describeTable(connection: DuckDBConnection, table: string) {
  const result = await rows(connection, `DESCRIBE ${quoteIdentifier(table)}`);
  return result.map((field) => FieldMetadataSchema.parse({
    name: asString(field.column_name),
    dataType: asString(field.column_type),
    nullable: asString(field.null).toLocaleUpperCase() !== "NO",
    semanticType: inferSemanticType(asString(field.column_name), asString(field.column_type)),
  }));
}

async function normalizedSelect(connection: DuckDBConnection, importPath: string) {
  const ext = extension(importPath);
  const source = quoteLiteral(importPath);
  const sourceName = path.basename(importPath).toLocaleUpperCase();
  if (ext === "csv" && (sourceName.startsWith("CAINC") || sourceName.startsWith("CAGDP"))) {
    return `SELECT * FROM read_csv(${source}, HEADER=true, DELIM=',', QUOTE='"', SAMPLE_SIZE=-1, STRICT_MODE=false, NULL_PADDING=true, IGNORE_ERRORS=true)
      WHERE regexp_matches(trim(CAST("GeoFIPS" AS VARCHAR)), '^[0-9]{5}$')`;
  }
  if (ext === "csv") return `SELECT * FROM read_csv_auto(${source}, SAMPLE_SIZE=-1, HEADER=true)`;
  if (ext === "tsv") return `SELECT * FROM read_csv_auto(${source}, SAMPLE_SIZE=-1, HEADER=true, DELIM='\\t')`;
  if (ext === "json" || ext === "ndjson") return `SELECT * FROM read_json_auto(${source})`;
  if (ext === "parquet" || ext === "geoparquet") return `SELECT * FROM read_parquet(${source})`;
  if (["geojson", "shp", "gpkg", "fgb", "kml"].includes(ext)) {
    await connection.run("INSTALL spatial");
    await connection.run("LOAD spatial");
    return `SELECT * EXCLUDE (geom), ST_AsWKB(geom) AS geometry FROM ST_Read(${source})`;
  }
  throw new DataServiceError(`Unsupported import format: .${ext}`, 400);
}

async function availableBytes(root: string) {
  const result = await statfs(root);
  return BigInt(result.bavail) * BigInt(result.bsize);
}

function versionStamp(date = new Date()) {
  return `${date.toISOString().replace(/[-:TZ.]/g, "").slice(0, 17)}-${randomUUID().slice(0, 8)}`;
}

function stringField(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export async function publishDataset(formData: FormData) {
  return serializedWrite(async () => {
    const file = formData.get("file");
    if (!(file instanceof File) || !file.size) throw new DataServiceError("A data file is required.", 400);
    if (file.size > maxImportBytes()) throw new DataServiceError("Upload exceeds MAX_IMPORT_BYTES.", 400);
    const input = UploadFieldsSchema.parse({
      title: stringField(formData, "title"),
      slug: stringField(formData, "slug"),
      description: stringField(formData, "description"),
      source_url: stringField(formData, "source_url"),
      license: stringField(formData, "license") || "Unknown",
      attribution: stringField(formData, "attribution"),
    });
    const version = versionStamp();
    const root = dataRoot();
    const versionDirectory = path.join(root, "datasets", input.slug, version);
    const filename = safeFilename(file.name);
    const originalPath = path.join(versionDirectory, filename);
    await mkdir(versionDirectory, { recursive: true });
    const bytes = new Uint8Array(await file.arrayBuffer());
    await writeFile(originalPath, bytes);

    try {
      const free = await availableBytes(root);
      if (free < BigInt(bytes.byteLength * 3 + 500_000_000)) {
        throw new DataServiceError("The server does not have enough free space to stage this import safely.", 400);
      }
      const importPath = extension(filename) === "zip" ? await extractZip(bytes, versionDirectory) : originalPath;
      const ext = extension(importPath);
      const spatial = ["geojson", "geoparquet", "shp", "gpkg", "fgb", "kml"].includes(ext);
      const stagingTable = `dataset__${input.slug}__${version}`;
      const parquetPath = path.join(versionDirectory, "data.parquet");
      const manifest = await withConnection(async (connection) => {
        const select = await normalizedSelect(connection, importPath);
        await connection.run(`CREATE TABLE ${quoteIdentifier(stagingTable)} AS ${select}`);
        try {
          const countResult = await rows(connection, `SELECT COUNT(*) AS n FROM ${quoteIdentifier(stagingTable)}`);
          const rowCount = Number(countResult[0]?.n ?? 0);
          const fields = await describeTable(connection, stagingTable);
          await connection.run(`COPY ${quoteIdentifier(stagingTable)} TO ${quoteLiteral(parquetPath)} (FORMAT PARQUET, COMPRESSION UNCOMPRESSED)`);
          const nextManifest = DatasetManifestSchema.parse({
            id: randomUUID(),
            slug: input.slug,
            title: input.title,
            description: input.description,
            version,
            tableName: input.slug,
            sourceUrl: input.source_url,
            license: input.license,
            attribution: input.attribution,
            rowCount,
            spatial,
            geometryType: spatial ? "geometry" : undefined,
            publishedAt: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
            fields,
            joinHints: [],
          });
          await connection.run("BEGIN TRANSACTION");
          try {
            await connection.run("UPDATE dataset_versions SET active = FALSE WHERE slug = $slug", { slug: input.slug });
            await connection.run(`INSERT INTO dataset_versions (
              id, slug, title, description, version, table_name, source_url, license, attribution,
              row_count, spatial, geometry_type, geography_level, time_coverage, published_at,
              fields_json, parquet_path, original_path, browser_compatible, active
            ) VALUES (
              $id, $slug, $title, $description, $version, $tableName, $sourceUrl, $license, $attribution,
              $rowCount, $spatial, $geometryType, NULL, NULL, $publishedAt,
              $fieldsJson, $parquetPath, $originalPath, TRUE, TRUE
            )`, {
              id: nextManifest.id,
              slug: nextManifest.slug,
              title: nextManifest.title,
              description: nextManifest.description,
              version: nextManifest.version,
              tableName: nextManifest.tableName,
              sourceUrl: nextManifest.sourceUrl,
              license: nextManifest.license,
              attribution: nextManifest.attribution,
              rowCount: BigInt(nextManifest.rowCount),
              spatial: nextManifest.spatial,
              geometryType: nextManifest.geometryType ?? null,
              publishedAt: nextManifest.publishedAt,
              fieldsJson: JSON.stringify(nextManifest.fields),
              parquetPath: path.relative(root, parquetPath),
              originalPath: path.relative(root, originalPath),
            });
            await connection.run("COMMIT");
          } catch (cause) {
            await connection.run("ROLLBACK");
            throw cause;
          }
          return nextManifest;
        } finally {
          await connection.run(`DROP TABLE IF EXISTS ${quoteIdentifier(stagingTable)}`);
        }
      });
      return manifest;
    } catch (cause) {
      await rm(versionDirectory, { recursive: true, force: true });
      if (cause instanceof DataServiceError || cause instanceof z.ZodError) throw cause;
      throw new DataServiceError(cause instanceof Error ? cause.message : String(cause));
    }
  });
}

export async function rollbackDataset(slugInput: string) {
  const slug = SlugSchema.parse(slugInput);
  return serializedWrite(() => withConnection(async (connection) => {
    const previous = await rows(connection,
      "SELECT id FROM dataset_versions WHERE slug = $slug AND active = FALSE ORDER BY published_at DESC LIMIT 1",
      { slug },
    );
    const id = asString(previous[0]?.id);
    if (!id) throw new DataServiceError("No previous version is available.", 404);
    await connection.run("BEGIN TRANSACTION");
    try {
      await connection.run("UPDATE dataset_versions SET active = FALSE WHERE slug = $slug", { slug });
      await connection.run("UPDATE dataset_versions SET active = TRUE WHERE id = $id", { id });
      await connection.run("COMMIT");
    } catch (cause) {
      await connection.run("ROLLBACK");
      throw cause;
    }
    return activeManifest(connection, slug);
  }));
}

export async function dataServiceHealth() {
  const root = dataRoot();
  await database();
  return { ok: true, freeBytes: (await availableBytes(root)).toString(), ggsql: "0.4.1" };
}

export function dataServiceErrorResponse(cause: unknown, fallback = "The Chartize data service failed.") {
  if (cause instanceof z.ZodError) return Response.json({ error: cause.issues[0]?.message ?? fallback }, { status: 400 });
  if (cause instanceof DataServiceError) return Response.json({ error: cause.message }, { status: cause.status });
  return Response.json({ error: cause instanceof Error ? cause.message : fallback }, { status: 500 });
}

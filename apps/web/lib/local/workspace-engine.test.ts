import { readFile } from "node:fs/promises";
import init from "ggsql-wasm";
import { beforeAll, describe, expect, it } from "vitest";
import {
  executeWorkspaceGgsql,
  executeWorkspaceSqlRaw,
  registerWorkspaceSource,
  releaseWorkspaceEngine,
  resetWorkspacesContainingSource,
} from "./workspace-engine";

beforeAll(async () => {
  const wasm = await readFile(new URL("../../node_modules/ggsql-wasm/ggsql_wasm_bg.wasm", import.meta.url));
  await init({ module_or_path: wasm });
});

async function cleanupFixture() {
  const file = await readFile(new URL("./local-upload-cleanup.fixture.csv", import.meta.url));
  return file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer;
}

describe("workspace-scoped GGSQL engines", () => {
  it("keeps local table mutations isolated between workspaces", async () => {
    const source = new TextEncoder().encode("name,value\nalpha,1\nbeta,2\n").buffer;
    const first = `mutation-a-${crypto.randomUUID()}`;
    const second = `mutation-b-${crypto.randomUUID()}`;
    await registerWorkspaceSource(first, "sample", "csv", source.slice(0), "v1");
    await registerWorkspaceSource(second, "sample", "csv", source.slice(0), "v1");

    await executeWorkspaceSqlRaw(first, "UPDATE sample SET value = value + 10");
    const changed = await executeWorkspaceSqlRaw(first, "SELECT value FROM sample ORDER BY name");
    const canonical = await executeWorkspaceSqlRaw(second, "SELECT value FROM sample ORDER BY name");

    expect(changed.rows).toEqual([["11"], ["12"]]);
    expect(canonical.rows).toEqual([["1"], ["2"]]);
  });

  it("can visualize the final result after a workspace-local mutation", async () => {
    const source = new TextEncoder().encode("name,value\nalpha,1\nbeta,2\n").buffer;
    const workspaceId = `mutation-visual-${crypto.randomUUID()}`;
    await registerWorkspaceSource(workspaceId, "sample", "csv", source, "v1");

    const specification = await executeWorkspaceGgsql(workspaceId, `UPDATE sample SET value = value + 10;
SELECT name, value FROM sample

VISUALISE
DRAW bar
  MAPPING name AS x, value AS y
LABEL title => 'Mutated locally'`);

    expect(specification).toMatchObject({ title: "Mutated locally" });
    const changed = await executeWorkspaceSqlRaw(workspaceId, "SELECT value FROM sample ORDER BY name");
    expect(changed.rows).toEqual([["11"], ["12"]]);
  });

  it("supports the portable local-upload cleanup recipe used by Chartize AI", async () => {
    const workspaceId = `cleanup-visual-${crypto.randomUUID()}`;
    await registerWorkspaceSource(workspaceId, "upload", "csv", await cleanupFixture(), "v1");

    const specification = await executeWorkspaceGgsql(workspaceId, `DROP TABLE IF EXISTS cleaned_upload;
CREATE TEMP TABLE cleaned_upload AS
WITH RECURSIVE source_rows AS (
  SELECT ROW_NUMBER() OVER () AS row_id,
    LOWER(TRIM(CAST(city AS VARCHAR))) AS city_key,
    CAST(year AS INTEGER) AS year,
    LOWER(TRIM(CAST(category AS VARCHAR))) AS category,
    CAST(NULLIF(NULLIF(LOWER(TRIM(CAST(value AS VARCHAR))), 'null'), '') AS DOUBLE) AS raw_value
  FROM upload
),
city_chars(row_id, city_key, pos, city) AS (
  SELECT row_id, city_key, 1, '' FROM source_rows
  UNION ALL
  SELECT row_id, city_key, pos + 1,
    city || CASE
      WHEN pos = 1 OR SUBSTR(city_key, pos - 1, 1) IN (' ', '-') THEN UPPER(SUBSTR(city_key, pos, 1))
      ELSE SUBSTR(city_key, pos, 1)
    END
  FROM city_chars WHERE pos <= LENGTH(city_key)
),
normalized AS (
  SELECT chars.city, rows.year,
    CASE WHEN rows.category = 'north east' THEN 'northeast' ELSE rows.category END AS category,
    rows.raw_value
  FROM source_rows AS rows
  JOIN city_chars AS chars ON rows.row_id = chars.row_id AND chars.pos = LENGTH(chars.city_key) + 1
),
with_means AS (
  SELECT *, AVG(raw_value) OVER (PARTITION BY city) AS city_average, AVG(raw_value) OVER () AS overall_average
  FROM normalized
)
SELECT city, year, CAST(year AS VARCHAR) AS year_label, category,
  COALESCE(raw_value, city_average, overall_average) AS value
FROM with_means;

SELECT city, year, year_label, category, value FROM cleaned_upload ORDER BY city, year

VISUALISE
DRAW bar
  MAPPING city AS x, value AS y, year_label AS fill
  SETTING position => 'dodge'
SCALE DISCRETE fill TO Set2
LABEL title => 'Cleaned local upload', x => 'City', y => 'Value', fill => 'Year'`);

    expect(specification).toMatchObject({ title: "Cleaned local upload" });
    const cleaned = await executeWorkspaceSqlRaw(workspaceId, "SELECT city, year, value FROM cleaned_upload ORDER BY city, year");
    expect(cleaned.rows).toEqual([
      ["Austin", "2022", "130"],
      ["Austin", "2023", "130"],
      ["Boston", "2022", "80"],
      ["Boston", "2023", "95"],
      ["New York", "2022", "100"],
      ["New York", "2023", "100"],
    ]);
  });

  it("accepts the compact cleanup form emitted after an AI repair", async () => {
    const source = new TextEncoder().encode("city,year,value,category\nNew York,2022,100,east\nnew york,2023,,east\n").buffer;
    const workspaceId = `cleanup-repair-${crypto.randomUUID()}`;
    await registerWorkspaceSource(workspaceId, "upload", "csv", source, "v1");
    const candidate = `DROP TABLE IF EXISTS local_upload_cleaned;
CREATE TEMP TABLE local_upload_cleaned AS
WITH RECURSIVE source_rows AS (
  SELECT ROW_NUMBER() OVER () AS row_id,
    LOWER(TRIM(CAST(city AS VARCHAR))) AS city_key,
    CAST(year AS INTEGER) AS year_value,
    CAST(NULLIF(NULLIF(LOWER(TRIM(CAST(value AS VARCHAR))), 'null'), '') AS DOUBLE) AS value_raw,
    LOWER(TRIM(CAST(category AS VARCHAR))) AS category
  FROM upload
),
city_chars(row_id, city_key, pos, city) AS (
  SELECT row_id, city_key, 1, '' FROM source_rows
  UNION ALL
  SELECT row_id, city_key, pos + 1,
    city || CASE
      WHEN pos = 1 OR SUBSTR(city_key, pos - 1, 1) IN (' ', '-') THEN UPPER(SUBSTR(city_key, pos, 1))
      ELSE SUBSTR(city_key, pos, 1)
    END
  FROM city_chars WHERE pos <= LENGTH(city_key)
),
normalized AS (
  SELECT s.row_id, c.city, s.year_value, s.value_raw, s.category
  FROM source_rows AS s
  JOIN city_chars AS c ON s.row_id = c.row_id
  WHERE c.pos = LENGTH(c.city_key) + 1
),
with_means AS (
  SELECT *, AVG(value_raw) OVER (PARTITION BY city) AS city_average, AVG(value_raw) OVER () AS overall_average
  FROM normalized
)
SELECT row_id, city, year_value, COALESCE(value_raw, city_average, overall_average) AS value, category
FROM with_means;

SELECT city, year_value, CAST(year_value AS VARCHAR) AS year_label, value, category
FROM local_upload_cleaned
ORDER BY city, year_value

VISUALISE
DRAW bar
  MAPPING city AS x, value AS y, year_label AS fill
  SETTING position => 'dodge'
SCALE DISCRETE fill TO tableau10
LABEL title => 'Value by City and Year', x => 'City', y => 'Value', fill => 'Year'`;
    const specification = await executeWorkspaceGgsql(workspaceId, candidate);
    expect(specification).toMatchObject({ title: "Value by City and Year" });
  });

  it("drops a workspace's derived tables when its local source is removed", async () => {
    const workspaceId = `cleanup-delete-${crypto.randomUUID()}`;
    await registerWorkspaceSource(workspaceId, "upload", "csv", new TextEncoder().encode("value\n1\n").buffer, "v1");
    await executeWorkspaceSqlRaw(workspaceId, "CREATE TEMP TABLE derived AS SELECT value + 1 AS value FROM upload");
    expect((await executeWorkspaceSqlRaw(workspaceId, "SELECT value FROM derived")).rows).toEqual([["2"]]);

    expect(resetWorkspacesContainingSource("upload")).toContain(workspaceId);
    await expect(executeWorkspaceSqlRaw(workspaceId, "SELECT value FROM derived")).rejects.toThrow("no such table");
  });

  it("releases registered and derived tables when a workspace closes", async () => {
    const workspaceId = `closed-${crypto.randomUUID()}`;
    await registerWorkspaceSource(
      workspaceId,
      "sample",
      "csv",
      new TextEncoder().encode("value\n1\n").buffer,
      "v1",
    );
    await executeWorkspaceSqlRaw(workspaceId, "CREATE TEMP TABLE derived AS SELECT value + 1 AS value FROM sample");

    releaseWorkspaceEngine(workspaceId);

    await expect(executeWorkspaceSqlRaw(workspaceId, "SELECT value FROM sample")).rejects.toThrow("no such table");
    await expect(executeWorkspaceSqlRaw(workspaceId, "SELECT value FROM derived")).rejects.toThrow("no such table");
    releaseWorkspaceEngine(workspaceId);
  });
});

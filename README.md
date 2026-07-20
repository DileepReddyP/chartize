# Chartize

A self-hosted data warehouse and GGSQL visualization workspace. It combines a native DuckDB/GGSQL service for published data with a browser-local GGSQL WASM path for private files.

The explorer—not a promotional homepage—is the product surface. It is a cursor-led DWIM workspace: Monaco GGSQL stays primary, while sources, fields, visual parameters, table ranges, and chart ranges expose contextual controls at the selection. The raw source stream, query result, and chart remain visible in three resizable panes. It also supports Vega-Lite rendering, PNG/SVG/share-card export, local workspace persistence, warehouse queries, and opt-in AI assistance.

![Chartize workspace with GGSQL, source data, and a linked chart](./docs/images/chartize-workspace.webp)

## Execution boundary

| Input | Where it is stored | Where GGSQL runs |
| --- | --- | --- |
| Published Census, polling, election, or geographic datasets | Versioned Parquet plus provenance files on the VPS | Native Rust GGSQL + DuckDB on the VPS |
| Visitor CSV, TSV, JSON/NDJSON, Parquet, GeoJSON, or zipped Shapefile | Browser memory; IndexedDB only after **Save local** | GGSQL WASM in a Web Worker |
| AI query generation | Only schema by default; up to 20 preview rows after opt-in | Next.js server route using OpenAI or Azure OpenAI |
| Multimodal chart critique | Rendered chart and query after a confirmation dialog | Next.js server route |

The server is not merely a file API. It executes shared queries, enforces read-only policy, owns catalog metadata, profiles imports, publishes stable views, and rolls datasets back between immutable versions.

Chartize AI is one workspace-scoped Terra conversation, not a separate generator bolted onto each pane. Cursor ranges, selected rows, and individual geographic features can become its active context; with permission it can query bounded warehouse data or use grounded web search.

![Chartize AI comparing a selected county with its statewide peers](./docs/images/chartize-ai-county-context.webp)

## Stack

- Frontend: Next.js 16, React 19, Monaco, Vega/Vega-Lite, `ggsql-wasm`, and a Zod-inferred Zustand workspace store
- Browser conversion: `hyparquet-writer`, a GeoJSON-to-WKB encoder, and `shpjs`
- Warehouse API: Rust, Axum, GGSQL 0.4.1, DuckDB
- Storage: one DuckDB catalog plus Zstd-compressed Parquet and original provenance files under `data/`
- AI: one Responses API conversation per workspace, using `gpt-5.6-terra`; optional Azure OpenAI deployment
- Deployment: Docker Compose and Caddy on a single VPS

## Run locally

Requirements: Node 24+, pnpm 10+, Rust 1.95+.

```bash
cp .env.example apps/web/.env.local
pnpm install
pnpm fetch:spatialite
ADMIN_TOKEN=local-dev-token pnpm dev
```

Open `http://localhost:3000/explore`. The engine listens on `127.0.0.1:8787`; use `local-dev-token` on `/admin`. The built-in penguins source works without importing data or configuring AI.

In a second terminal, publish the six-dataset starter warehouse:

```bash
ADMIN_TOKEN=local-dev-token pnpm data:seed
```

The penguins entry is an embedded GGSQL engine smoke test, not warehouse data. The full prioritized acquisition list and refresh notes are in [`datasets/README.md`](./datasets/README.md).

For AI, put `OPENAI_API_KEY` in the environment used by Next.js. For Azure set `AI_PROVIDER=azure` and supply the Azure endpoint, key, deployment name, and supported API version. A deployment name is not a universal model entitlement: confirm the model is available in the Azure region/subscription before depending on student credits.

## VPS deployment

```bash
cp .env.example .env
# Set a long random ADMIN_TOKEN, SITE_ADDRESS, and optionally an AI provider key.
docker compose up --build -d
```

Set `SITE_ADDRESS=studio.example.com` for automatic HTTPS. Only Caddy is public; the warehouse engine remains inside the Compose network and the web server proxies `/engine/*` at runtime.

For a preview subdomain behind host Nginx and Basic Auth, use [`docs/VPS_DEPLOYMENT.md`](./docs/VPS_DEPLOYMENT.md). It includes the archive/copy flow, private Compose services, one-shot warehouse seeding, TLS, credentials, backups, and updates.

The default 70 GB VPS layout is deliberately simple:

```text
data/
  warehouse.duckdb
  datasets/<slug>/<version>/
    <original upload>
    data.parquet
```

Back up `data/` as one unit. Imports refuse to begin unless there is room for the upload, normalized copy, and a 500 MB reserve. Set `MAX_IMPORT_BYTES` below your reverse-proxy limit.

## Steward workflow

1. Visit `/admin` and enter `ADMIN_TOKEN`.
2. Upload CSV/TSV, JSON/NDJSON, Parquet, GeoJSON, GeoPackage, FlatGeobuf, KML, Shapefile, or a Shapefile ZIP.
3. Add title, stable lowercase slug, source, license, and attribution.
4. The service saves the original, normalizes a version to Parquet, profiles its schema and row count, and atomically points the stable view at it.
5. **Rollback** moves the view to the most recent inactive version without deleting either version.

Geo formats are read with DuckDB Spatial and published with WKB geometry so GGSQL can safely move the data through Arrow.

## Query and privacy safeguards

- Warehouse requests must validate as GGSQL, contain a visualization, and use a single `SELECT`/`WITH` statement.
- DDL/DML, extension loading, file readers, remote URLs, attach/copy/export operations, and pragmas are blocked in public queries.
- The browser worker has a 100 MB per-file safety limit; the VPS limit is separately configurable.
- AI calls use `store: false`. Row samples are omitted unless the user checks the consent control; chart images require an additional confirmation.
- Admin imports require `x-admin-token`, entered at the steward screen and never stored by the app.

## Verification

```bash
pnpm typecheck
pnpm test
pnpm build
cargo check --manifest-path services/engine/Cargo.toml
```

The `.cargo/config.toml` uses the generated parser included with `tree-sitter-ggsql`, so a global Tree-sitter CLI is not required.

The post-pivot architecture review, resolved hazards, and remaining extraction seams are documented in [`docs/CODE_AUDIT.md`](./docs/CODE_AUDIT.md).

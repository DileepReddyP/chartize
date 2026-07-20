# Code audit

This audit follows the product pivots that produced the current cursor-led workspace. The runtime now has one Zod-validated Zustand source of truth, one Chartize AI conversation per workspace, and one browser-worker execution path for published and visitor data.

## Current boundaries

- `lib/workspace/store.ts` owns validated workspace documents and cross-pane actions: query scheduling, source and visual edits, lazy table reads, selections, AI turns, browser save/restore, and workspace switching. It calls a typed browser-runtime facade and contains no network or storage implementation.
- `components/explorer.tsx` is a 116-line composition root. The code, table, result, AI overlay, and selection behavior live in focused `workspace-*` components; their remaining local state is ephemeral DOM/editor behavior.
- `lib/local/browser-runtime.ts` is the main-thread boundary. It validates commands and delegates them to `LocalEngineClient`; it does not expose URLs or IndexedDB.
- `workers/ggsql.worker.ts` is the only data execution and persistence surface used by the explorer. It owns catalog hydration, local uploads, GGSQL, SQL, workspace persistence, and AI data rounds.
- `lib/local/worker-database.ts` owns Dexie tables for the catalog, exact canonical Parquet artifacts, local-source bytes, and saved workspace documents.
- `lib/local/worker-source-registry.ts` resolves namespaces. `chartize:` misses request only a typed catalog or exact `{slug, version}` artifact; `user:` sources never use the data service.
- `lib/local/workspace-engine.ts` gives every workspace its own mutable `GgsqlContext`. All workspaces may reuse the same canonical bytes, but mutations and derived tables remain isolated.
- `components/chart-view.tsx` owns Vega embedding, exports, range gestures, map pan/zoom, and mark selection. It reports selections to Zustand rather than keeping competing workspace state.
- `app/api/ai/query` is a structured model relay. The worker may send it bounded context and satisfy a model data request locally, but the relay cannot query VPS data directly.
- `lib/server/data-service.ts` and the explicit `app/engine/api/*` Next.js routes own catalog metadata, exact Parquet-version downloads, steward imports, profiling, and rollback. They expose no arbitrary-SQL route.

## Hazards removed

- The native and browser query split was removed. A `chartize:` reference hydrates the exact Parquet version into the same browser engine used by `user:` and embedded sources.
- Browser-to-server raw SQL, remote validation, and server-side AI data-query routes were removed.
- The obsolete regex read-only validator was removed. Local setup statements and mutations are allowed inside an isolated workspace without expanding server authority.
- Query timers, async sequence guards, file registration, table caches, AI repair flow, and persistence were moved out of React callback closures and into stable Zustand actions.
- Removing a local source resets every workspace engine that registered it, so derived tables cannot outlive their source accidentally.
- Blank workspaces no longer inherit the default chart; empty GGSQL produces a neutral grid and remains valid.
- Stale query, table-page, and feature-detail results cannot overwrite a newer action.
- Map clicks remain mark selections until pointer movement crosses the pan threshold.
- PNG and SVG exports use the active Vega view and include the title and subtitle.

## Browser acceptance evidence

- Cold load: the worker requested the catalog and one exact Parquet version, persisted it in Dexie, and rendered 544 selected rows.
- Warm reload: the same workspace rendered from Dexie with no catalog or Parquet request.
- Mutation isolation: one workspace updated an approval table by 10 points; a new workspace still read the canonical value.
- Local CSV: a six-row file was uploaded through the UI, cleaned by Chartize AI into an idempotent derived table, and visualized. Raw casing and nulls remained visible in the source table.
- Local deletion: removing that CSV reset its dependent workspace and blanked the chart/table. The entire upload, AI cleanup, and deletion path made no data-service request.
- AI repair: unsupported SQL emitted during the cleanup was diagnosed by the real browser engine and repaired into the supported SQLite-like dialect.
- Example suite: all 12 retained examples loaded and rendered in Chrome, accepted an inline title edit, and reran without a visible or console diagnostic. This includes the Census/CDC and BEA/CDC joins that previously failed.
- Literal annotations: the official `PLACE rule` plus `PLACE text` form rendered one dated crossover marker without repeating a label for every observation.

## Remaining seams

- `lib/workspace/store.ts` is intentionally the large domain coordinator. New render behavior should stay in components; new engine/storage behavior should stay behind the worker protocol rather than adding another controller.
- The centralized Vanilla Extract sheet is practical while the visual language is changing; stable component groups can later move into colocated recipes.
- Pointer arbitration, portal layering, worker/Dexie network behavior, and AI repair are verified in real Chrome. A component-browser harness would make those regressions faster to isolate.
- Imports are synchronous and appropriate for a five-day preview. A larger deployment would benefit from persistent jobs and resumable acquisition.

The deployment remains intentionally small: one Next.js process, one metadata database, versioned Parquet artifacts, and one workspace-scoped AI conversation. The data routes share the web process, while SQL execution and browser persistence remain isolated in the worker.

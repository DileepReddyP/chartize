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
- Closing an example or user workspace releases its WASM context, registrations, and in-flight source bookkeeping instead of retaining every opened map for the life of the worker.
- Namespaced sources are discovered across the complete GGSQL program, including a layer-level `FROM`, so a map underlay follows the same typed hydration path as SQL sources.
- Map clicks remain mark selections until pointer movement crosses the pan threshold.
- PNG and SVG exports use the active Vega view and include the title and subtitle.
- Point, bar, line, and map selections share one persisted selection model and one height-bounded inspector. Selected items receive direct chart labels plus scrollable details and Shift-click multi-selection; rectangular selections reuse that inspector while retaining corner handles, mark counts, data bounds, copy, CSV export, zoom, and AI context actions.
- Projected maps may replace an opaque numeric linewidth legend with a Vega-native tapered key, so the visual encoding remains understandable in the live chart and in exported PNG/SVG files.
- The desktop three-pane editor becomes graph-first tabs at tablet and phone widths. Code and full data remain one tap away, while a persistent Chartize AI entry stays beneath the active graph without introducing document-level scrolling.

## Browser acceptance evidence

- Cold load: the worker requested the catalog and one exact Parquet version, persisted it in Dexie, and rendered 544 selected rows.
- Warm reload: the same workspace rendered from Dexie with no catalog or Parquet request.
- Mutation isolation: one workspace updated an approval table by 10 points; a new workspace still read the canonical value.
- Local CSV: a six-row file was uploaded through the UI, cleaned by Chartize AI into an idempotent derived table, and visualized. Raw casing and nulls remained visible in the source table.
- Local deletion: removing that CSV reset its dependent workspace and blanked the chart/table. The entire upload, AI cleanup, and deletion path made no data-service request.
- AI repair: unsupported SQL emitted during the cleanup was diagnosed by the real browser engine and repaired into the supported SQLite-like dialect.
- Example suite: all 23 examples loaded and rendered nonempty results in Chrome without a visible query diagnostic. This includes Census/CDC and BEA/CDC links, three official MTA views, two NOAA weather views, worldwide population/development/climate/food views, and the USDA equal-area land-use atlas.
- Semantic map check: the county population-change view fitted the returned national geometry without clipping the West Coast and used red for decline, yellow near zero, and green for growth.
- Session check: a hard reload restored the active workspace and its local CSV, while repeatedly opened example workspaces were closed and removed from the saved session.
- Literal annotations: the official `PLACE rule` plus `PLACE text` form rendered one dated crossover marker without repeating a label for every observation.
- Selection semantics: a subway route, a country bubble, and a dragged multi-point range were selected in Chrome. Each retained its highlight and details; the range persisted with four resize handles and exposed zoom, copy, download, clear, and AI handoff actions.
- Homepage production pass: all eight editorial cards reached a rendered state with no loading/error panel. The approval, subway, world population, development, temperature, weather-calendar, cocoa, and land-use views were visually inspected, and the production console reported no warnings, errors, or browser issues.
- Homepage chart lifecycle: each locally resolved Vega specification is rendered once to SVG and immediately finalized. The finished gallery retains eight crisp chart images and no live Vega views, canvases, tooltips, or chart interaction handlers.
- Responsive pass: the homepage and explorer were inspected at 1440×900, 1024×768, and 390×844. Graph/code/data tabs, compact header controls, the bottom AI entry, the full-height AI conversation, chart titles, date axes, the subway map, and two-line gallery titles remained usable without horizontal or full-page overflow.

## Remaining seams

- `lib/workspace/store.ts` is intentionally the large domain coordinator. It now contains stable cross-pane actions rather than a second layer of React callbacks; new render behavior should stay in components and new engine/storage behavior should stay behind the worker protocol.
- The centralized Vanilla Extract sheet is practical while the visual language is changing; stable component groups can later move into colocated recipes.
- Pointer arbitration, portal layering, worker/Dexie network behavior, and AI repair are verified in real Chrome. A component-browser harness would make those regressions faster to isolate.
- Imports are synchronous and appropriate for a five-day preview. A larger deployment would benefit from persistent jobs and resumable acquisition.

The deployment remains intentionally small: one Next.js process, one metadata database, versioned Parquet artifacts, and one workspace-scoped AI conversation. The data routes share the web process, while SQL execution and browser persistence remain isolated in the worker.

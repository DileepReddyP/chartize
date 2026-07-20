# Code audit

This audit follows the rapid product pivots that produced the current DWIM workspace. The runtime now has one source of truth for workspace state, one Chartize AI conversation per workspace, and a deliberately narrow boundary between browser-private data and the VPS warehouse.

## Current boundaries

- `lib/workspace/store.ts` owns Zod-validated workspace documents and all cross-pane actions. Switching workspaces captures and restores the query, chart state, table state, selections, map viewport, pane ratios, and independent AI history.
- `components/explorer.tsx` is the coordinator. It resolves namespaced sources, selects the local or warehouse execution path, rejects mixed-browser/server joins, and guards asynchronous results with monotonically increasing request IDs.
- `components/chart-view.tsx` owns Vega embedding, exports, range gestures, map pan/zoom, and mark selection. It reports selections upward instead of maintaining a competing copy of workspace state.
- `lib/ai/*` builds a compact catalog snapshot, supplies one read-only warehouse tool, runs a single stateless Responses API turn, validates structured output, and performs one focused GGSQL repair when the real engine rejects syntax.
- `services/engine` is the authority for imports, immutable dataset versions, previews, GGSQL validation/execution, and bounded AI data queries.

## Hazards removed

- Pivot-era explanation/generation schemas and the separate pseudo-agent paths were removed. All AI entry points continue the same workspace conversation.
- Component-local cross-pane state was consolidated into Zustand; persisted shapes and defaults remain Zod-validated.
- Catalog, source-page, executed-query, and selected-feature requests are coalesced and bounded with small LRU-style caches. Failed promises evict themselves.
- Blank workspaces no longer inherit the default presidential chart; empty GGSQL renders a neutral grid and remains a valid workspace state.
- Stale asynchronous query, source-page, and feature-detail responses cannot overwrite a newer user action.
- Public and AI SQL paths enforce a single read-only `SELECT`/`WITH` statement on both the Next and Rust boundaries. Mutation, extension loading, attachment, file/network readers, dynamic table readers, metadata scans, and internal catalog access are blocked.
- Map clicks remain mark selections until pointer movement crosses the pan threshold. Normal mouse jitter neither captures the pointer nor clears the selected feature.
- PNG and SVG exports are generated from the active Vega view and include the active title and subtitle.

## Remaining seams

- `Explorer` is still a large coordinator. Its responsibilities are coherent, but the next maintainability pass should extract `useQueryRunner`, `useSourceDock`, and `useChartizeConversation` without introducing another state layer.
- The global Vanilla Extract sheet is intentionally centralized while the visual language is moving quickly. Stable component groups can later move into colocated recipes.
- Unit coverage is strong around parsing, stores, AI context/tools, caching, geometry, and presentation transforms. Pointer arbitration and portal layering are still verified with real Chrome rather than a component-browser test harness.
- Imports are synchronous and appropriate for a single 70 GB preview VPS. Production-scale refreshes would benefit from a persistent job queue, progress records, and resumable downloads.

These are bounded extraction opportunities rather than hidden duplicate architectures. The current implementation keeps the hackathon path simple: one browser application, one Rust engine, one DuckDB catalog, versioned Parquet artifacts, and one AI conversation model.

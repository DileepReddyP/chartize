# GPT-6 Luna evaluation

September 22, 2026. Measurements were collected locally.

Chartize now defaults to `gpt-6-luna`. The OpenAI Docs migration check confirmed compatibility with the existing Responses API settings: Fast mode (`service_tier: "priority"`), explicit 30-minute prompt caching, structured output, parallel function calls, and the current reasoning levels. Azure deployment names and historical GPT-5.6 build/evaluation references remain unchanged. See [GPT-6 Luna](https://developers.openai.com/api/docs/models/gpt-6-luna) and [Fast mode](https://developers.openai.com/api/docs/guides/fast-mode).

## Paired comparison

Two runs per model, 16 user turns each. Run order: GPT-5.6, GPT-6, GPT-6, GPT-5.6. The initial comparison held prompts, tools, budgets, and thinking policy unchanged. Auto starts at medium and can increase effort; the second GPT-5.6 complex edit chose high. Fast mode was requested for both models; these reports do not record the service tier actually served.

Timings include API round trips and reference tools, plus the selected-row continuation where needed. Chart-edit timings end when the model returns its candidate, before compilation or repair. This is a small, live-network sample with both cold and warm cache requests, not a controlled latency benchmark.

| Task | GPT-5.6 Luna median | GPT-6 Luna median |
| --- | ---: | ---: |
| Subway naming question and follow-up (4 turns/model) | 7.41 s | 5.03 s |
| Lookup with fixed prior conversation | 7.48 s | 8.02 s |
| Current subway news | 15.60 s | 11.69 s |
| Average of two selected marks | 5.91 s | 4.33 s |
| Change only the chart title | 6.40 s | 8.37 s |
| Explain the code at the cursor | 3.27 s | 2.83 s |
| Label the five highest-delay routes | 23.48 s | 21.15 s |
| All 16 turns | 7.14 s | 6.66 s |

Mean latency was 10.30 s versus 8.30 s. The median improved about 7%; some tasks were slower. GPT-6 made extra reference calls on title edits and some data questions, despite generally faster simple answers.

## Token cost

| Across 16 turns | GPT-5.6 Luna | GPT-6 Luna |
| --- | ---: | ---: |
| Model responses | 29 | 33 |
| Input tokens | 331,496 | 379,961 |
| Cached input tokens | 164,943 | 195,488 |
| Cache-write tokens | 12,218 | 6,109 |
| Output tokens, including reasoning | 14,083 | 14,503 |
| Estimated Fast-mode token cost | $0.10824 | $0.05561 |
| Extrapolated token cost per 1,000 turns of this mix | $6.76 | $3.48 |

The estimated token cost fell about 49%, even though GPT-6 used more input tokens and model responses. These estimates exclude native web-search fees, subsequent repair experiments, and UI smoke tests; they are not an all-inclusive production price or spending cap. Both models used paid web research in two of the 16 comparison turns. A web-enabled response can contain multiple search/open events, so the event log does not establish the exact billed tool count.

The calculation uses the published short-context Fast rates per million tokens: GPT-6 Luna input/cache-read/cache-write/output at $0.20/$0.02/$0.25/$1.00; GPT-5.6 Luna at $0.40/$0.04/$0.50/$2.40. Cache reads and writes are charged separately from the remaining input; reasoning is already included in output. [OpenAI pricing](https://developers.openai.com/api/docs/pricing).

## What the tests found

- All initial research, DWIM, selected-row continuation, and title-edit response checks passed. Background lookups used Wikipedia, not paid web search. Both models returned the correct selected-row average, approximately 1.67042 minutes. All four title edits changed only the title and compiled.
- Executing the complex candidates in the actual GGSQL WASM engine exposed one first-pass parse failure per model. Both also failed two repair attempts with the original reference. The parser rejects table-qualified names and expressions inside window `PARTITION BY`/`ORDER BY`. The local GGSQL reference now explains how to stage values in a CTE and rank unqualified aliases; a small executable regression test covers that recipe. Both failed candidates then compiled after one repair, with labels B, D, G, M and Q. The second replay also used the UI's fuller repair-request wording, so it is not an isolated measurement of the reference sentence alone.
- A GPT-5.6 candidate displayed missing measurements as zero, despite warning about that choice. GPT-6's successful first candidate retained the 22 original rows and their measured values. Later candidates used neutral underlays and left joins to retain all 29 source geometries, including unmatched routes.
- A Chrome follow-up asking for the highest displayed delay unnecessarily searched Wikipedia and retrieved an unrelated television article. Chartize then automatically attached every retrieved Wikipedia article as a source. Source lists now require an actual citation by the answer, and the redundant article-tracking set is removed. The research instructions also distinguish the current question from earlier research requests and direct chart-value questions to browser data. External tools remain model-selected and available.
- The GGSQL tool description now exempts title-only changes and simple read-only queries from a mandatory reference lookup. In the final smoke run, the title edit used one model response, preserved the entire remaining query, and completed in 5.60 s. This single follow-up is not part of the paired latency table.

## Final local verification

The final eight-turn GPT-6 evaluation passed all seven scenarios. Both generated visualizations compiled against the real MTA Parquet data; the complex map had exactly the five intended labels.

Chrome MCP checks used a production build at `localhost:3000`, a 1365 × 768 viewport, and a throwaway local session authorized for testing:

- A Wikipedia-grounded subway explanation completed in 6.34 s, with the actual query/article visible in the activity indicator.
- A fresh complex edit automatically increased thinking to high and rendered in 29.28 s without repair. The resulting table preserved the original measured delays, retained unmatched geometries as missing, and labeled B, D, G, M and Q.
- After the follow-up fixes, the same highest-delay question completed in 4.13 s using browser data only: route B, 2.614 minutes. No unrelated source was attached.
- No browser console errors were reported. The temporary session and test-only workspace were removed; sign-out returned 200 and a subsequent anonymous AI request returned 401. No application authentication bypass was added. This exercised chat and its backend gate, not a fresh OAuth login.
- All 193 ordinary tests, typechecking, and the production build passed. Ordinary tests use no AI quota.

Remaining caveats: source choice is still uneven (the initial GPT-6 news answers linked a Reddit repost and a general news archive), and the final news smoke test still did an unnecessary Wikipedia lookup alongside web research. Some simple selected-row questions also made unnecessary GGSQL reference calls. The update is a clear token-cost improvement, not proof of universally better answers or consistently lower latency. The targeted fixes address observed failures without adding a separate planner or hardcoded topic-routing rules.

## Repeat the comparison

With the local app running and the existing API environment configured:

```bash
CHARTIZE_EVAL_MODEL=gpt-5.6-luna CHARTIZE_EVAL_RUN=baseline-1 pnpm --filter @chartize/web eval:ai evals/agent.eval.ts
CHARTIZE_EVAL_MODEL=gpt-6-luna CHARTIZE_EVAL_RUN=candidate-1 pnpm --filter @chartize/web eval:ai evals/agent.eval.ts
```

Repeat in reverse order for a second sample. `CHARTIZE_EVAL_CASE` selects a single scenario. These are paid evaluations. Raw answers, tool arguments, timing, and usage are in ignored `data/evals/agent.jsonl`; the one-off repair replays are in `data/evals/luna-upgrade-repairs.jsonl`. The paired measurements above use the `luna-upgrade-baseline-1/2` and `luna-upgrade-candidate-1/2` run labels, before the follow-up prompt/reference changes. `luna-upgrade-final` records the final smoke run. Future reruns use the current prompts and may differ.

import { loadEnvFile } from "node:process";
import { appendFileSync, mkdirSync } from "node:fs";
import { AiTurnEnvelopeSchema, DatasetManifestSchema, type AiTurnEnvelope } from "@chartize/contracts";
import { expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const modelOutputs = vi.hoisted(() => [] as unknown[]);
const toolCalls = vi.hoisted(() => [] as unknown[]);
vi.mock("../lib/ai/provider", async (original) => {
  const provider = await original<typeof import("../lib/ai/provider")>();
  return { ...provider, structuredResponse: async (options: Parameters<typeof provider.structuredResponse>[0]) => {
    const result = await provider.structuredResponse({ ...options, functionTools: options.functionTools?.map((tool) => ({
      ...tool, execute: async (args: unknown) => { toolCalls.push({ name: tool.name, arguments: args }); return tool.execute(args); },
    })) ?? [] });
    modelOutputs.push(result.output);
    return result;
  } };
});
import { completeAiTurn } from "../lib/ai/turn";
import { VISUALIZATION_EXAMPLES } from "../lib/ggsql/examples";

if (!process.env.OPENAI_API_KEY) loadEnvFile("../../.env.local");
const example = VISUALIZATION_EXAMPLES.find((item) => item.id === "mta-route-delay-map")!;
const effort = process.env.CHARTIZE_EVAL_THINKING ?? "auto";
const scenarios = [
  { id: "mta", prompts: ["Why do some lines have numbers and some have letters?", "Look it up."] },
  { id: "mta-fixed", prompts: ["Look it up."], history: [
    { role: "user", text: "Why do some subway services have numbers and some have letters?" },
    { role: "assistant", text: "It comes from the subway's history: numbered routes are associated with the former IRT system, while lettered routes use the former BMT and IND system. The groups also use different-sized trains." },
  ] },
  { id: "news", prompts: ["What's changed on the subway this week? Look up one concrete development with its source and date."] },
  { id: "selection", prompts: ["What is the average delay of these two selected marks?"], selection: true },
  { id: "code", prompts: ["Change only the chart title to 'Where NYC waits'. Keep the rest of the map unchanged."] },
  { id: "dwim", prompts: ["What does this line do? Explain it without editing anything."], context: "code", note: "The cursor is on ROW_NUMBER() OVER (PARTITION BY route_id ORDER BY station_count DESC) AS rank." },
  { id: "complex", prompts: ["Make this map easier to read: label only the five routes with the largest passenger-weighted delay and keep the remaining route layers visible. Use the existing metrics, handle missing values, and explain the choice."] },
];

/** Paid checks of the real agent, including DWIM context and browser-data continuations. */
for (const scenario of scenarios.filter((item) => !process.env.CHARTIZE_EVAL_CASE || item.id === process.env.CHARTIZE_EVAL_CASE)) {
  it(`agent: ${scenario.id}`, async () => {
    const catalog = DatasetManifestSchema.array().parse(await (await fetch("http://localhost:3000/engine/api/catalog")).json());
    const sources = catalog.map((item) => ({ id: `chartize:${item.slug}`, title: item.title, description: item.description, fields: item.fields }));
    const active = sources.find((source) => source.id === example.source)!;
    let body: AiTurnEnvelope = AiTurnEnvelopeSchema.parse({
      task: "explain", context: scenario.context ?? "chart", contextNote: scenario.note ?? "The rendered MTA route delay map is visible.",
      request: scenario.prompts[0], currentQuery: example.query, renderedQuery: example.query,
      source: example.source, schema: active.fields, availableSources: sources,
      view: { title: example.title, subtitle: example.description, sources: [active] },
      preferences: { thinking: effort }, history: scenario.history ?? [],
      ...(scenario.selection ? { selection: { columns: ["extra_minutes"], rowCount: 2 }, contextNote: "Two selected extra_minutes cells from the rendered route table; their values are still in the browser." } : {}),
    });
    for (const prompt of scenario.prompts) {
      body = { ...body, request: prompt };
      const started = performance.now();
      modelOutputs.length = 0;
      toolCalls.length = 0;
      const progress: { ms: number; message: string }[] = [];
      const options = { owner: "chartize-paid-evaluation", onProgress: (message: string) => progress.push({ ms: Math.round(performance.now() - started), message }) };
      let result = await completeAiTurn(body, options);
      const usages = [result.usage];
      if (scenario.selection && result.kind === "data_request") {
        expect(result.includeSelection).toBe(true);
        expect(result.requests).toHaveLength(0);
        result = await completeAiTurn({ ...body, turnId: result.turnId, sampleData: { columns: ["extra_minutes"], rows: [["1.6456481987379952"], ["1.6951913116225612"]] } }, options);
        usages.push(result.usage);
      }
      const report = { at: new Date().toISOString(), variant: "agent", case: scenario.id, prompt, ms: Math.round(performance.now() - started), usages, progress, result, modelOutputs, toolCalls };
      mkdirSync("../../data/evals", { recursive: true });
      appendFileSync("../../data/evals/agent.jsonl", `${JSON.stringify(report)}\n`);
      console.log(JSON.stringify({ ...report, result: { ...result, ...("draft" in result ? { draft: undefined, query: undefined } : {}) } }));
      expect(result.kind).not.toBe("data_request");
      if (result.kind === "data_request") continue;
      expect(result.explanation).not.toBe("");
      if (["mta", "mta-fixed", "selection", "code", "dwim"].includes(scenario.id)) expect(result.activity?.tools).not.toContain("web_search");
      if (scenario.id === "selection") expect(result.explanation).toMatch(/\b1\.67/);
      if (scenario.id === "code") {
        expect(result.kind).toBe("visualization");
        if (result.kind === "visualization") expect(result.query).toContain("Where NYC waits");
      }
      body.history.push({ role: "user", text: prompt }, { role: "assistant", text: result.explanation });
    }
  });
}

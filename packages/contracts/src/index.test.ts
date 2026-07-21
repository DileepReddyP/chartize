import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { AiExplanationResponseSchema, AiStreamEventSchema, AiTurnEnvelopeSchema, DatasetManifestSchema, GgsqlDraftSchema } from "./index";

describe("GgsqlDraftSchema", () => {
  it("fills safe defaults", () => {
    const draft = GgsqlDraftSchema.parse({
      source: "penguins",
      layers: [{ mark: "point" }],
    });
    expect(draft.limit).toBe(5000);
    expect(draft.layers[0]?.opacity).toBe(0.9);
    expect(draft.scales).toEqual([]);
    expect(draft.axisLabels.x).toBe("");
  });
});

describe("cross-runtime dataset contract", () => {
  it("parses the manifest fixture shared across the browser and Next data routes", async () => {
    const fixture: unknown = JSON.parse(await readFile(new URL("../fixtures/dataset-manifest.json", import.meta.url), "utf8"));
    const manifest = DatasetManifestSchema.parse(fixture);
    expect(manifest.tableName).toBe("presidential_approval_average");
    expect(manifest.fields.map((field) => field.name)).toEqual(["end_date", "approve"]);
  });
});

describe("AI continuation transport", () => {
  it("carries one research memo across browser-data rounds", () => {
    const base = {
      task: "explain" as const,
      context: "general" as const,
      contextNote: "A-line delay chart",
      request: "Why is the A line delayed?",
      currentQuery: "SELECT 1",
      schema: [],
      availableSources: [],
      view: { title: "A line delays", subtitle: "", sources: [] },
      preferences: { hypothesize: true, webSearch: true, dataAccess: true, concise: true, challenge: false, technical: false },
      history: [],
      runtimeErrors: [],
      workspaceDataRound: 1,
      workspaceData: [],
      researchContext: {
        researched: true as const,
        memo: "Service evidence already gathered.",
        sources: [{ title: "MTA", url: "https://www.mta.info/" }],
      },
    };
    const parsed = AiTurnEnvelopeSchema.parse(base);
    expect(parsed.researchContext?.memo).toContain("already gathered");
    expect(parsed.preferences.allowLocalChanges).toBe(false);
  });

  it("validates streamed progress and final-result envelopes", () => {
    expect(AiStreamEventSchema.parse({ type: "progress", message: "searching sources…" }).type).toBe("progress");
  });

  it("marks an explanation that needs one-send local-change approval", () => {
    const response = AiExplanationResponseSchema.parse({
      kind: "explanation",
      approval: "local_changes",
      explanation: "The proposed change was not applied.",
      assumptions: [],
      warnings: [],
      sources: [],
      researched: false,
      workspaceActions: [],
      usage: {
        models: ["test"], calls: 1, inputTokens: 0, cachedInputTokens: 0,
        cacheWriteTokens: 0, outputTokens: 0, reasoningTokens: 0, totalTokens: 0,
      },
    });
    expect(response.approval).toBe("local_changes");
  });
});

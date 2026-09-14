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
  it("carries an opaque turn ID rather than client-controlled provider state", () => {
    const base = {
      task: "explain" as const,
      context: "data" as const,
      contextNote: "A-line delay chart",
      request: "Why is the A line delayed?",
      currentQuery: "SELECT 1",
      schema: [],
      availableSources: [],
      view: { title: "A line delays", subtitle: "", sources: [] },
      preferences: { thinking: "auto" },
      history: [{ role: "user" as const, text: "What about these rows?", context: { kind: "data" as const, note: "Two delay rows" } }],
      runtimeErrors: [],
      turnId: "89e8d452-c4be-4d12-af1c-772230109d04",
      workspaceData: [],
    };
    const parsed = AiTurnEnvelopeSchema.parse(base);
    expect(parsed.turnId).toBe("89e8d452-c4be-4d12-af1c-772230109d04");
    expect(parsed.history[0]?.context?.kind).toBe("data");
    expect(parsed.preferences.thinking).toBe("auto");
  });

  it("validates streamed progress and final-result envelopes", () => {
    expect(AiStreamEventSchema.parse({ type: "progress", message: "searching sources…" }).type).toBe("progress");
    expect(AiStreamEventSchema.parse({ type: "progress", message: "x".repeat(240) }).type).toBe("progress");
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

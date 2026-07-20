import { describe, expect, it, vi } from "vitest";
import type { AiTurnRequest } from "@chartize/contracts";
import { WorkspaceSnapshotSchema, useChartizeWorkspace } from "./store";

describe("Chartize workspace store", () => {
  it("keeps the complete Zustand snapshot Zod-valid", () => {
    const parsed = WorkspaceSnapshotSchema.parse(useChartizeWorkspace.getState());
    expect(parsed.leftPaneRatio).toBe(0.44);
    expect(parsed.codePaneRatio).toBe(0.56);
    expect(parsed.draft.axisLabels).toMatchObject({ x: "Poll Date", y: "Approval" });
    expect(parsed.aiPreferences).toEqual({ hypothesize: true, webSearch: true, dataAccess: true, concise: true, challenge: false, technical: false });
  });

  it("rejects panel sizes outside the Zod constraints", () => {
    expect(() => useChartizeWorkspace.getState().setLeftPaneRatio(0.1)).toThrow();
    expect(() => useChartizeWorkspace.getState().setCodePaneRatio(0.95)).toThrow();
  });

  it("keeps reversible chart zoom history in the validated store", () => {
    const store = useChartizeWorkspace.getState();
    store.resetChartZoom();
    store.zoomChart({ x: [1, 5], y: [40, 50] });
    expect(useChartizeWorkspace.getState().chartDomains).toEqual({ x: [1, 5], y: [40, 50] });
    expect(useChartizeWorkspace.getState().chartDomainHistory).toEqual([{}]);
    useChartizeWorkspace.getState().zoomChartOut();
    expect(useChartizeWorkspace.getState().chartDomains).toEqual({});
    expect(WorkspaceSnapshotSchema.safeParse(useChartizeWorkspace.getState()).success).toBe(true);
  });

  it("validates map compass movement and zoom", () => {
    const store = useChartizeWorkspace.getState();
    store.resetMapViewport();
    store.setMapFeatureSelection({ pixels: { x: 10, y: 12 }, title: "Cook County", values: [{ field: "population", value: "5,182,617" }] });
    store.zoomMap(1.5);
    expect(useChartizeWorkspace.getState().mapFeatureSelection).toBeNull();
    useChartizeWorkspace.getState().panMap(0.12, -0.12);
    expect(useChartizeWorkspace.getState().mapViewport).toEqual({ zoom: 1.5, panX: 0.08, panY: -0.08 });
    useChartizeWorkspace.getState().resetMapViewport();
    expect(useChartizeWorkspace.getState().mapViewport).toEqual({ zoom: 1, panX: 0, panY: 0 });
    expect(WorkspaceSnapshotSchema.safeParse(useChartizeWorkspace.getState()).success).toBe(true);
  });

  it("starts a genuinely empty visualization workspace", () => {
    const count = useChartizeWorkspace.getState().workspaceDocuments.length;
    useChartizeWorkspace.getState().startNewVisualization();
    const state = useChartizeWorkspace.getState();
    expect(state.workspaceDocuments).toHaveLength(count + 1);
    expect(state.spec).toBeNull();
    expect(state.query).toBe("");
    expect(state.dockSource).toBe("");
    expect(state.draft.source).toBe("");
    expect(state.draft.title).toBe("");
    expect(state.fullData.rows).toEqual([]);
    expect(state.aiHistory).toEqual([]);
    expect(WorkspaceSnapshotSchema.safeParse(state).success).toBe(true);
  });

  it("keeps query and AI conversation independent between workspaces", () => {
    const first = useChartizeWorkspace.getState().activeWorkspaceId;
    useChartizeWorkspace.getState().setQuery("first workspace query");
    useChartizeWorkspace.getState().setAiHistory([{ role: "assistant", text: "first conversation" }]);
    useChartizeWorkspace.getState().openWorkspace({ title: "second chart", query: "second workspace query" });
    const second = useChartizeWorkspace.getState().activeWorkspaceId;
    useChartizeWorkspace.getState().setAiHistory([{ role: "assistant", text: "second conversation" }]);

    useChartizeWorkspace.getState().switchWorkspace(first);
    expect(useChartizeWorkspace.getState().query).toBe("first workspace query");
    expect(useChartizeWorkspace.getState().aiHistory[0]?.text).toBe("first conversation");

    useChartizeWorkspace.getState().switchWorkspace(second);
    expect(useChartizeWorkspace.getState().query).toBe("second workspace query");
    expect(useChartizeWorkspace.getState().aiHistory[0]?.text).toBe("second conversation");
    expect(WorkspaceSnapshotSchema.safeParse(useChartizeWorkspace.getState()).success).toBe(true);
  });

  it("automatically sends the exact failed query with the next AI turn", async () => {
    const previous = useChartizeWorkspace.getState();
    const failedQuery = "SELECT missing FROM chartize:presidential_approval_average\n\nVISUALISE\nDRAW line";
    const requestAiTurn = vi.fn(async (_request: AiTurnRequest) => ({
      kind: "explanation" as const,
      explanation: "I can repair that diagnostic.",
      assumptions: [],
      warnings: [],
      sources: [],
      researched: false,
      usage: {
        models: ["test"],
        calls: 1,
        inputTokens: 0,
        cachedInputTokens: 0,
        cacheWriteTokens: 0,
        outputTokens: 0,
        reasoningTokens: 0,
        totalTokens: 0,
      },
    }));

    useChartizeWorkspace.setState({
      catalogLoaded: true,
      aiBusy: false,
      aiPrompt: "Why did this fail?",
      aiHistory: [],
      query: "SELECT 1",
      runtimeErrors: [{ stage: "query", message: "no such column: missing", failedQuery }],
      requestAiTurn,
    });

    try {
      await useChartizeWorkspace.getState().submitAiTurn({
        task: "explain",
        context: "code",
        contextNote: "current editor",
        schema: [],
        availableSources: [],
        view: { title: "", subtitle: "", sources: [] },
      });

      expect(requestAiTurn).toHaveBeenCalledTimes(1);
      expect(requestAiTurn.mock.calls[0]?.[0].runtimeErrors).toEqual([
        { stage: "query", message: "no such column: missing", failedQuery },
      ]);
    } finally {
      useChartizeWorkspace.setState({
        catalogLoaded: previous.catalogLoaded,
        aiBusy: previous.aiBusy,
        aiPrompt: previous.aiPrompt,
        aiHistory: previous.aiHistory,
        aiUsage: previous.aiUsage,
        query: previous.query,
        runtimeErrors: previous.runtimeErrors,
        requestAiTurn: previous.requestAiTurn,
      });
    }
  });
});

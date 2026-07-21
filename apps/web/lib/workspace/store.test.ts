import { describe, expect, it, vi } from "vitest";
import type { AiTurnRequest } from "@chartize/contracts";
import { WorkspaceSnapshotSchema, useChartizeWorkspace } from "./store";

describe("Chartize workspace store", () => {
  it("keeps the complete Zustand snapshot Zod-valid", () => {
    const parsed = WorkspaceSnapshotSchema.parse(useChartizeWorkspace.getState());
    expect(parsed.leftPaneRatio).toBe(0.44);
    expect(parsed.codePaneRatio).toBe(0.56);
    expect(parsed.workspacePane).toBe("chart");
    expect(parsed.draft.axisLabels).toMatchObject({ x: "Poll Date", y: "Approval" });
    expect(parsed.aiPreferences).toEqual({ hypothesize: true, webSearch: true, dataAccess: true, allowLocalChanges: false, concise: true, challenge: false, technical: false });
  });

  it("rejects panel sizes outside the Zod constraints", () => {
    expect(() => useChartizeWorkspace.getState().setLeftPaneRatio(0.1)).toThrow();
    expect(() => useChartizeWorkspace.getState().setCodePaneRatio(0.95)).toThrow();
  });

  it("keeps reversible chart zoom history in the validated store", () => {
    const store = useChartizeWorkspace.getState();
    store.resetChartZoom();
    store.selectMapFeature({ key: "point", pixels: { x: 10, y: 12 }, title: "selected point", values: [{ field: "value", value: "42" }] });
    store.zoomChart({ x: [1, 5], y: [40, 50] });
    expect(useChartizeWorkspace.getState().chartDomains).toEqual({ x: [1, 5], y: [40, 50] });
    expect(useChartizeWorkspace.getState().chartDomainHistory).toEqual([{}]);
    expect(useChartizeWorkspace.getState().mapFeatureSelections).toEqual([]);
    useChartizeWorkspace.getState().zoomChartOut();
    expect(useChartizeWorkspace.getState().chartDomains).toEqual({});
    expect(WorkspaceSnapshotSchema.safeParse(useChartizeWorkspace.getState()).success).toBe(true);
  });

  it("validates map compass movement and zoom", () => {
    const store = useChartizeWorkspace.getState();
    store.resetMapViewport();
    store.selectMapFeature({ key: "cook", pixels: { x: 10, y: 12 }, title: "Cook County", values: [{ field: "population", value: "5,182,617" }] });
    store.selectMapFeature({ key: "teton", pixels: { x: 20, y: 22 }, title: "Teton County", values: [{ field: "population", value: "24,000" }] }, true);
    expect(useChartizeWorkspace.getState().mapFeatureSelections.map(({ title }) => title)).toEqual(["Cook County", "Teton County"]);
    store.selectMapFeature({ key: "cook", pixels: { x: 10, y: 12 }, title: "Cook County", values: [{ field: "population", value: "5,182,617" }] }, true);
    expect(useChartizeWorkspace.getState().mapFeatureSelections.map(({ title }) => title)).toEqual(["Teton County"]);
    store.zoomMap(1.5);
    expect(useChartizeWorkspace.getState().mapFeatureSelections).toEqual([]);
    useChartizeWorkspace.getState().panMap(0.12, -0.12);
    expect(useChartizeWorkspace.getState().mapViewport).toEqual({ zoom: 1.5, panX: 0.08, panY: -0.08 });
    useChartizeWorkspace.getState().resetMapViewport();
    expect(useChartizeWorkspace.getState().mapViewport).toEqual({ zoom: 1, panX: 0, panY: 0 });
    expect(WorkspaceSnapshotSchema.safeParse(useChartizeWorkspace.getState()).success).toBe(true);
  });

  it("routes graph region selection through one Zustand action", () => {
    const store = useChartizeWorkspace.getState();
    store.selectMapFeature({ key: "cook", pixels: { x: 10, y: 12 }, title: "Cook County", values: [{ field: "population", value: "5,182,617" }] });
    store.selectChartRegion({ pixels: { x0: 10, y0: 12, x1: 100, y1: 120 }, x: [1, 5], y: [40, 50] });
    expect(useChartizeWorkspace.getState()).toMatchObject({
      selectionOrigin: "result",
      gridSelection: null,
      mapFeatureSelections: [],
      chartSelection: { pixels: { x0: 10, y0: 12, x1: 100, y1: 120 }, x: [1, 5], y: [40, 50] },
    });
  });

  it("coordinates the compact graph, code, and data views through Zustand", () => {
    const store = useChartizeWorkspace.getState();
    store.setWorkspacePane("code");
    expect(useChartizeWorkspace.getState()).toMatchObject({ workspacePane: "code", focusArea: "code" });

    useChartizeWorkspace.getState().setWorkspacePane("data");
    expect(useChartizeWorkspace.getState()).toMatchObject({ workspacePane: "data", focusArea: "table" });

    useChartizeWorkspace.getState().setResultTab("selected");
    useChartizeWorkspace.getState().setWorkspacePane("chart");
    expect(useChartizeWorkspace.getState()).toMatchObject({ workspacePane: "chart", focusArea: "chart", resultTab: "chart" });
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

  it("invalidates active table state when a blank workspace is opened without running", () => {
    useChartizeWorkspace.setState({
      fullData: { columns: ["stale"], rows: [["previous workspace"]], totalRows: 1, offset: 0, limit: 100 },
      fullLoading: true,
    });

    useChartizeWorkspace.getState().openWorkspace(undefined, { run: false });

    expect(useChartizeWorkspace.getState()).toMatchObject({
      query: "",
      dockSource: "",
      fullLoading: false,
      fullData: { columns: [], rows: [], totalRows: 0 },
    });
  });

  it("invalidates the raw-table page when a different dataset is applied", () => {
    useChartizeWorkspace.setState({
      fullData: { columns: ["old"], rows: [["stale"]], totalRows: 1, offset: 0, limit: 100 },
      fullLoading: true,
      fullSort: { column: "old", direction: "asc" },
    });

    useChartizeWorkspace.getState().applyDataset("user:uploaded", {
      id: "uploaded",
      tableName: "uploaded",
      title: "Uploaded data",
      description: "Browser-local test source",
      spatial: false,
      fields: [{ name: "city", dataType: "VARCHAR", nullable: true }],
    }, false);

    expect(useChartizeWorkspace.getState()).toMatchObject({
      dockSource: "user:uploaded",
      fullLoading: false,
      fullSort: null,
      fullData: { columns: [], rows: [], totalRows: 0 },
    });
    expect(WorkspaceSnapshotSchema.safeParse(useChartizeWorkspace.getState()).success).toBe(true);
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
      workspaceActions: [],
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

  it("consumes local-change permission after one AI send", async () => {
    const previous = useChartizeWorkspace.getState();
    const requestAiTurn = vi.fn(async (_request: AiTurnRequest) => ({
      kind: "explanation" as const,
      explanation: "The local change is ready.",
      assumptions: [],
      warnings: [],
      sources: [],
      researched: false,
      workspaceActions: [],
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
      aiPrompt: "Apply the proposed cleanup.",
      aiHistory: [],
      aiPreferences: { ...previous.aiPreferences, allowLocalChanges: true },
      requestAiTurn,
    });

    try {
      await useChartizeWorkspace.getState().submitAiTurn({
        task: "generate",
        context: "general",
        contextNote: "uploaded data",
        schema: [],
        availableSources: [],
        view: { title: "", subtitle: "", sources: [] },
      });

      expect(requestAiTurn.mock.calls[0]?.[0].preferences.allowLocalChanges).toBe(true);
      expect(useChartizeWorkspace.getState().aiPreferences.allowLocalChanges).toBe(false);
    } finally {
      useChartizeWorkspace.setState({
        catalogLoaded: previous.catalogLoaded,
        aiBusy: previous.aiBusy,
        aiPrompt: previous.aiPrompt,
        aiHistory: previous.aiHistory,
        aiUsage: previous.aiUsage,
        aiPreferences: previous.aiPreferences,
        requestAiTurn: previous.requestAiTurn,
      });
    }
  });

  it("retains a local-change approval request beside the assistant response", async () => {
    const previous = useChartizeWorkspace.getState();
    const requestAiTurn = vi.fn(async (_request: AiTurnRequest) => ({
      kind: "explanation" as const,
      approval: "local_changes" as const,
      explanation: "I prepared the cleanup but did not apply it.",
      assumptions: [],
      warnings: [],
      sources: [],
      researched: false,
      workspaceActions: [],
      usage: {
        models: ["test"], calls: 1, inputTokens: 0, cachedInputTokens: 0,
        cacheWriteTokens: 0, outputTokens: 0, reasoningTokens: 0, totalTokens: 0,
      },
    }));

    useChartizeWorkspace.setState({
      catalogLoaded: true,
      aiBusy: false,
      aiPrompt: "Clean this upload.",
      aiHistory: [],
      requestAiTurn,
    });

    try {
      await useChartizeWorkspace.getState().submitAiTurn({
        task: "generate",
        context: "general",
        contextNote: "uploaded data",
        schema: [],
        availableSources: [],
        view: { title: "", subtitle: "", sources: [] },
      });

      expect(useChartizeWorkspace.getState().aiHistory.at(-1)).toMatchObject({
        role: "assistant",
        approval: "local_changes",
      });
    } finally {
      useChartizeWorkspace.setState({
        catalogLoaded: previous.catalogLoaded,
        aiBusy: previous.aiBusy,
        aiPrompt: previous.aiPrompt,
        aiHistory: previous.aiHistory,
        aiUsage: previous.aiUsage,
        requestAiTurn: previous.requestAiTurn,
      });
    }
  });
});

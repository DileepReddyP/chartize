import { describe, expect, it } from "vitest";
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
});

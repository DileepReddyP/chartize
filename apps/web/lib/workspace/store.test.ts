import { describe, expect, it } from "vitest";
import { WorkspaceSnapshotSchema, useChartizeWorkspace } from "./store";

describe("Chartize workspace store", () => {
  it("keeps the complete Zustand snapshot Zod-valid", () => {
    const parsed = WorkspaceSnapshotSchema.parse(useChartizeWorkspace.getState());
    expect(parsed.leftPaneRatio).toBe(0.44);
    expect(parsed.codePaneRatio).toBe(0.56);
    expect(parsed.draft.axisLabels).toMatchObject({ x: "Poll Date", y: "Approval" });
    expect(parsed.aiPreferences).toEqual({ hypothesize: true, concise: true, challenge: false, technical: false });
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
    store.zoomMap(1.5);
    useChartizeWorkspace.getState().panMap(0.12, -0.12);
    expect(useChartizeWorkspace.getState().mapViewport).toEqual({ zoom: 1.5, panX: 0.08, panY: -0.08 });
    useChartizeWorkspace.getState().resetMapViewport();
    expect(useChartizeWorkspace.getState().mapViewport).toEqual({ zoom: 1, panX: 0, panY: 0 });
    expect(WorkspaceSnapshotSchema.safeParse(useChartizeWorkspace.getState()).success).toBe(true);
  });

  it("starts a clean visualization while retaining a usable source", () => {
    useChartizeWorkspace.getState().startNewVisualization("chartize:county_population_2025");
    const state = useChartizeWorkspace.getState();
    expect(state.spec).toBeNull();
    expect(state.query).toContain("FROM chartize:county_population_2025");
    expect(state.draft.title).toBe("untitled visualization");
    expect(state.aiHistory).toEqual([]);
    expect(WorkspaceSnapshotSchema.safeParse(state).success).toBe(true);
  });
});

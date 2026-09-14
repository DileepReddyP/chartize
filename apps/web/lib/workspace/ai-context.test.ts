import { describe, expect, it } from "vitest";
import { aiQueryStatus, chooseDwimAiContext, resolveAiWorkspaceContext } from "./ai-context";

const base = {
  context: "general" as const,
  entryNote: "old workspace note",
  viewNote: "Chart: “ridership”.",
  blank: false,
  isMap: false,
  gridSelection: null,
  chartRange: null,
  visualSelectionCount: 0,
  visualSelectionData: null,
  fallbackData: { columns: ["day", "rides"], rows: [["Monday", "10"]] },
  dataPreview: { columns: ["day", "rides"], rows: [["Tuesday", "12"]] },
};

describe("Chartize DWIM AI context", () => {
  it("treats selected table cells as data context and sends those rows", () => {
    const resolved = resolveAiWorkspaceContext({
      ...base,
      context: "data",
      gridSelection: {
        summary: "2 rows × 1 column",
        columns: ["rides"],
        rows: [["10"], ["12"]],
      },
    });
    expect(resolved.context).toBe("data");
    expect(resolved.note).toContain("Data selection");
    expect(resolved.sample).toEqual({
      summary: "2 rows × 1 column",
      columns: ["rides"],
      rows: [["10"], ["12"]],
    });
  });

  it("resolves a live chart range instead of retaining a stale entry note", () => {
    const resolved = resolveAiWorkspaceContext({
      ...base,
      context: "chart",
      entryNote: "Old selected range: January",
      chartRange: {
        x: ["2026-02-01", "2026-02-28"],
        y: [10, 20],
        summary: "8 points · February",
        data: { columns: ["date", "value"], rows: [["2026-02-02", "14"]] },
      },
      visualSelectionCount: 8,
    });
    expect(resolved.note).toContain("February");
    expect(resolved.note).not.toContain("January");
  });

  it("does not put selected mark values in the note when row sharing is off", () => {
    const resolved = resolveAiWorkspaceContext({
      ...base,
      context: "chart",
      visualSelectionCount: 1,
      visualSelectionData: { columns: ["county", "population"], rows: [["Cook", "5182617"]] },
    });
    expect(resolved.note).not.toContain("Cook");
    expect(resolved.note).not.toContain("5182617");
    expect(resolved.sample.rows[0]).toEqual(["Cook", "5182617"]);
  });

  it("keeps an uploaded-source anchor while general chart context stays live", () => {
    const upload = resolveAiWorkspaceContext({
      ...base,
      entryNote: "New browser-local source: user:traffic. Profile it.",
    });
    const ordinary = resolveAiWorkspaceContext(base);
    expect(upload.note).toContain("user:traffic");
    expect(ordinary.note).toContain("Chart: “ridership”");
    expect(ordinary.note).not.toContain("old workspace note");
  });

  it("does not let remembered pane focus become the subject of a blank workspace", () => {
    expect(chooseDwimAiContext({
      blank: true,
      hasEditorContext: false,
      hasGridSelection: false,
      hasVisualSelection: false,
      focusArea: "table",
    })).toBe("general");
    expect(resolveAiWorkspaceContext({ ...base, blank: true }).note).toContain("canvas is blank");
  });

  it("prefers explicit DWIM selections and otherwise follows the focused pane", () => {
    expect(chooseDwimAiContext({
      blank: false,
      hasEditorContext: false,
      hasGridSelection: true,
      hasVisualSelection: true,
      focusArea: "code",
    })).toBe("data");
    expect(chooseDwimAiContext({
      blank: false,
      hasEditorContext: false,
      hasGridSelection: false,
      hasVisualSelection: false,
      focusArea: "table",
    })).toBe("data");
  });

  it("distinguishes rendered, edited, failed, and blank queries", () => {
    expect(aiQueryStatus("", "", [])).toBe("blank");
    expect(aiQueryStatus("SELECT 1", "SELECT 1", [])).toBe("rendered");
    expect(aiQueryStatus("SELECT 2", "SELECT 1", [])).toBe("edited");
    expect(aiQueryStatus("SELECT missing", "SELECT 1", [{
      stage: "query",
      message: "missing column",
      failedQuery: "SELECT missing",
    }])).toBe("failed");
  });
});

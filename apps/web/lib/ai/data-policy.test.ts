import { describe, expect, it } from "vitest";
import { browserDataTurnInstruction, decideBrowserData } from "./data-policy";

const base = {
  enabled: true,
  task: "explain" as const,
  hasQueryableSources: true,
  hasWorkspaceData: false,
  hasSharedRows: false,
};

describe("browser data policy", () => {
  it("requires a browser round for exact calculations", () => {
    const decision = decideBrowserData("Calculate the exact average approval value.", base);
    expect(decision).toEqual({ mode: "required", reason: "exact_value" });
    expect(browserDataTurnInstruction(decision)).toContain("Return request_data now");
    expect(decideBrowserData("Calculate the exact average approval value.", { ...base, task: "generate" }).mode).toBe("required");
  });

  it("requires an explicitly requested workspace inspection", () => {
    expect(decideBrowserData("Query the browser data before answering.", base).mode).toBe("required");
  });

  it("carries a short affirmative answer to an explicit data offer", () => {
    expect(decideBrowserData("Yes, do that.", {
      ...base,
      history: [{ role: "assistant", text: "I can query the workspace data to calculate that exactly." }],
    })).toEqual({ mode: "required", reason: "conversation_followup" });
  });

  it("does not force an extra round when rows or browser results already ground the answer", () => {
    expect(decideBrowserData("Calculate the average of these rows.", { ...base, hasSharedRows: true }).mode).toBe("available");
    expect(decideBrowserData("What is the exact total?", { ...base, hasWorkspaceData: true }).mode).toBe("available");
  });

  it("does not preflight ordinary chart generation or disabled access", () => {
    expect(decideBrowserData("Show the top 10 categories as a bar chart.", { ...base, task: "generate" }).mode).toBe("available");
    expect(decideBrowserData("Repair the exact average query.", { ...base, task: "repair" }).mode).toBe("disabled");
    expect(decideBrowserData("Calculate the exact average.", { ...base, enabled: false }).mode).toBe("disabled");
    expect(decideBrowserData("What does the average encoding mean?", base).mode).toBe("available");
  });
});

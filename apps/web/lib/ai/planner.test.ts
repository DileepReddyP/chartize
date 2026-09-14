import { describe, expect, it, vi } from "vitest";
import type { AiTurnPlan } from "@chartize/contracts";
vi.mock("server-only", () => ({}));
import { constrainPlan } from "./planner";

const plan: AiTurnPlan = { summary: "Investigate", thinking: "high", research: "web", queryData: true, shareSelection: true, localChanges: true, hypotheses: true, technical: true, challenge: true, concise: false, approval: null, question: "" };

describe("turn plan boundaries", () => {
  it("honors a manual thinking level while auto keeps the planner's choice", () => {
    expect(constrainPlan(plan, { task: "generate", preferences: { thinking: "medium" } }).thinking).toBe("medium");
    expect(constrainPlan(plan, { task: "generate", preferences: { thinking: "auto" } }).thinking).toBe("high");
  });

  it("doesn't replay data writes or research during automatic query repair", () => {
    expect(constrainPlan(plan, { task: "repair", preferences: { thinking: "auto" } })).toMatchObject({ localChanges: false, research: "none", shareSelection: false });
  });
});

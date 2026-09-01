import { describe, expect, it } from "vitest";
import { decideResearch, researchTurnInstruction } from "./research-policy";

describe("Chartize AI research policy", () => {
  it("requires explicit and time-sensitive research when the toggle is on", () => {
    expect(decideResearch("Search the web for the events behind this change", { webSearch: true }).reason).toBe("explicit_request");
    expect(decideResearch("Search current MTA reporting on subway reliability", { webSearch: true }).reason).toBe("explicit_request");
    expect(decideResearch("What is the latest reporting about this?", { webSearch: true }).reason).toBe("freshness");
    expect(decideResearch("Give me citations for these claims", { webSearch: true }).mode).toBe("required");
  });

  it("requires outside context for causal chart questions", () => {
    expect(decideResearch("Why did approval fall during this range?", { webSearch: true }).reason).toBe("outside_explanation");
    expect(decideResearch("Could the election explain this spike?", { webSearch: true }).reason).toBe("outside_explanation");
    expect(decideResearch("What happened around the crossover?", { webSearch: true }).mode).toBe("required");
  });

  it("does not turn local debugging or ordinary drawing into a paid search", () => {
    expect(decideResearch("Why does this GGSQL query error?", { webSearch: true }).mode).toBe("available");
    expect(decideResearch("Make the negative bars red", { webSearch: true }).mode).toBe("available");
    expect(decideResearch("Calculate the exact average in this workspace", { webSearch: true }).mode).toBe("available");
    expect(decideResearch("Search this table for missing rows", { webSearch: true }).mode).toBe("available");
  });

  it("carries research intent through short conversational follow-ups", () => {
    expect(decideResearch("Yes, do that.", {
      webSearch: true,
      history: [{ role: "assistant", text: "I can search contemporary reporting for the cause." }],
    }).reason).toBe("conversation_followup");
    expect(decideResearch("And what about the following month?", {
      webSearch: true,
      history: [{ role: "user", text: "Why did approval fall during this range?" }],
    }).reason).toBe("conversation_followup");
    expect(decideResearch("Yes.", {
      webSearch: true,
      history: [{ role: "assistant", text: "I can make the line thicker." }],
    }).mode).toBe("available");
  });

  it("honors the toggle and never repeats a completed pass", () => {
    expect(decideResearch("Search the web", { webSearch: false }).reason).toBe("toggle_off");
    const completed = decideResearch("Find more current sources", { webSearch: true, alreadyResearched: true });
    expect(completed).toEqual({ mode: "disabled", reason: "already_researched" });
    expect(researchTurnInstruction(completed, 1)).toContain("Do not search again");
  });
});

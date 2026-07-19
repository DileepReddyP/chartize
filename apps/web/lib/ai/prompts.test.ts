import { describe, expect, it } from "vitest";
import { CHARTIZE_AI_INSTRUCTIONS, chartizeTurnInstructions } from "./prompts";

describe("Chartize AI prompt contract", () => {
  it("defines one persistent GGSQL collaborator", () => {
    expect(CHARTIZE_AI_INSTRUCTIONS).toContain("sole AI collaborator");
    expect(CHARTIZE_AI_INSTRUCTIONS).toContain("Continue as one conversation");
    expect(CHARTIZE_AI_INSTRUCTIONS).toContain("complete, executable, read-only GGSQL query");
  });

  it("keeps explanation turns non-mutating and selection-aware", () => {
    const instructions = chartizeTurnInstructions("chart", "explain");
    expect(instructions).toContain("selected visual range");
    expect(instructions).toContain("Do not change the current query or draft");
  });

  it("documents the executable GGSQL time-formatter form", () => {
    expect(CHARTIZE_AI_INSTRUCTIONS).toContain("'{:time %b %Y}'");
    expect(CHARTIZE_AI_INSTRUCTIONS).toContain("never emit a bare '%b %Y'");
    expect(CHARTIZE_AI_INSTRUCTIONS).toContain("never use '%-dth'");
  });
});

import { describe, expect, it } from "vitest";
import { CHARTIZE_AI_INSTRUCTIONS, chartizePreferenceInstructions, chartizeTurnInstructions } from "./prompts";

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

  it("allows useful historical hypotheses without turning caveats into the answer", () => {
    expect(CHARTIZE_AI_INSTRUCTIONS).toContain("general historical or public knowledge");
    expect(CHARTIZE_AI_INSTRUCTIONS).toContain("offer the strongest concrete explanation first");
    expect(CHARTIZE_AI_INSTRUCTIONS).toContain("actually search before answering");
    expect(CHARTIZE_AI_INSTRUCTIONS).toContain("do not sound like a compliance notice");
  });

  it("translates response-profile toggles into turn instructions", () => {
    const enabled = chartizePreferenceInstructions({ hypothesize: true, concise: true, challenge: false, technical: false });
    const disabled = chartizePreferenceInstructions({ hypothesize: false, concise: false, challenge: true, technical: true });
    expect(enabled).toContain("outside-context hypotheses");
    expect(enabled).toContain("one to three short paragraphs");
    expect(disabled).toContain("do not add outside-context hypotheses");
    expect(disabled).toContain("Actively challenge weak premises");
    expect(disabled).toContain("GGSQL details");
  });

  it("documents the executable GGSQL time-formatter form", () => {
    expect(CHARTIZE_AI_INSTRUCTIONS).toContain("'{:time %b %Y}'");
    expect(CHARTIZE_AI_INSTRUCTIONS).toContain("never emit a bare '%b %Y'");
    expect(CHARTIZE_AI_INSTRUCTIONS).toContain("never use '%-dth'");
  });

  it("centers contiguous-U.S. Albers maps explicitly", () => {
    expect(CHARTIZE_AI_INSTRUCTIONS).toContain("SETTING origin => (-96, 37.5), parallel => (29.5, 45.5)");
  });

  it("gives unused smoothing adjustments a valid structured-output sentinel", () => {
    expect(CHARTIZE_AI_INSTRUCTIONS).toContain("use 1 when smoothing adjustment is not relevant");
  });
});

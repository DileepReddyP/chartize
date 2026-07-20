import { describe, expect, it } from "vitest";
import { CHARTIZE_AI_INSTRUCTIONS, chartizePreferenceInstructions, chartizeTurnInstructions } from "./prompts";

describe("Chartize AI prompt contract", () => {
  it("defines one persistent GGSQL collaborator", () => {
    expect(CHARTIZE_AI_INSTRUCTIONS).toContain("sole AI collaborator");
    expect(CHARTIZE_AI_INSTRUCTIONS).toContain("Continue as one conversation");
    expect(CHARTIZE_AI_INSTRUCTIONS).toContain("complete executable browser-local GGSQL query");
    expect(CHARTIZE_AI_INSTRUCTIONS).toContain("request_data");
    expect(CHARTIZE_AI_INSTRUCTIONS).toContain("get_visualization_tips");
    expect(CHARTIZE_AI_INSTRUCTIONS).toContain("Any request to label line endpoints must consult endpoint-labels");
  });

  it("keeps explanation entry points selection-aware without constraining intent", () => {
    const instructions = chartizeTurnInstructions("chart", "explain");
    expect(instructions).toContain("selected visual range");
    expect(instructions).toContain("still update the visualization if their actual words ask");
  });

  it("allows useful historical hypotheses without turning caveats into the answer", () => {
    expect(CHARTIZE_AI_INSTRUCTIONS).toContain("general historical or public knowledge");
    expect(CHARTIZE_AI_INSTRUCTIONS).toContain("offer the strongest concrete explanation first");
    expect(CHARTIZE_AI_INSTRUCTIONS).toContain("actually search before answering");
    expect(CHARTIZE_AI_INSTRUCTIONS).toContain("do not sound like a compliance notice");
  });

  it("translates response-profile toggles into turn instructions", () => {
    const enabled = chartizePreferenceInstructions({ hypothesize: true, webSearch: true, dataAccess: true, concise: true, challenge: false, technical: false });
    const disabled = chartizePreferenceInstructions({ hypothesize: false, webSearch: false, dataAccess: false, concise: false, challenge: true, technical: true });
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

  it("keeps the model contract query-authoritative instead of emitting duplicate builder state", () => {
    expect(CHARTIZE_AI_INSTRUCTIONS).toContain("reconstructs its visual-builder state from the result");
    expect(CHARTIZE_AI_INSTRUCTIONS).not.toContain("draft.scenarioDeltas");
  });
});

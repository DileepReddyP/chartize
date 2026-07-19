import { describe, expect, it } from "vitest";
import { makeBlankDraft, makeDefaultDraft, serializeDraft } from "./serialize";

describe("serializeDraft", () => {
  it("creates readable GGSQL", () => {
    const query = serializeDraft(makeDefaultDraft());
    expect(query).toContain("FROM ggsql:penguins");
    expect(query).toContain("DRAW point");
    expect(query).toContain('"bill_len" AS x');
    expect(query).not.toContain('SELECT "geometry"');
    expect(query).not.toContain(', "geometry"');
  });

  it("maps aggregate fields to their generated aliases", () => {
    const draft = makeDefaultDraft();
    draft.aggregation = "mean";
    draft.aggregateField = "body_mass";
    draft.layers[0]!.y = "body_mass";
    const query = serializeDraft(draft);
    expect(query).toContain('AVG("body_mass") AS "_mean_body_mass"');
    expect(query).toContain('"_mean_body_mass" AS y');
  });

  it("escapes labels", () => {
    const draft = makeDefaultDraft();
    draft.title = "People's data";
    expect(serializeDraft(draft)).toContain("People''s data");
  });

  it("serializes typed axis labels and date formatting", () => {
    const draft = makeDefaultDraft();
    draft.axisLabels.x = "Poll Date";
    draft.axisLabels.y = "Approval";
    draft.scales = [{ aesthetic: "x", type: "", palette: "", transform: "date", labelFormat: "%B %-d, %Y" }];
    const query = serializeDraft(draft);
    expect(query).toContain("SCALE x VIA date");
    expect(query).toContain("RENAMING * => '{:time %B %-d, %Y}'");
    expect(query).toContain("x => 'Poll Date'");
    expect(query).toContain("y => 'Approval'");
  });

  it("preserves explicit numeric scale formatters", () => {
    const draft = makeDefaultDraft();
    draft.scales = [{ aesthetic: "y", type: "continuous", palette: "", transform: "linear", labelFormat: "{:num %.1f}%" }];
    expect(serializeDraft(draft)).toContain("RENAMING * => '{:num %.1f}%'");
  });

  it("serializes intervals, fitted layers, scenarios, and reference rules", () => {
    const draft = makeDefaultDraft("chartize:presidential_approval_average");
    draft.layers = [
      { ...draft.layers[0]!, mark: "ribbon", x: "end_date", y: "", yMin: "approve_lower_ci", yMax: "approve_upper_ci", color: "", size: "", fixedFill: "#3cbbb1", opacity: 0.18 },
      { ...draft.layers[0]!, mark: "line", x: "end_date", y: "approve", color: "", size: "", colourLegendValue: "Observed" },
      { ...draft.layers[0]!, mark: "smooth", x: "approve", y: "disapprove", color: "", size: "", smoothMethod: "ols", fixedColour: "#2a1e5c" },
      { ...draft.layers[0]!, mark: "line", x: "end_date", y: "approve_plus_3", color: "", size: "", colourLegendValue: "Hypothetical +3" },
    ];
    draft.tooltipFields = [];
    draft.scenarioDeltas = [{ field: "approve", delta: 3, as: "approve_plus_3", label: "Hypothetical +3" }];
    draft.referenceRules = [{ axis: "y", value: "50", label: "Majority", colour: "#596662", linetype: "dashed", linewidth: 1 }];
    const query = serializeDraft(draft);
    expect(query).toContain('"approve_lower_ci" AS ymin');
    expect(query).toContain('"approve_upper_ci" AS ymax');
    expect(query).toContain("SETTING color => '#2a1e5c', method => 'ols'");
    expect(query).toContain('"approve" + 3 AS "approve_plus_3"');
    expect(query).toContain('50 AS "__chartize_rule_0"');
    expect(query).toContain('MAPPING "__chartize_rule_0" AS y');
    expect(query).toContain("aggregate => 'max'");
  });

  it("creates an empty draft for the blank workspace state", () => {
    const draft = makeBlankDraft();
    expect(draft.source).toBe("");
    expect(draft.title).toBe("");
    expect(draft.layers[0]).toMatchObject({ x: "", y: "", geometry: "" });
  });
});

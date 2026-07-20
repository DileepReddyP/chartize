import { z } from "zod";
import { describe, expect, it } from "vitest";
import { draftFromGgsql, normalizeModelGgsql, publicAiError, reconcileGroundedResponse, sanitizeModelText, separateWorkspaceProgram } from "./model-output";

describe("Chartize AI model output", () => {
  it("does not expose raw Zod issue arrays in the UI", () => {
    const invalid = z.object({ required: z.string() }).safeParse({});
    expect(invalid.success).toBe(false);
    if (!invalid.success) {
      expect(publicAiError(invalid.error)).toBe("Chartize AI returned an incomplete visualization draft. Please try again.");
    }
  });

  it("repairs common structured-model clause formatting without changing SQL", () => {
    const query = `SELECT geometry, change, lon, lat, label FROM chartize:states

VISUALISE
PROJECT TO albers WITH SETTING origin => (-96, 37.5)
DRAW spatial
  MAPPING geometry AS geometry, change AS fill
DRAW text
  MAPPING lon AS lon, lat AS lat, label AS label
SCALE CONTINUOUS fill TO 'vik'
LABEL title => 'Population change'
  subtitle => '2020–2025'
  fill => 'Change (%)'`;
    const normalized = normalizeModelGgsql(query);
    expect(normalized).toContain("SCALE CONTINUOUS fill TO vik");
    expect(normalized).toContain("LABEL title => 'Population change',\n  subtitle => '2020–2025',\n  fill => 'Change (%)'");
    expect(normalized.indexOf("PROJECT TO albers")).toBeGreaterThan(normalized.indexOf("LABEL title"));
    expect(normalized).toContain("PROJECT TO albers\n  SETTING origin => (-96, 37.5)");
    expect(normalized).not.toContain("WITH SETTING");
    expect(normalized.startsWith("SELECT geometry")).toBe(true);
  });

  it("unquotes any named GGSQL palette instead of relying on a palette allowlist", () => {
    expect(normalizeModelGgsql("SELECT change FROM chartize:states\n\nVISUALISE\nDRAW spatial\n  MAPPING change AS fill\nSCALE CONTINUOUS fill TO 'RdYlGn'"))
      .toContain("SCALE CONTINUOUS fill TO RdYlGn");
  });

  it("unwraps fenced or labeled GGSQL returned inside a structured string", () => {
    const fenced = "```ggsql\nSELECT value FROM chartize:example\n\nVISUALISE\nDRAW line\n  MAPPING value AS y\n```";
    expect(normalizeModelGgsql(fenced)).toBe("SELECT value FROM chartize:example\n\nVISUALISE\nDRAW line\n  MAPPING value AS y");
    expect(normalizeModelGgsql("GGSQL: SELECT value FROM chartize:example"))
      .toBe("SELECT value FROM chartize:example");
  });

  it("moves one-time local SQL out of the visualization query", () => {
    const separated = separateWorkspaceProgram(`DROP TABLE IF EXISTS cleaned;
CREATE TEMP TABLE cleaned AS SELECT value FROM user:upload;
SELECT value FROM cleaned

VISUALISE
DRAW bar
  MAPPING value AS x`);
    expect(separated.setupSql).toBe("DROP TABLE IF EXISTS cleaned;\n\nCREATE TEMP TABLE cleaned AS SELECT value FROM user:upload;");
    expect(separated.query).toBe("SELECT value FROM cleaned\n\nVISUALISE\nDRAW bar\n  MAPPING value AS x");
    expect(separated.query).not.toMatch(/\b(?:DROP|CREATE)\b/);
  });

  it("does not claim web research was unavailable when provider evidence exists", () => {
    expect(reconcileGroundedResponse(
      "Three dates were added. I could not retrieve eligible live-web source results, so treat them as unverified.",
      ["No usable sources were available.", "The chart is descriptive."],
      { researched: true, sources: [{ title: "AP", url: "https://apnews.com/example" }] },
    )).toEqual({
      explanation: "Three dates were added. Source links supporting the researched claims are attached below.",
      warnings: ["The chart is descriptive."],
    });
  });

  it("removes provider citation control tokens without flattening Markdown", () => {
    expect(sanitizeModelText("Teton is an outlier. citeturn0search1\n\n- **Reason:** leverage"))
      .toBe("Teton is an outlier.\n\n- **Reason:** leverage");
    expect(reconcileGroundedResponse(
      "Grounded answer citeturn0search0turn0search1",
      ["Check this citeturn0search0"],
      { researched: false, sources: [] },
    )).toEqual({ explanation: "Grounded answer", warnings: ["Check this"] });
  });

  it("reconstructs editable builder state from authoritative layered GGSQL", () => {
    const query = `WITH daily AS (
  SELECT end_date, approve, 37.27 AS low_average
  FROM chartize:presidential_approval_average
)
SELECT * FROM daily

VISUALISE
DRAW line
  MAPPING end_date AS x, approve AS y
  SETTING color => '#3cbbb1'
DRAW rule
  MAPPING low_average AS y
  SETTING aggregate => 'max', linetype => 'dashed'
SCALE x VIA date RENAMING * => '{:time %b %Y}'
LABEL title => 'Presidential approval, daily average', subtitle => 'Monthly low', x => 'Poll Date', y => 'Approval'`;
    const draft = draftFromGgsql(query, ["chartize:presidential_approval_average"]);
    expect(draft.source).toBe("chartize:presidential_approval_average");
    expect(draft.layers).toHaveLength(2);
    expect(draft.layers[0]).toMatchObject({ mark: "line", x: "end_date", y: "approve", fixedColour: "#3cbbb1" });
    expect(draft.layers[1]).toMatchObject({ mark: "rule", y: "low_average", fixedLinetype: "dashed" });
    expect(draft.scales[0]).toMatchObject({ aesthetic: "x", transform: "date", labelFormat: "{:time %b %Y}" });
    expect(draft).toMatchObject({
      title: "Presidential approval, daily average",
      subtitle: "Monthly low",
      axisLabels: { x: "Poll Date", y: "Approval" },
    });
  });
});

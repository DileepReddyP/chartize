import { describe, expect, it } from "vitest";
import {
  addSelectedColumn,
  addSelectedExpression,
  assertReadOnlyGgsql,
  directManipulationRanges,
  querySectionAtOffset,
  removeSelectedProjection,
  replaceQuerySources,
  replaceQuerySource,
  replaceSelectedColumns,
  resolveNamespacedSources,
  selectedColumns,
  sourceFromQuery,
  sourcesFromQuery,
  updateFirstVisual,
  visualPointState,
  visualSelectionFields,
} from "./query-context";

const query = `WITH source AS (SELECT * FROM chartize:polls)
SELECT "date", "approve"
FROM source
VISUALISE
DRAW line
  MAPPING "date" AS x, "approve" AS y`;

describe("GGSQL context", () => {
  it("uses the active selection before cursor section", () => {
    expect(querySectionAtOffset(query, 0, true)).toBe("selection");
    expect(querySectionAtOffset(query, query.indexOf("DRAW"), false)).toBe("visual");
  });

  it("rewrites the terminal SELECT without damaging a CTE", () => {
    const rewritten = replaceSelectedColumns(query, ["date", "approve", "disapprove"]);
    expect(rewritten).toContain("WITH source AS (SELECT * FROM chartize:polls)");
    expect(rewritten).toContain('SELECT "date", "approve", "disapprove"\nFROM source');
  });

  it("adds columns and identifies the active source", () => {
    expect([...selectedColumns(query, ["date", "approve"])]).toEqual(["date", "approve"]);
    expect(addSelectedColumn(query, "approve", ["date", "approve"])).toBe(query);
    expect(sourceFromQuery("SELECT * FROM chartize:polls\nVISUALISE")).toBe("chartize:polls");
  });

  it("resolves virtual namespaces before execution", () => {
    expect(resolveNamespacedSources("SELECT * FROM chartize:polls VISUALISE", (_, name) => `warehouse_${name}`))
      .toContain('FROM "warehouse_polls"');
  });

  it("replaces only the first source and preserves joins", () => {
    const joined = "SELECT * FROM chartize:polls JOIN chartize:states ON TRUE\nVISUALISE\nDRAW point";
    expect(replaceQuerySource(joined, "user:upload"))
      .toContain("FROM user:upload JOIN chartize:states");
  });

  it("multi-selects terminal sources without rewriting CTE internals", () => {
    const rewritten = replaceQuerySources(query, ["chartize:polls", "chartize:states"]);
    expect(rewritten).toContain("WITH source AS (SELECT * FROM chartize:polls)");
    expect(rewritten).toContain('FROM chartize:polls AS "polls"\nCROSS JOIN chartize:states AS "states"');
    expect(sourcesFromQuery(rewritten)).toEqual(["chartize:polls", "chartize:states"]);
    expect(sourceFromQuery(rewritten)).toBe("chartize:polls");
  });

  it("adds and removes qualified low-code projections", () => {
    const joined = replaceQuerySources(query, ["chartize:polls", "chartize:states"]);
    const added = addSelectedExpression(joined, '"states"."NAME" AS "states__NAME"', "states__NAME");
    expect(added).toContain('"states"."NAME" AS "states__NAME"');
    expect(removeSelectedProjection(added, "states__NAME")).not.toContain('"states"."NAME"');
  });

  it("exposes direct-manipulation ranges for fields and sources", () => {
    const ranges = directManipulationRanges(query);
    expect(ranges.some((range) => range.kind === "field" && query.slice(range.start, range.end) === '"date"')).toBe(true);
    expect(ranges.some((range) => range.kind === "source" && query.slice(range.start, range.end) === "source")).toBe(true);
  });

  it("updates only the first visual layer controls", () => {
    const updated = updateFirstVisual(query, { mark: "point", color: "party" });
    expect(updated).toContain("DRAW point");
    expect(updated).toContain('"party" AS colour');
    expect(updated).toContain("WITH source AS");
  });

  it("finds brush axes across layered ribbon and line marks", () => {
    const layered = `${query.replace("DRAW line", "DRAW ribbon").replace('"approve" AS y', '"lower" AS ymin, "upper" AS ymax')}\nDRAW line\n  MAPPING "date" AS x, "approve" AS y`;
    expect(visualSelectionFields(layered)).toEqual({ x: "date", y: "approve" });
  });

  it("round-trips labels, scales, facets, projection, and draw settings", () => {
    let updated = updateFirstVisual(query, {
      title: "Approval over time",
      subtitle: "Daily average",
      labelX: "Poll date",
      labelY: "Approval",
    });
    updated = updateFirstVisual(updated, { scaleXType: "continuous", scaleXTransform: "date", scaleXFormat: "%B %-d, %Y" });
    updated = updateFirstVisual(updated, { scaleColorType: "discrete", scaleColorPalette: "viridis" });
    updated = updateFirstVisual(updated, { facet: "party", facetFree: "y", facetColumns: "3" });
    updated = updateFirstVisual(updated, { project: "polar", position: "dodge", opacity: "0.65" });

    expect(updated).toContain("SETTING opacity => 0.65, position => 'dodge'");
    expect(updated).toContain("SCALE CONTINUOUS x VIA date");
    expect(updated).toContain("RENAMING * => '{:time %B %-d, %Y}'");
    expect(updated).toContain("SCALE DISCRETE colour TO viridis");
    expect(updated).toContain('FACET "party"');
    expect(updated).toContain("SETTING free => 'y', ncol => 3");
    expect(updated).toContain("PROJECT TO polar");
    expect(updated).toContain("LABEL title => 'Approval over time', subtitle => 'Daily average', x => 'Poll date', y => 'Approval'");

    const state = visualPointState(updated);
    expect(state).toMatchObject({
      opacity: "0.65",
      position: "dodge",
      scaleXType: "continuous",
      scaleXTransform: "date",
      scaleXFormat: "%B %-d, %Y",
      scaleColorPalette: "viridis",
      facet: "party",
      facetFree: "y",
      facetColumns: "3",
      project: "polar",
      title: "Approval over time",
      labelX: "Poll date",
    });
  });

  it("uses modern CRS projection syntax", () => {
    const updated = updateFirstVisual(query, { project: "crs", projectTarget: "EPSG:4326" });
    expect(updated).toContain("PROJECT TO crs\n  SETTING target => 'EPSG:4326'");
    expect(updated).not.toContain("COORD map");
  });

  it("blocks mutation and file-reader operations while allowing strings", () => {
    expect(() => assertReadOnlyGgsql(query)).not.toThrow();
    expect(() => assertReadOnlyGgsql("DELETE FROM polls\nVISUALISE")).toThrow("Only SELECT");
    expect(() => assertReadOnlyGgsql("SELECT * FROM read_parquet('/etc/passwd')\nVISUALISE")).toThrow("READ_PARQUET");
    expect(() => assertReadOnlyGgsql("SELECT 'delete' AS note\nVISUALISE")).not.toThrow();
  });
});

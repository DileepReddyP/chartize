import { expect, it } from "vitest";
import { assertSafeWorkspaceAction } from "./ai-sql-safety";

it("permits derived cleaning while rejecting comment, qualifier, rename and multi-statement bypasses", () => {
  expect(() => assertSafeWorkspaceAction('CREATE TABLE cleaned AS SELECT * FROM "user:upload"; UPDATE cleaned SET value = 1')).not.toThrow();
  for (const sql of [
    'DROP /* gap */ TABLE "__user_raw"',
    'UPDATE main."__chartize_source" SET value=0',
    'ALTER TABLE cleaned RENAME TO "__user_raw"',
    'CREATE TABLE cleaned AS SELECT 1; PRAGMA query_only=OFF',
    'CREATE TABLE cleaned AS SELECT 1; CREATE TRIGGER secretly_change_raw AFTER INSERT ON cleaned BEGIN DELETE FROM "__user_raw"; END',
  ]) expect(() => assertSafeWorkspaceAction(sql)).toThrow();
});

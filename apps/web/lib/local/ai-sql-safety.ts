import { sqlStatements } from "../ggsql/query-context";

function withoutComments(sql: string) {
  return sql.replace(/('(?:''|[^'])*'|"(?:""|[^"])*"|`(?:``|[^`])*`|\[[^\]]*\])|--[^\n]*|\/\*[\s\S]*?\*\//g, (match, quoted) => quoted ? match : " ");
}

const identifier = '("(?:""|[^"])+"|`(?:``|[^`])+`|\\[[^\\]]+\\]|[a-z_][a-z0-9_]*)';
const writeTarget = new RegExp(`^(?:CREATE\\s+(?:TEMP(?:ORARY)?\\s+)?TABLE(?:\\s+IF\\s+NOT\\s+EXISTS)?|DROP\\s+TABLE(?:\\s+IF\\s+EXISTS)?|INSERT(?:\\s+OR\\s+(?:REPLACE|IGNORE|ABORT|FAIL|ROLLBACK))?\\s+INTO|UPDATE(?:\\s+OR\\s+(?:REPLACE|IGNORE|ABORT|FAIL|ROLLBACK))?|DELETE\\s+FROM|ALTER\\s+TABLE)\\s+${identifier}`, "i");

function assertDerivedTarget(target: string, rest: string) {
  const name = target.replace(/^["`\[]|["`\]]$/g, "");
  if (/[:.]|^__/i.test(name) || /^\s*\./.test(rest)) {
    throw new Error("A workspace action must write to a derived local table, not a catalog source or raw upload.");
  }
}

/** Every statement must be an ordinary table mutation with an inspectable destination. */
export function assertSafeWorkspaceAction(sql: string) {
  const statements = sqlStatements(withoutComments(sql)).map((statement) => statement.trim()).filter(Boolean);
  if (!statements.length) throw new Error("A workspace action must contain an explicit local SQL change.");
  for (const statement of statements) {
    if (/\b(?:VISUALI[ZS]E|PRAGMA|ATTACH|DETACH|INSTALL|LOAD|VACUUM|load_extension|writefile|readfile|eval)\b/i.test(statement)
      || /(?:https?:\/\/|file:|\/Users\/|\.\.\/)/i.test(statement)) throw new Error("A workspace action cannot access extensions, URLs, or the filesystem.");
    const match = writeTarget.exec(statement);
    if (!match?.[1]) throw new Error("A workspace action must contain an explicit local table change.");
    const rest = statement.slice(match[0].length);
    assertDerivedTarget(match[1], rest);
    if (/^ALTER\b/i.test(statement) && /^\s+RENAME\s+TO\s+/i.test(rest)) {
      const rename = new RegExp(`^\\s+RENAME\\s+TO\\s+${identifier}`, "i").exec(rest);
      if (!rename?.[1]) throw new Error("Name the derived destination table explicitly.");
      assertDerivedTarget(rename[1], rest.slice(rename[0].length));
    }
  }
}

import { VisualizationLayerSchema, VisualizationScaleSchema, type VisualizationLayer, type VisualizationScale } from "@chartize/contracts";

export type QuerySection = "sql" | "visual" | "selection";

export interface VisualPointState {
  mark: string;
  x: string;
  y: string;
  xEnd: string;
  yEnd: string;
  xMin: string;
  xMax: string;
  yMin: string;
  yMax: string;
  slope: string;
  color: string;
  fill: string;
  size: string;
  shape: string;
  linetype: string;
  linewidth: string;
  opacityField: string;
  weight: string;
  geometry: string;
  opacity: string;
  position: string;
  colourLegendValue: string;
  fillLegendValue: string;
  fixedColour: string;
  fixedFill: string;
  fixedSize: string;
  fixedLinewidth: string;
  fixedLinetype: string;
  aggregate: string;
  smoothMethod: string;
  smoothAdjust: string;
  smoothBandwidth: string;
  smoothKernel: string;
  scaleXType: string;
  scaleXTransform: string;
  scaleXFormat: string;
  scaleYType: string;
  scaleYTransform: string;
  scaleYFormat: string;
  scaleColorType: string;
  scaleColorPalette: string;
  facet: string;
  facetBy: string;
  facetFree: string;
  facetColumns: string;
  project: string;
  projectTarget: string;
  title: string;
  subtitle: string;
  labelX: string;
  labelY: string;
  labelColor: string;
  labelFill: string;
  labelSize: string;
  labelShape: string;
  labelLinetype: string;
  labelLinewidth: string;
  labelOpacity: string;
}

const VISUALISE_LINE = /^\s*VISUALI[ZS]E\b/im;

export function findVisualiseOffset(query: string) {
  return query.search(VISUALISE_LINE);
}

export function splitGgsql(query: string) {
  const visualise = findVisualiseOffset(query);
  if (visualise < 0) return { sql: query.trim(), visual: "", visualise: -1 };
  return {
    sql: query.slice(0, visualise).trim(),
    visual: query.slice(visualise).trim(),
    visualise,
  };
}

export function querySectionAtOffset(query: string, offset: number, hasSelection: boolean): QuerySection {
  if (hasSelection) return "selection";
  const visualise = findVisualiseOffset(query);
  return visualise >= 0 && offset >= visualise ? "visual" : "sql";
}

function executableSql(sql: string) {
  let output = "";
  let index = 0;
  let state: "normal" | "single" | "double" | "line" | "block" = "normal";
  while (index < sql.length) {
    const character = sql[index]!;
    const next = sql[index + 1];
    if (state === "normal") {
      if (character === "'") { state = "single"; output += " "; }
      else if (character === '"') { state = "double"; output += " "; }
      else if (character === "-" && next === "-") { state = "line"; output += "  "; index += 2; continue; }
      else if (character === "/" && next === "*") { state = "block"; output += "  "; index += 2; continue; }
      else output += character;
    } else if (state === "single") {
      output += character === "\n" ? "\n" : " ";
      if (character === "'" && next === "'") { output += " "; index += 2; continue; }
      if (character === "'") state = "normal";
    } else if (state === "double") {
      output += character === "\n" ? "\n" : " ";
      if (character === '"' && next === '"') { output += " "; index += 2; continue; }
      if (character === '"') state = "normal";
    } else if (state === "line" && character === "\n") {
      state = "normal";
      output += "\n";
    } else if (state === "block" && character === "*" && next === "/") {
      state = "normal";
      output += "  ";
      index += 2;
      continue;
    } else {
      output += character === "\n" ? "\n" : " ";
    }
    index += 1;
  }
  return output;
}

/** Split a local SQL program while ignoring semicolons in strings/comments. */
export function sqlStatements(sql: string) {
  const statements: string[] = [];
  let start = 0;
  let index = 0;
  let state: "normal" | "single" | "double" | "line" | "block" = "normal";
  while (index < sql.length) {
    const character = sql[index]!;
    const next = sql[index + 1];
    if (state === "normal") {
      if (character === "'") state = "single";
      else if (character === '"') state = "double";
      else if (character === "-" && next === "-") { state = "line"; index += 1; }
      else if (character === "/" && next === "*") { state = "block"; index += 1; }
      else if (character === ";") {
        const statement = sql.slice(start, index).trim();
        if (statement) statements.push(statement);
        start = index + 1;
      }
    } else if (state === "single") {
      if (character === "'" && next === "'") index += 1;
      else if (character === "'") state = "normal";
    } else if (state === "double") {
      if (character === '"' && next === '"') index += 1;
      else if (character === '"') state = "normal";
    } else if (state === "line" && character === "\n") {
      state = "normal";
    } else if (state === "block" && character === "*" && next === "/") {
      state = "normal";
      index += 1;
    }
    index += 1;
  }
  const trailing = sql.slice(start).trim();
  if (trailing) statements.push(trailing);
  return statements;
}

export function finalSqlStatement(sql: string) {
  return sqlStatements(sql).at(-1) ?? "";
}

export function isResultSqlStatement(sql: string) {
  return /^(?:SELECT|WITH)\b/i.test(executableSql(sql).trimStart());
}

interface Token {
  value: string;
  start: number;
  end: number;
  depth: number;
}

export interface QuerySourceRef {
  id: string;
  keyword: "FROM" | "JOIN";
  start: number;
  end: number;
  keywordStart: number;
}

export interface DirectManipulationRange {
  kind: "field" | "source";
  start: number;
  end: number;
}

function sqlTokens(sql: string) {
  const scrubbed = executableSql(sql);
  const tokens: Token[] = [];
  let depth = 0;
  let index = 0;
  while (index < scrubbed.length) {
    const character = scrubbed[index]!;
    if (character === "(") { depth += 1; index += 1; continue; }
    if (character === ")") { depth = Math.max(0, depth - 1); index += 1; continue; }
    if (!/[a-z_]/i.test(character)) { index += 1; continue; }
    const start = index;
    index += 1;
    while (index < scrubbed.length && /[\w$]/.test(scrubbed[index]!)) index += 1;
    tokens.push({ value: scrubbed.slice(start, index).toUpperCase(), start, end: index, depth });
  }
  return tokens;
}

function terminalSelectBounds(sql: string) {
  const tokens = sqlTokens(sql);
  const select = [...tokens].reverse().find((token) => token.depth === 0 && token.value === "SELECT");
  if (!select) return null;
  const from = tokens.find((token) => token.depth === 0 && token.value === "FROM" && token.start > select.end);
  return from ? { select, from } : null;
}

function terminalSourceRefs(sql: string): QuerySourceRef[] {
  const bounds = terminalSelectBounds(sql);
  if (!bounds) return [];
  return sqlTokens(sql)
    .filter((token) => token.depth === 0 && token.start >= bounds.from.start && (token.value === "FROM" || token.value === "JOIN"))
    .flatMap((token) => {
      const tail = sql.slice(token.end);
      const match = /^\s+(?:"((?:[^"]|"")+)"|([a-z_][\w:-]*))/i.exec(tail);
      if (!match) return [];
      const literal = match[0].trimStart();
      const leading = match[0].length - literal.length;
      const start = token.end + leading;
      const id = match[1]?.replaceAll('""', '"') ?? match[2] ?? "";
      return [{ id, keyword: token.value as "FROM" | "JOIN", start, end: start + literal.length, keywordStart: token.start }];
    });
}

function allSourceRefs(sql: string): QuerySourceRef[] {
  return sqlTokens(sql)
    .filter((token) => token.value === "FROM" || token.value === "JOIN")
    .flatMap((token) => {
      const tail = sql.slice(token.end);
      const match = /^\s+(?:"((?:[^"]|"")+)"|([a-z_][\w:-]*))/i.exec(tail);
      if (!match) return [];
      const literal = match[0].trimStart();
      const leading = match[0].length - literal.length;
      const start = token.end + leading;
      const id = match[1]?.replaceAll('""', '"') ?? match[2] ?? "";
      return [{ id, keyword: token.value as "FROM" | "JOIN", start, end: start + literal.length, keywordStart: token.start }];
    });
}

function terminalFromEnd(sql: string, fromStart: number) {
  const clauses = new Set(["WHERE", "GROUP", "HAVING", "QUALIFY", "WINDOW", "ORDER", "LIMIT", "OFFSET", "UNION", "EXCEPT", "INTERSECT"]);
  return sqlTokens(sql).find((token) => token.depth === 0 && token.start > fromStart && clauses.has(token.value))?.start ?? sql.length;
}

export function sourcesFromQuery(query: string) {
  return [...new Set(allSourceRefs(query)
    .map((source) => source.id)
    .filter((source) => /^(?:chartize|user|ggsql):[\w-]+$/i.test(source)))];
}

export function sourceAlias(source: string, index = 0) {
  const raw = source.replace(/^\w+:/, "").replaceAll(/[^a-z0-9_]+/gi, "_").replaceAll(/^_+|_+$/g, "") || `source_${index + 1}`;
  return /^\d/.test(raw) ? `source_${raw}` : raw;
}

export function replaceQuerySources(query: string, sources: string[]) {
  if (!sources.length) return query;
  const { sql, visual } = splitGgsql(query);
  const refs = terminalSourceRefs(sql);
  const bounds = terminalSelectBounds(sql);
  if (!refs.length || !bounds) return query;
  const aliases = new Map<string, number>();
  const rendered = sources.map((source, index) => {
    const base = sourceAlias(source, index);
    const seen = aliases.get(base) ?? 0;
    aliases.set(base, seen + 1);
    const alias = seen ? `${base}_${seen + 1}` : base;
    const relation = sources.length > 1 ? `${source} AS ${quoteIdentifier(alias)}` : source;
    return `${index ? "CROSS JOIN" : "FROM"} ${relation}`;
  }).join("\n");
  const end = terminalFromEnd(sql, bounds.from.start);
  const nextSql = `${sql.slice(0, bounds.from.start)}${rendered}\n${sql.slice(end).trimStart()}`.trim();
  return visual ? `${nextSql}\n\n${visual}` : nextSql;
}

export function selectedColumns(query: string, available: string[]) {
  const { sql } = splitGgsql(query);
  const bounds = terminalSelectBounds(sql);
  if (!bounds) return new Set<string>();
  const selection = sql.slice(bounds.select.end, bounds.from.start);
  if (/(^|,)\s*(?:[\w".]+\.)?\*\s*(?:,|$)/.test(selection)) return new Set(available);
  const lookup = new Map(available.map((column) => [column.toLocaleLowerCase(), column]));
  const result = new Set<string>();
  for (const match of selection.matchAll(/"((?:[^"]|"")+)"|\b([a-z_][\w$]*)\b/gi)) {
    const name = (match[1]?.replaceAll('""', '"') ?? match[2] ?? "").toLocaleLowerCase();
    const column = lookup.get(name);
    if (column) result.add(column);
  }
  return result;
}

const quoteIdentifier = (value: string) => `"${value.replaceAll('"', '""')}"`;

export function replaceSelectedColumns(query: string, columns: string[]) {
  const { sql, visual } = splitGgsql(query);
  const bounds = terminalSelectBounds(sql);
  if (!bounds || !columns.length) return query;
  const selection = columns.map(quoteIdentifier).join(", ");
  const nextSql = `${sql.slice(0, bounds.select.end)} ${selection}\n${sql.slice(bounds.from.start)}`;
  return visual ? `${nextSql.trim()}\n\n${visual}` : nextSql;
}

function projectionItems(sql: string) {
  const bounds = terminalSelectBounds(sql);
  if (!bounds) return [];
  const value = sql.slice(bounds.select.end, bounds.from.start);
  const items: Array<{ text: string; start: number; end: number }> = [];
  let start = 0;
  let depth = 0;
  let quote: "single" | "double" | null = null;
  for (let index = 0; index <= value.length; index += 1) {
    const character = value[index];
    const next = value[index + 1];
    if (quote === "single") {
      if (character === "'" && next === "'") { index += 1; continue; }
      if (character === "'") quote = null;
    } else if (quote === "double") {
      if (character === '"' && next === '"') { index += 1; continue; }
      if (character === '"') quote = null;
    } else if (character === "'") quote = "single";
    else if (character === '"') quote = "double";
    else if (character === "(") depth += 1;
    else if (character === ")") depth = Math.max(0, depth - 1);
    else if ((character === "," && depth === 0) || index === value.length) {
      const raw = value.slice(start, index);
      const leading = raw.length - raw.trimStart().length;
      const text = raw.trim();
      if (text) items.push({ text, start: bounds.select.end + start + leading, end: bounds.select.end + index });
      start = index + 1;
    }
  }
  return items;
}

function projectionLabel(expression: string) {
  const alias = /\bAS\s+(?:"((?:[^"]|"")+)"|([a-z_][\w$]*))\s*$/i.exec(expression);
  if (alias) return alias[1]?.replaceAll('""', '"') ?? alias[2] ?? "";
  const identifiers = [...expression.matchAll(/"((?:[^"]|"")+)"|\b([a-z_][\w$]*)\b/gi)];
  const last = identifiers.at(-1);
  return last?.[1]?.replaceAll('""', '"') ?? last?.[2] ?? expression;
}

export function selectedProjectionLabels(query: string) {
  return projectionItems(splitGgsql(query).sql).map((item) => projectionLabel(item.text));
}

function replaceProjectionItems(query: string, items: string[]) {
  if (!items.length) return query;
  const { sql, visual } = splitGgsql(query);
  const bounds = terminalSelectBounds(sql);
  if (!bounds) return query;
  const nextSql = `${sql.slice(0, bounds.select.end)} ${items.join(", ")}\n${sql.slice(bounds.from.start)}`;
  return visual ? `${nextSql.trim()}\n\n${visual}` : nextSql;
}

export function addSelectedExpression(query: string, expression: string, outputName: string) {
  const { sql } = splitGgsql(query);
  const items = projectionItems(sql);
  if (items.some((item) => projectionLabel(item.text).toLocaleLowerCase() === outputName.toLocaleLowerCase())) return query;
  return replaceProjectionItems(query, [...items.map((item) => item.text), expression]);
}

export function removeSelectedProjection(query: string, outputName: string) {
  const items = projectionItems(splitGgsql(query).sql);
  const next = items.filter((item) => projectionLabel(item.text).toLocaleLowerCase() !== outputName.toLocaleLowerCase());
  return next.length && next.length !== items.length ? replaceProjectionItems(query, next.map((item) => item.text)) : query;
}

export function removeProjectionAlias(query: string, alias: string) {
  const marker = `${quoteIdentifier(alias)}.`.toLocaleLowerCase();
  const items = projectionItems(splitGgsql(query).sql);
  const next = items.filter((item) => !item.text.toLocaleLowerCase().includes(marker));
  return next.length && next.length !== items.length ? replaceProjectionItems(query, next.map((item) => item.text)) : query;
}

export function collapseSingleSourceProjection(query: string, alias: string) {
  const escaped = alias.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const qualified = new RegExp(`"${escaped}"\\."((?:[^"]|"")+)"\\s+AS\\s+"${escaped}__((?:[^"]|"")+)"`, "gi");
  return query.replace(qualified, (_match, field: string) => quoteIdentifier(field.replaceAll('""', '"')));
}

export function addSelectedColumn(query: string, column: string, available: string[]) {
  const current = selectedColumns(query, available);
  if (current.has(column)) return query;
  return replaceSelectedColumns(query, [...current, column]);
}

const SOURCE = /\b(FROM|JOIN)\s+(?:"((?:[^"]|"")+)"|([a-z_][\w:-]*))/gi;

export function sourceFromQuery(query: string, fallback = "") {
  return sourcesFromQuery(query)[0] ?? fallback;
}

export function replaceQuerySource(query: string, source: string) {
  const { sql, visual } = splitGgsql(query);
  const first = terminalSourceRefs(sql)[0];
  if (!first) return query;
  const replaced = `${sql.slice(0, first.start)}${source}${sql.slice(first.end)}`;
  return visual ? `${replaced.trim()}\n\n${visual}` : replaced;
}

export function queryControlOffsets(query: string) {
  const { sql } = splitGgsql(query);
  const bounds = terminalSelectBounds(sql);
  const sources = terminalSourceRefs(sql);
  if (!bounds || !sources.length) return null;
  return {
    select: Math.max(bounds.select.end, bounds.from.start - 1),
    from: sources.at(-1)!.end,
  };
}

export function directManipulationRanges(query: string): DirectManipulationRange[] {
  const { sql } = splitGgsql(query);
  const fields = projectionItems(sql).flatMap((item) => {
    const matches = [...item.text.matchAll(/"(?:[^"]|"")+"/g)];
    return matches.map((match) => ({ kind: "field" as const, start: item.start + (match.index ?? 0), end: item.start + (match.index ?? 0) + match[0].length }));
  });
  const sources = terminalSourceRefs(sql).map((source) => ({ kind: "source" as const, start: source.start, end: source.end }));
  return [...fields, ...sources];
}

export function resolveNamespacedSources(query: string, resolve: (namespace: "chartize" | "user", name: string) => string | undefined) {
  SOURCE.lastIndex = 0;
  return query.replace(SOURCE, (match, keyword: string, quoted: string | undefined, bare: string | undefined) => {
    const source = quoted?.replaceAll('""', '"') ?? bare ?? "";
    const namespaced = /^(chartize|user):([\w-]+)$/i.exec(source);
    if (!namespaced) return match;
    const actual = resolve(namespaced[1]!.toLocaleLowerCase() as "chartize" | "user", namespaced[2]!);
    if (!actual) throw new Error(`Unknown data source: ${source}.`);
    return `${keyword} ${quoteIdentifier(actual)}`;
  });
}

const quoteLiteral = (value: string) => `'${value.replaceAll("'", "''")}'`;
const unquoteIdentifier = (value: string) => value.trim().replace(/^"|"$/g, "").replaceAll('""', '"');
const unquoteLiteral = (value: string) => value.replace(/^'|'$/g, "").replaceAll("''", "'");

interface VisualBlock {
  start: number;
  end: number;
  text: string;
}

function visualBlocks(visual: string): VisualBlock[] {
  const starts = [...visual.matchAll(/^(?:DRAW|PLACE|SCALE|FACET|PROJECT|LABEL)\b/gim)]
    .map((match) => match.index ?? 0);
  return starts.map((start, index) => ({
    start,
    end: starts[index + 1] ?? visual.length,
    text: visual.slice(start, starts[index + 1] ?? visual.length).trimEnd(),
  }));
}

function firstBlock(visual: string, clause: RegExp) {
  return visualBlocks(visual).find((block) => clause.test(block.text));
}

function replaceBlock(visual: string, block: VisualBlock | undefined, rendered: string, beforeLabel = true) {
  if (block) {
    const suffix = visual.slice(block.end).replace(/^\s*\n/, "\n");
    return `${visual.slice(0, block.start)}${rendered}${rendered && suffix ? "\n" : ""}${suffix}`.trimEnd();
  }
  if (!rendered) return visual;
  const label = beforeLabel ? firstBlock(visual, /^LABEL\b/i) : undefined;
  const at = label?.start ?? visual.length;
  return `${visual.slice(0, at).trimEnd()}\n${rendered}\n${visual.slice(at).trimStart()}`.trimEnd();
}

function assignment(block: string, name: string) {
  const match = new RegExp(`\\b${name}\\s*=>\\s*('(?:''|[^'])*'|\\[[^\\]]*\\]|[^,\\n]+)`, "i").exec(block);
  return match?.[1]?.trim() ?? "";
}

function mappedField(block: string, aesthetic: string) {
  const mapping = /\bMAPPING\s+([\s\S]*?)(?=\n\s*(?:SETTING|FROM)\b|$)/i.exec(block)?.[1] ?? "";
  const expression = new RegExp(`(?:"((?:[^"]|"")+)"|([a-z_][\\w$]*))\\s+AS\\s+${aesthetic}\\b`, "i").exec(mapping);
  return expression?.[1]?.replaceAll('""', '"') ?? expression?.[2] ?? "";
}

function mappedLiteral(block: string, aesthetic: string) {
  const mapping = /\bMAPPING\s+([\s\S]*?)(?=\n\s*(?:SETTING|FROM)\b|$)/i.exec(block)?.[1] ?? "";
  const expression = new RegExp(`('(?:''|[^'])*')\\s+AS\\s+${aesthetic}\\b`, "i").exec(mapping);
  return expression?.[1] ? unquoteLiteral(expression[1]) : "";
}

function scaleState(visual: string, aesthetic: "x" | "y" | "colour") {
  const alias = aesthetic === "colour" ? "colou?r" : aesthetic;
  const block = visualBlocks(visual).find((candidate) => new RegExp(`^SCALE\\s+(?:(?:continuous|discrete|binned|ordinal|identity)\\s+)?${alias}\\b`, "i").test(candidate.text));
  if (!block) return { type: "", transform: "", format: "", palette: "" };
  const header = /^SCALE\s+(?:(continuous|discrete|binned|ordinal|identity)\s+)?(?:[a-z_][\w-]*)([\s\S]*)/i.exec(block.text);
  const tail = header?.[2] ?? "";
  const formatValue = /\bRENAMING\s+\*\s*=>\s*('(?:''|[^'])*)/i.exec(tail)?.[1];
  const format = formatValue ? unquoteLiteral(formatValue).replace(/^\{:time\s+/, "").replace(/}$/, "") : "";
  return {
    type: header?.[1]?.toLocaleLowerCase() ?? "",
    transform: /\bVIA\s+([a-z_][\w-]*)/i.exec(tail)?.[1]?.toLocaleLowerCase() ?? "",
    format,
    palette: /\bTO\s+([a-z_][\w-]*)/i.exec(tail)?.[1]?.toLocaleLowerCase() ?? "",
  };
}

/** Reconstructs editable visualization layers from GGSQL presentation clauses. */
export function visualLayersFromQuery(query: string): VisualizationLayer[] {
  const { visual } = splitGgsql(query);
  return visualBlocks(visual).flatMap((block) => {
    const header = /^(DRAW|PLACE)\s+([a-z_][\w-]*)/i.exec(block.text);
    if (!header) return [];
    const settingNumber = (name: string, fallback: number) => {
      const value = Number(assignment(block.text, name));
      return Number.isFinite(value) ? value : fallback;
    };
    const parsed = VisualizationLayerSchema.safeParse({
      mark: header[2]?.toLocaleLowerCase(),
      x: mappedField(block.text, "x"),
      y: mappedField(block.text, "y"),
      lon: mappedField(block.text, "lon"),
      lat: mappedField(block.text, "lat"),
      label: mappedField(block.text, "label"),
      xEnd: mappedField(block.text, "xend"),
      yEnd: mappedField(block.text, "yend"),
      xMin: mappedField(block.text, "xmin"),
      xMax: mappedField(block.text, "xmax"),
      yMin: mappedField(block.text, "ymin"),
      yMax: mappedField(block.text, "ymax"),
      slope: mappedField(block.text, "slope"),
      color: mappedField(block.text, "colou?r"),
      fill: mappedField(block.text, "fill"),
      size: mappedField(block.text, "size"),
      shape: mappedField(block.text, "shape"),
      linetype: mappedField(block.text, "linetype"),
      linewidth: mappedField(block.text, "linewidth"),
      opacityField: mappedField(block.text, "opacity"),
      weight: mappedField(block.text, "weight"),
      geometry: mappedField(block.text, "geometry"),
      opacity: Math.max(0, Math.min(1, settingNumber("opacity", 0.9))),
      position: unquoteLiteral(assignment(block.text, "position")) || "identity",
      colourLegendValue: mappedLiteral(block.text, "colou?r"),
      fillLegendValue: mappedLiteral(block.text, "fill"),
      fixedColour: unquoteLiteral(assignment(block.text, "colou?r")),
      fixedFill: unquoteLiteral(assignment(block.text, "fill")),
      fixedSize: Math.max(0, settingNumber("size", 0)),
      fixedLinewidth: Math.max(0, settingNumber("linewidth", 0)),
      fixedLinetype: unquoteLiteral(assignment(block.text, "linetype")),
      fixedFontSize: Math.max(0, settingNumber("fontsize", 0)),
      fixedFontWeight: unquoteLiteral(assignment(block.text, "fontweight")),
      smoothMethod: unquoteLiteral(assignment(block.text, "method")),
      smoothAdjust: Math.max(Number.EPSILON, settingNumber("adjust", 1)),
      smoothBandwidth: Math.max(0, settingNumber("bandwidth", 0)),
      smoothKernel: unquoteLiteral(assignment(block.text, "kernel")),
      place: header[1]?.toLocaleUpperCase() === "PLACE",
      literalX: assignment(block.text, "x"),
      literalY: assignment(block.text, "y"),
      literalXEnd: assignment(block.text, "xend"),
      literalYEnd: assignment(block.text, "yend"),
      literalSlope: assignment(block.text, "slope"),
    });
    return parsed.success ? [parsed.data] : [];
  });
}

export function visualScalesFromQuery(query: string): VisualizationScale[] {
  const { visual } = splitGgsql(query);
  return visualBlocks(visual).flatMap((block) => {
    const header = /^SCALE\s+(?:(continuous|discrete|binned|ordinal|identity)\s+)?(x|y|colou?r|fill|size|opacity)\b([\s\S]*)/i.exec(block.text);
    if (!header) return [];
    const formatter = /\bRENAMING\s+\*\s*=>\s*('(?:''|[^'])*)/i.exec(header[3] ?? "")?.[1];
    const parsed = VisualizationScaleSchema.safeParse({
      aesthetic: header[2]?.toLocaleLowerCase().replace("color", "colour"),
      type: header[1]?.toLocaleLowerCase() ?? "",
      palette: /\bTO\s+([a-z_][\w-]*)/i.exec(header[3] ?? "")?.[1] ?? "",
      transform: /\bVIA\s+([a-z_][\w-]*)/i.exec(header[3] ?? "")?.[1]?.toLocaleLowerCase(),
      labelFormat: formatter ? unquoteLiteral(formatter) : undefined,
    });
    return parsed.success ? [parsed.data] : [];
  });
}

function labelState(visual: string) {
  const block = firstBlock(visual, /^LABEL\b/i)?.text ?? "";
  const labels = new Map<string, string>();
  for (const match of block.matchAll(/\b([a-z_][\w-]*)\s*=>\s*('(?:''|[^'])*')/gi)) {
    labels.set(match[1]!.toLocaleLowerCase(), unquoteLiteral(match[2]!));
  }
  return labels;
}

export function visualPointState(query: string): VisualPointState {
  const { visual } = splitGgsql(query);
  const draw = firstBlock(visual, /^DRAW\b/i)?.text ?? "";
  const mark = /^DRAW\s+([a-z_][\w-]*)/i.exec(draw)?.[1] ?? "point";
  const xScale = scaleState(visual, "x");
  const yScale = scaleState(visual, "y");
  const colorScale = scaleState(visual, "colour");
  const facetBlock = firstBlock(visual, /^FACET\b/i)?.text ?? "";
  const facet = /^FACET\s+((?:"(?:[^"]|"")+"|[a-z_][\w$]*))/i.exec(facetBlock)?.[1] ?? "";
  const facetBy = /\bBY\s+((?:"(?:[^"]|"")+"|[a-z_][\w$]*))/i.exec(facetBlock)?.[1] ?? "";
  const projectBlock = firstBlock(visual, /^PROJECT\b/i)?.text ?? "";
  const labels = labelState(visual);
  return {
    mark,
    x: mappedField(draw, "x"),
    y: mappedField(draw, "y"),
    xEnd: mappedField(draw, "xend"),
    yEnd: mappedField(draw, "yend"),
    xMin: mappedField(draw, "xmin"),
    xMax: mappedField(draw, "xmax"),
    yMin: mappedField(draw, "ymin"),
    yMax: mappedField(draw, "ymax"),
    slope: mappedField(draw, "slope"),
    color: mappedField(draw, "colou?r"),
    fill: mappedField(draw, "fill"),
    size: mappedField(draw, "size"),
    shape: mappedField(draw, "shape"),
    linetype: mappedField(draw, "linetype"),
    linewidth: mappedField(draw, "linewidth"),
    opacityField: mappedField(draw, "opacity"),
    weight: mappedField(draw, "weight"),
    geometry: mappedField(draw, "geometry"),
    opacity: assignment(draw, "opacity").replace(/^'|'$/g, "") || "0.9",
    position: unquoteLiteral(assignment(draw, "position")) || "identity",
    colourLegendValue: mappedLiteral(draw, "colou?r"),
    fillLegendValue: mappedLiteral(draw, "fill"),
    fixedColour: unquoteLiteral(assignment(draw, "colou?r")),
    fixedFill: unquoteLiteral(assignment(draw, "fill")),
    fixedSize: assignment(draw, "size"),
    fixedLinewidth: assignment(draw, "linewidth"),
    fixedLinetype: unquoteLiteral(assignment(draw, "linetype")),
    aggregate: assignment(draw, "aggregate"),
    smoothMethod: unquoteLiteral(assignment(draw, "method")),
    smoothAdjust: assignment(draw, "adjust"),
    smoothBandwidth: assignment(draw, "bandwidth"),
    smoothKernel: unquoteLiteral(assignment(draw, "kernel")),
    scaleXType: xScale.type,
    scaleXTransform: xScale.transform,
    scaleXFormat: xScale.format,
    scaleYType: yScale.type,
    scaleYTransform: yScale.transform,
    scaleYFormat: yScale.format,
    scaleColorType: colorScale.type,
    scaleColorPalette: colorScale.palette,
    facet: unquoteIdentifier(facet),
    facetBy: unquoteIdentifier(facetBy),
    facetFree: unquoteLiteral(assignment(facetBlock, "free")),
    facetColumns: assignment(facetBlock, "ncol"),
    project: /\bTO\s+([a-z_][\w-]*)/i.exec(projectBlock)?.[1]?.toLocaleLowerCase() ?? "",
    projectTarget: unquoteLiteral(assignment(projectBlock, "target")),
    title: labels.get("title") ?? "",
    subtitle: labels.get("subtitle") ?? "",
    labelX: labels.get("x") ?? "",
    labelY: labels.get("y") ?? "",
    labelColor: labels.get("colour") ?? labels.get("color") ?? "",
    labelFill: labels.get("fill") ?? "",
    labelSize: labels.get("size") ?? "",
    labelShape: labels.get("shape") ?? "",
    labelLinetype: labels.get("linetype") ?? "",
    labelLinewidth: labels.get("linewidth") ?? "",
    labelOpacity: labels.get("opacity") ?? "",
  };
}

/** Chooses usable axes across layered DRAW blocks for brush summaries. */
export function visualSelectionFields(query: string) {
  const draws = visualBlocks(splitGgsql(query).visual)
    .filter((block) => /^DRAW\b/i.test(block.text))
    .map((block) => block.text);
  const first = (aesthetic: string) => draws.map((draw) => mappedField(draw, aesthetic)).find(Boolean) ?? "";
  return {
    x: first("x") || first("xmin") || first("xmax"),
    y: first("y") || first("ymin") || first("ymax"),
  };
}

const drawKeys: Array<keyof VisualPointState> = [
  "mark", "x", "y", "xEnd", "yEnd", "xMin", "xMax", "yMin", "yMax", "slope",
  "color", "fill", "size", "shape", "linetype", "linewidth", "opacityField", "weight", "geometry",
  "opacity", "position", "colourLegendValue", "fillLegendValue", "fixedColour", "fixedFill",
  "fixedSize", "fixedLinewidth", "fixedLinetype", "aggregate", "smoothMethod", "smoothAdjust",
  "smoothBandwidth", "smoothKernel",
];
const labelKeys: Array<keyof VisualPointState> = ["title", "subtitle", "labelX", "labelY", "labelColor", "labelFill", "labelSize", "labelShape", "labelLinetype", "labelLinewidth", "labelOpacity"];

function hasAny(next: Partial<VisualPointState>, keys: Array<keyof VisualPointState>) {
  return keys.some((key) => Object.prototype.hasOwnProperty.call(next, key));
}

function renderDraw(state: VisualPointState) {
  const mappings: Array<[string, string]> = state.mark === "spatial"
    ? [[state.geometry, "geometry"], [state.fill, "fill"], [state.color, "colour"], [state.opacityField, "opacity"]]
    : [
        [state.x, "x"], [state.y, "y"], [state.xEnd, "xend"], [state.yEnd, "yend"],
        [state.xMin, "xmin"], [state.xMax, "xmax"], [state.yMin, "ymin"], [state.yMax, "ymax"],
        [state.slope, "slope"], [state.color, "colour"], [state.fill, "fill"], [state.size, "size"],
        [state.shape, "shape"], [state.linetype, "linetype"], [state.linewidth, "linewidth"],
        [state.opacityField, "opacity"], [state.weight, "weight"],
      ];
  const renderedMappings = mappings.filter(([field]) => field).map(([field, aesthetic]) => `${quoteIdentifier(field)} AS ${aesthetic}`);
  if (!state.color && state.colourLegendValue) renderedMappings.push(`${quoteLiteral(state.colourLegendValue)} AS colour`);
  if (!state.fill && state.fillLegendValue) renderedMappings.push(`${quoteLiteral(state.fillLegendValue)} AS fill`);
  const mapping = renderedMappings.join(", ");
  const settings: string[] = [];
  if (state.opacity && Number(state.opacity) !== 0.9) settings.push(`opacity => ${state.opacity}`);
  if (state.position && state.position !== "identity") settings.push(`position => ${quoteLiteral(state.position)}`);
  if (state.fixedColour) settings.push(`color => ${quoteLiteral(state.fixedColour)}`);
  if (state.fixedFill) settings.push(`fill => ${quoteLiteral(state.fixedFill)}`);
  if (state.fixedSize) settings.push(`size => ${state.fixedSize}`);
  if (state.fixedLinewidth) settings.push(`linewidth => ${state.fixedLinewidth}`);
  if (state.fixedLinetype) settings.push(`linetype => ${quoteLiteral(state.fixedLinetype)}`);
  if (state.aggregate) settings.push(`aggregate => ${state.aggregate}`);
  if (state.mark === "smooth") {
    if (state.smoothMethod) settings.push(`method => ${quoteLiteral(state.smoothMethod)}`);
    if (state.smoothAdjust) settings.push(`adjust => ${state.smoothAdjust}`);
    if (state.smoothBandwidth) settings.push(`bandwidth => ${state.smoothBandwidth}`);
    if (state.smoothKernel) settings.push(`kernel => ${quoteLiteral(state.smoothKernel)}`);
  }
  return `DRAW ${state.mark}${mapping ? `\n  MAPPING ${mapping}` : ""}${settings.length ? `\n  SETTING ${settings.join(", ")}` : ""}`;
}

function updateScale(visual: string, aesthetic: "x" | "y" | "colour", type: string, transform: string, format: string, palette = "") {
  const alias = aesthetic === "colour" ? "colou?r" : aesthetic;
  const block = visualBlocks(visual).find((candidate) => new RegExp(`^SCALE\\s+(?:(?:continuous|discrete|binned|ordinal|identity)\\s+)?${alias}\\b`, "i").test(candidate.text));
  if (!type && !transform && !format && !palette) return replaceBlock(visual, block, "");
  const renaming = format ? `\n  RENAMING * => ${quoteLiteral(`{:time ${format}}`)}` : "";
  const rendered = `SCALE${type ? ` ${type.toLocaleUpperCase()}` : ""} ${aesthetic}${palette ? ` TO ${palette}` : ""}${transform ? ` VIA ${transform}` : ""}${renaming}`;
  return replaceBlock(visual, block, rendered);
}

export function updateFirstVisual(query: string, next: Partial<VisualPointState>) {
  const visualise = findVisualiseOffset(query);
  if (visualise < 0) return query;
  const current = { ...visualPointState(query), ...next };
  const prefix = query.slice(0, visualise);
  let visual = query.slice(visualise).trimEnd();

  if (hasAny(next, drawKeys)) {
    visual = replaceBlock(visual, firstBlock(visual, /^DRAW\b/i), renderDraw(current));
  }
  if (hasAny(next, ["scaleXType", "scaleXTransform", "scaleXFormat"])) {
    visual = updateScale(visual, "x", current.scaleXType, current.scaleXTransform, current.scaleXFormat);
  }
  if (hasAny(next, ["scaleYType", "scaleYTransform", "scaleYFormat"])) {
    visual = updateScale(visual, "y", current.scaleYType, current.scaleYTransform, current.scaleYFormat);
  }
  if (hasAny(next, ["scaleColorType", "scaleColorPalette"])) {
    visual = updateScale(visual, "colour", current.scaleColorType, "", "", current.scaleColorPalette);
  }
  if (hasAny(next, ["facet", "facetBy", "facetFree", "facetColumns"])) {
    const settings: string[] = [];
    if (current.facetFree) settings.push(`free => ${quoteLiteral(current.facetFree)}`);
    if (current.facetColumns && !current.facetBy) settings.push(`ncol => ${current.facetColumns}`);
    const rendered = current.facet
      ? `FACET ${quoteIdentifier(current.facet)}${current.facetBy ? ` BY ${quoteIdentifier(current.facetBy)}` : ""}${settings.length ? `\n  SETTING ${settings.join(", ")}` : ""}`
      : "";
    visual = replaceBlock(visual, firstBlock(visual, /^FACET\b/i), rendered);
  }
  if (hasAny(next, ["project", "projectTarget"])) {
    const rendered = current.project
      ? `PROJECT TO ${current.project}${current.project === "crs" && current.projectTarget ? `\n  SETTING target => ${quoteLiteral(current.projectTarget)}` : ""}`
      : "";
    visual = replaceBlock(visual, firstBlock(visual, /^PROJECT\b/i), rendered);
  }
  if (hasAny(next, labelKeys)) {
    const existing = labelState(visual);
    const values: Array<[string, string]> = [
      ["title", current.title], ["subtitle", current.subtitle], ["x", current.labelX], ["y", current.labelY],
      ["colour", current.labelColor], ["fill", current.labelFill], ["size", current.labelSize], ["shape", current.labelShape],
      ["linetype", current.labelLinetype], ["linewidth", current.labelLinewidth], ["opacity", current.labelOpacity],
    ];
    const managed = new Set(values.flatMap(([key]) => key === "colour" ? ["colour", "color"] : [key]));
    const labels = [
      ...values.filter(([, value]) => value).map(([key, value]) => `${key} => ${quoteLiteral(value)}`),
      ...[...existing].filter(([key]) => !managed.has(key)).map(([key, value]) => `${key} => ${quoteLiteral(value)}`),
    ];
    visual = replaceBlock(visual, firstBlock(visual, /^LABEL\b/i), labels.length ? `LABEL ${labels.join(", ")}` : "", false);
  }
  return `${prefix}${visual}`;
}

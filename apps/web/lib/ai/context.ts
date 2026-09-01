import type { AiWorkspaceDataResult, FieldMetadata } from "@chartize/contracts";

export interface AiCatalogSource {
  id: string;
  title: string;
  description: string;
  fields: FieldMetadata[];
}

interface CompactContextOptions {
  sources: AiCatalogSource[];
  activeSource?: string;
  currentQuery: string;
  renderedQuery?: string;
  request: string;
  contextNote: string;
  view?: { title: string; subtitle: string };
}

const STOP_WORDS = new Set([
  "about", "after", "again", "also", "because", "before", "between", "build", "chart", "could",
  "data", "from", "have", "into", "make", "over", "show", "that", "their", "this", "using", "what",
  "when", "where", "which", "with", "would", "visualization", "visualize",
]);

function terms(value: string) {
  return [...new Set(value.toLocaleLowerCase().match(/[a-z0-9_]{3,}/g) ?? [])]
    .filter((term) => !STOP_WORDS.has(term));
}

function includesTerm(value: string, candidates: string[]) {
  const normalized = value.toLocaleLowerCase();
  return candidates.reduce((score, term) => score + (normalized.includes(term) ? 1 : 0), 0);
}

function selectedFields(source: AiCatalogSource, query: string, searchTerms: string[], active: boolean) {
  return source.fields
    .map((field, index) => {
      const referenced = new RegExp(`(?:"${field.name.replaceAll('"', '""')}"|\\b${field.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b)`, "i").test(query);
      const semantic = field.semanticType === "geometry" || field.semanticType === "geography" || field.semanticType === "temporal" || field.semanticType === "identifier";
      const relevance = includesTerm(`${field.name} ${field.description ?? ""} ${field.semanticType ?? ""}`, searchTerms);
      return { field, index, score: (referenced ? 100 : 0) + (semantic ? 10 : 0) + relevance * 12 };
    })
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .slice(0, active ? 40 : 28)
    .map(({ field }) => ({
      name: field.name,
      dataType: field.dataType,
      semanticType: field.semanticType,
      description: field.description,
    }));
}

export function compactAiContext(options: CompactContextOptions) {
  const requestTerms = terms(options.request);
  const searchTerms = terms([
    options.request,
    options.contextNote,
    options.view?.title,
    options.view?.subtitle,
    options.currentQuery,
    options.renderedQuery,
  ].filter(Boolean).join(" "));
  const ranked = options.sources
    .map((source, index) => {
      const active = source.id === options.activeSource
        || options.currentQuery.includes(source.id)
        || Boolean(options.renderedQuery?.includes(source.id));
      const requestRelevance = includesTerm(`${source.id} ${source.title} ${source.description}`, requestTerms);
      const ambientRelevance = includesTerm(`${source.id} ${source.title} ${source.description}`, searchTerms);
      return { source, index, active, requestRelevance, score: (active ? 1_000 : 0) + requestRelevance * 40 + ambientRelevance * 4 };
    })
    .sort((left, right) => right.score - left.score || left.index - right.index);
  const active = ranked.filter((candidate) => candidate.active);
  const needsAnotherSource = !options.currentQuery.trim()
    || /\b(?:another|combine|compare|cross[- ]?reference|different source|join|merge|other dataset|switch source)\b/i.test(options.request)
    || /\b(?:chartize|user):[a-z0-9_-]+\b/i.test(options.request);
  const requested = ranked.filter((candidate) => !candidate.active && candidate.requestRelevance > 0);
  const relevant = options.currentQuery.trim()
    ? [...active, ...(needsAnotherSource ? requested.slice(0, 3) : [])]
    : (requested.length ? requested.slice(0, 4) : ranked.slice(0, 1));

  return {
    sourceIndex: ranked.slice(0, 40).map(({ source }) => ({
      id: source.id,
      title: source.title,
      description: source.description.slice(0, 220),
    })),
    omittedSourceCount: Math.max(0, options.sources.length - 40),
    sourceSchemas: relevant.map(({ source, active: isActive }) => ({
      source: source.id,
      fields: selectedFields(
        source,
        [options.currentQuery, options.renderedQuery].filter(Boolean).join("\n"),
        searchTerms,
        isActive,
      ),
    })),
  };
}

export function requestedResearchItemCount(request: string) {
  const words: Record<string, number> = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
  };
  const match = request.match(/\b(one|two|three|four|five|six|[1-6])\b(?=[\s\S]{0,120}?\b(?:events?|examples?|findings?|reasons?|sources?)\b)/i);
  if (!match) return 1;
  return Math.min(6, Math.max(1, words[match[1]!.toLocaleLowerCase()] ?? Number(match[1])));
}

export function isExplanationRequest(request: string) {
  const mutation = /\b(add|build|change|colour|color|create|draw|filter|fix|join|make|map|overlay|plot|remove|rename|repair|set|switch|update|visuali[sz]e)\b/i.test(request)
    || /\bshow\b[\s\S]{0,100}\b(?:as (?:a |an )?|bar|chart|graph|line|map|plot|series|visuali[sz]ation)\b/i.test(request);
  const explanation = /\b(analy[sz]e|assess|calculate|cause|caused|check|compute|evaluate|evidence|explain|happen|happened|how|interpret|mean|meaning|summari[sz]e|tell me|what|why)\b/i.test(request);
  return explanation && !mutation;
}

export function isComplexVisualizationRequest(request: string, currentQuery: string, task: "generate" | "repair" | "explain") {
  if (task === "repair") return true;
  if (task === "explain") return false;
  const complexIntent = /\b(aggregate|choropleth|confidence|county|counties|forecast|hypothetical|join|layer|map|model|predict|regression|ribbon|scenario|spatial|state boundaries|trend)\b/i.test(request);
  const multiStage = /\b(WITH|JOIN)\b/i.test(currentQuery);
  return complexIntent && (!currentQuery.trim() || multiStage || /\b(join|aggregate|county|counties|state boundaries)\b/i.test(request));
}

export function compactHistory(
  history: Array<{
    role: "user" | "assistant";
    text: string;
    context?: { kind: "code" | "chart" | "data" | "general"; note: string } | undefined;
  }>,
  maximum = 12,
) {
  return history
    .filter((message, index) => index === 0 || message.role !== history[index - 1]!.role || message.text.trim() !== history[index - 1]!.text.trim())
    .slice(-maximum)
    .map((message) => message.role === "user" && message.context
      ? {
          ...message,
          text: `Workspace context when this earlier message was sent (${message.context.kind}): ${message.context.note}\nEarlier user message: ${message.text}`,
        }
      : message);
}

/** Keep browser-query evidence useful without letting a wide result dominate a turn. */
export function compactWorkspaceData(results: AiWorkspaceDataResult[], maximumCharacters = 80_000) {
  const output: Array<Record<string, unknown>> = [];
  let used = 2;
  for (const result of results) {
    const columns = result.columns.slice(0, 40);
    const item = {
      sql: result.sql.slice(0, 4000),
      purpose: result.purpose,
      columns,
      rows: [] as string[][],
      returnedRows: result.returnedRows,
      truncated: result.truncated || result.columns.length > columns.length,
      ...(result.error ? { error: result.error } : {}),
    };
    let itemCharacters = JSON.stringify(item).length;
    if (used + itemCharacters > maximumCharacters && output.length) break;
    for (const row of result.rows) {
      const compactRow = row.slice(0, columns.length).map((value) => value.slice(0, 500));
      const rowCharacters = JSON.stringify(compactRow).length + 1;
      if (used + itemCharacters + rowCharacters > maximumCharacters) {
        item.truncated = true;
        break;
      }
      item.rows.push(compactRow);
      itemCharacters += rowCharacters;
    }
    if (item.rows.length < result.rows.length) item.truncated = true;
    output.push(item);
    used += itemCharacters + 1;
  }
  return output;
}

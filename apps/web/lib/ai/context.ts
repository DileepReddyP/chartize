import type { FieldMetadata } from "@chartize/contracts";

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
  ].filter(Boolean).join(" "));
  const ranked = options.sources
    .map((source, index) => {
      const active = source.id === options.activeSource || options.currentQuery.includes(source.id);
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
    sourceIndex: options.sources.map(({ id, title, description }) => ({
      id,
      title,
      description: description.slice(0, 360),
    })),
    sourceSchemas: relevant.map(({ source, active: isActive }) => ({
      source: source.id,
      fields: selectedFields(source, options.currentQuery, searchTerms, isActive),
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
  const mutation = /\b(add|build|change|colour|color|create|draw|filter|fix|join|make|map|overlay|plot|remove|rename|repair|set|show|switch|update|visuali[sz]e)\b/i.test(request);
  const explanation = /\b(analy[sz]e|assess|cause|caused|check|evaluate|evidence|explain|happen|happened|how|interpret|mean|meaning|summari[sz]e|tell me|what|why)\b/i.test(request);
  return explanation && !mutation;
}

export function shouldResearch(request: string, webSearch: boolean) {
  if (!webSearch) return false;
  return /\b(cause|caused|crossover|current|drop|dropped|fall|fell|happen|happened|historical|latest|news|recent|rise|rose|search|slump|sources?|surge|today|web|why)\b/i.test(request);
}

export function isComplexVisualizationRequest(request: string, currentQuery: string, task: "generate" | "repair" | "explain") {
  if (task === "repair") return true;
  if (task === "explain") return false;
  const complexIntent = /\b(aggregate|choropleth|confidence|county|counties|forecast|hypothetical|join|layer|map|model|predict|regression|ribbon|scenario|spatial|state boundaries|trend)\b/i.test(request);
  const multiStage = /\b(WITH|JOIN)\b/i.test(currentQuery);
  return complexIntent && (!currentQuery.trim() || multiStage || /\b(join|aggregate|county|counties|state boundaries)\b/i.test(request));
}

export function compactHistory(history: Array<{ role: "user" | "assistant"; text: string }>, maximum = 12) {
  return history
    .filter((message, index) => index === 0 || message.role !== history[index - 1]!.role || message.text.trim() !== history[index - 1]!.text.trim())
    .slice(-maximum);
}

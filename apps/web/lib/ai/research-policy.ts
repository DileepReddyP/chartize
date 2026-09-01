export type ResearchMode = "disabled" | "available" | "required";

export interface ResearchDecision {
  mode: ResearchMode;
  reason: "toggle_off" | "already_researched" | "explicit_request" | "conversation_followup" | "freshness" | "outside_explanation" | "optional";
}

const EXPLICIT_RESEARCH = /\b(?:browse(?: the)? web|internet search|live sources?|look (?:it|this|that) up|online sources?|research (?:this|that|it|the)|search (?:the )?(?:web|internet|news)|web search)\b|\b(?:cite|citation|citations|source-grounded|with sources)\b/i;
const SEARCH_COMMAND = /^\s*(?:please\s+)?(?:look up|research|search)\b/i;
const LOCAL_SEARCH_TARGET = /\b(?:available sources?|catalog|columns?|dataset|fields?|local data|rows?|schema|table|workspace)\b/i;
const FRESH_INFORMATION = /\b(?:as of (?:now|today)|breaking|current events?|currently|latest|live|news|recent(?:ly)?|this (?:week|month|year)|today|tonight|up[- ]to[- ]date|yesterday)\b/i;
const OUTSIDE_EXPLANATION = /\b(?:account(?:ed|s|ing)? for|cause[ds]?|contextuali[sz]e|drove|driven by|events? (?:around|behind|during)|historical context|reasons? (?:for|behind)|what happened|why)\b|\b(?:could|might|may)\b[\s\S]{0,80}\bexplain\b|\bexplain\b[\s\S]{0,80}\b(?:change|crossover|decline|drop|fall|increase|jump|movement|rise|shift|spike|surge|trend)\b/i;
const WORKSPACE_DIAGNOSTIC = /\b(?:browser error|code error|diagnostic|ggsql|query error|render(?:ing)? error|sql error|syntax error|type error)\b/i;
const AFFIRMATIVE_FOLLOWUP = /^\s*(?:(?:yes|yeah|yep|sure|okay|ok)(?:[,!.\s]+(?:please\s+)?)?|please\s+)(?:do (?:it|that|so)|go ahead|search|look|research|use sources?|check online)?[.!\s]*$/i;
const ANAPHORIC_FOLLOWUP = /^\s*(?:and|also|how about|same (?:for|question)|what about)\b/i;
const RESEARCH_OFFER = /\b(?:i can|i could|i will|i’ll|let me|shall i|want me to|would you like me to)\b[\s\S]{0,100}\b(?:browse|check (?:live|online)|look (?:it|that|this) up|research|search|use (?:live )?sources)\b/i;

type ResearchHistoryMessage = { role: "user" | "assistant"; text: string };

function followsResearchContext(request: string, history: ResearchHistoryMessage[]) {
  const priorAssistant = [...history].reverse().find((message) => message.role === "assistant")?.text ?? "";
  if (AFFIRMATIVE_FOLLOWUP.test(request) && RESEARCH_OFFER.test(priorAssistant)) return true;
  if (!ANAPHORIC_FOLLOWUP.test(request)) return false;
  const priorUser = [...history].reverse().find((message) => message.role === "user")?.text ?? "";
  return EXPLICIT_RESEARCH.test(priorUser)
    || FRESH_INFORMATION.test(priorUser)
    || (OUTSIDE_EXPLANATION.test(priorUser) && !WORKSPACE_DIAGNOSTIC.test(priorUser));
}

/**
 * Make the product's search promise deterministic. The toggle grants access;
 * explicit, fresh, and outside-causal questions require a search. Ordinary
 * workspace calculations and drawing work leave search available to the model
 * without paying for a lookup that cannot improve the answer.
 */
export function decideResearch(
  request: string,
  options: { webSearch: boolean; alreadyResearched?: boolean; history?: ResearchHistoryMessage[] },
): ResearchDecision {
  if (options.alreadyResearched) return { mode: "disabled", reason: "already_researched" };
  if (!options.webSearch) return { mode: "disabled", reason: "toggle_off" };
  if (EXPLICIT_RESEARCH.test(request) || (SEARCH_COMMAND.test(request) && !LOCAL_SEARCH_TARGET.test(request))) {
    return { mode: "required", reason: "explicit_request" };
  }
  if (followsResearchContext(request, options.history ?? [])) {
    return { mode: "required", reason: "conversation_followup" };
  }
  if (FRESH_INFORMATION.test(request)) return { mode: "required", reason: "freshness" };
  if (OUTSIDE_EXPLANATION.test(request) && !WORKSPACE_DIAGNOSTIC.test(request)) {
    return { mode: "required", reason: "outside_explanation" };
  }
  return { mode: "available", reason: "optional" };
}

export function researchTurnInstruction(decision: ResearchDecision, target: number) {
  if (decision.reason === "already_researched") {
    return "LIVE RESEARCH: The evidence memo attached to this turn is the completed research pass. Do not search again. Preserve its citations and combine it with any needed workspace values.";
  }
  if (decision.mode === "disabled") {
    return "LIVE RESEARCH: Disabled for this turn. Do not claim or imply that a web lookup occurred.";
  }
  if (decision.mode === "required") {
    return `LIVE RESEARCH: Required before answering. Run one focused evidence pass, gather at least ${target} relevant dated finding${target === 1 ? "" : "s"}, and cite a direct source for each distinct outside claim. Stop searching when the core question is supported.`;
  }
  return "LIVE RESEARCH: Available, not automatic. Search only if the answer needs external or time-sensitive facts absent from the workspace. Prefer a browser-data request for exact local values, and do not search for GGSQL syntax, chart styling, arithmetic, or local-data cleanup.";
}

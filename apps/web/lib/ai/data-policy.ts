import type { AiConversationMessage } from "@chartize/contracts";

export type BrowserDataDecision =
  | { mode: "disabled" | "available"; reason: "disabled" | "already_grounded" | "not_needed" }
  | { mode: "required"; reason: "exact_value" | "explicit_browser_request" | "conversation_followup" };

const EXACT_VALUE_REQUEST = /\b(?:exact(?:ly)?|calculate|compute|how\s+many|top\s+\d+|bottom\s+\d+|highest|lowest)\b|\bwhat\s+(?:is|are)\s+(?:the\s+)?(?:average|mean|median|sum|total|count|minimum|maximum)\b|\b(?:average|mean|median|sum|total|count|minimum|maximum)\s+(?:of|for|by)\b/i;
const DATA_NOUN = /\b(?:browser|workspace|table|dataset|rows?|data)\b/i;
const INSPECTION_VERB = /\b(?:query|run|check|inspect|calculate|compute)\b/i;
const VISUALIZATION_REQUEST = /\b(?:draw|plot|visuali[sz]e)\b|\b(?:chart|graph|map|plot|visuali[sz]ation)\b|\bshow\b[^.!?\n]{0,100}\b(?:as\s+(?:a|an)|bar|chart|graph|line|map|plot|series)\b/i;
const SHORT_FOLLOWUP = /^(?:(?:yes|yeah|yep|sure|okay|ok)(?:,\s*(?:please|do\s+that|go\s+ahead|check\s+it|run\s+it))?|please|do\s+that|go\s+ahead|check\s+it|run\s+it)[\s.!?]*$/i;
const DATA_OFFER = /\b(?:I\s+can|let\s+me|shall\s+I|want\s+me\s+to|would\s+you\s+like\s+me\s+to)\b[^.!?\n]{0,140}\b(?:query|run|check|inspect|calculate|compute)\b[^.!?\n]{0,100}\b(?:workspace|table|dataset|rows?|data)\b/i;

export function decideBrowserData(
  request: string,
  options: {
    enabled: boolean;
    task: "generate" | "repair" | "explain";
    hasQueryableSources: boolean;
    hasWorkspaceData: boolean;
    hasSharedRows: boolean;
    history?: AiConversationMessage[];
  },
): BrowserDataDecision {
  if (!options.enabled || !options.hasQueryableSources || options.task === "repair") {
    return { mode: "disabled", reason: "disabled" };
  }
  if (options.hasWorkspaceData || options.hasSharedRows) {
    return { mode: "available", reason: "already_grounded" };
  }

  const compact = request.replaceAll(/\s+/g, " ").trim();
  const lastAssistant = [...(options.history ?? [])].reverse().find((message) => message.role === "assistant")?.text ?? "";
  if (SHORT_FOLLOWUP.test(compact) && DATA_OFFER.test(lastAssistant)) {
    return { mode: "required", reason: "conversation_followup" };
  }
  if (DATA_NOUN.test(compact) && INSPECTION_VERB.test(compact)) {
    return { mode: "required", reason: "explicit_browser_request" };
  }
  // A chart request can express top-N, extrema, or aggregates directly in SQL;
  // preflighting those values would add a model round without improving the
  // executable visualization the user asked for.
  if (VISUALIZATION_REQUEST.test(compact)) {
    return { mode: "available", reason: "not_needed" };
  }
  if (EXACT_VALUE_REQUEST.test(compact)) {
    return { mode: "required", reason: "exact_value" };
  }
  return { mode: "available", reason: "not_needed" };
}

export function browserDataTurnInstruction(decision: BrowserDataDecision) {
  if (decision.mode === "required") {
    return "BROWSER DATA: REQUIRED. Exact local evidence is missing. Return request_data now with the smallest bounded read-only SQL query; do not answer, estimate, apologize, or claim browser access is unavailable.";
  }
  if (decision.mode === "available") {
    return "BROWSER DATA: AVAILABLE. Use attached browser results when present; otherwise request a bounded query only if exact local evidence is materially necessary.";
  }
  return "BROWSER DATA: DISABLED OR INAPPLICABLE. Do not request a browser query for this turn.";
}

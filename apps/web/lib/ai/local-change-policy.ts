import type { AiTurnEnvelope } from "@chartize/contracts";

type LocalChangeTurn = Pick<AiTurnEnvelope, "task" | "request" | "history" | "preferences">;

const MUTATION_DENIAL = /\b(?:do\s+not|don't|without|no)\b[^.\n]{0,50}\b(?:mutat|persist|modify|overwrite|change)\w*/i;
const FOLLOW_UP_APPROVAL = /^(?:ok(?:ay)?|yes|do it|apply it|go ahead|proceed|finish (?:it|that)|continue)\b/i;

function explicitlyRequestsLocalChange(text: string) {
  if (MUTATION_DENIAL.test(text)) return false;
  return (
    /\b(?:clean|deduplicate|dedupe|impute|persist|save)\w*\s+(?:this|the|my|that|these|those|a|an)?\s*(?:file|data|dataset|table|values|rows|copy|source)\b/i.test(text)
    || /\b(?:apply|execute|perform|commit|make|do)\b[^.\n]{0,80}\b(?:clean(?:ing|up)?|deduplicat\w*|imput\w*|mutation|local changes?)\b/i.test(text)
    || /\b(?:create|save|persist)\b[^.\n]{0,80}\b(?:cleaned|derived|local|temporary|temp)\b/i.test(text)
  );
}

/** Repair rounds may fix GGSQL, but never receive fresh write authority. */
export function authorizesLocalChange(turn: LocalChangeTurn) {
  if (turn.task === "repair") return false;
  if (turn.preferences.allowLocalChanges || explicitlyRequestsLocalChange(turn.request)) return true;
  if (!FOLLOW_UP_APPROVAL.test(turn.request.trim())) return false;
  return turn.history.slice(-6).some((message) => (
    message.role === "user" && explicitlyRequestsLocalChange(message.text)
  ));
}

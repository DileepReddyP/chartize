import type { ResponseInput, ToolChoiceAllowed } from "openai/resources/responses/responses";

export function createInitialResponseInput(options: {
  stableInstructions: string;
  turnInstructions: string;
  input: string | ResponseInput;
  continuationInput?: ResponseInput;
  explicitPromptCache: boolean;
}): ResponseInput {
  const stableMessage = options.explicitPromptCache
    ? {
        role: "developer" as const,
        content: [{
          type: "input_text" as const,
          text: options.stableInstructions,
          prompt_cache_breakpoint: { mode: "explicit" as const },
        }],
      }
    : { role: "developer" as const, content: options.stableInstructions };
  const turnInput: ResponseInput = typeof options.input === "string"
    ? [{ role: "user", content: options.input }]
    : [...options.input];
  return [
    stableMessage,
    { role: "developer", content: options.turnInstructions },
    ...turnInput,
    ...(options.continuationInput ?? []),
  ];
}

export function toolChoiceForRound(options: {
  functionNames: string[];
  allowFunctionTools: boolean;
  allowWebSearch: boolean;
  requireWebSearch: boolean;
}): "none" | ToolChoiceAllowed {
  if (options.requireWebSearch && options.allowWebSearch) {
    return {
      type: "allowed_tools",
      mode: "required",
      tools: [{ type: "web_search" }],
    };
  }
  const allowed = [
    ...(options.allowFunctionTools
      ? options.functionNames.map((name) => ({ type: "function", name }))
      : []),
    ...(options.allowWebSearch ? [{ type: "web_search" }] : []),
  ];
  if (!allowed.length) return "none";
  return { type: "allowed_tools", mode: "auto", tools: allowed };
}

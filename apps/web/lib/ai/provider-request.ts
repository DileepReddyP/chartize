import type { ResponseInput } from "openai/resources/responses/responses";

export function createInitialResponseInput(options: {
  stableInstructions: string;
  turnInstructions: string;
  input: string | ResponseInput;
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
  ];
}

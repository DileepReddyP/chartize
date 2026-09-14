import { AiThinkingLevelSchema } from "@chartize/contracts";
import { z } from "zod";
import type { ResponsePolicy, StructuredFunctionTool } from "./provider";
import type { TurnState } from "./turn-state";
import { createWikipediaTools } from "./wikipedia";
import { createVisualizationFunctionTools } from "./workspace-tools";
import { toolProgress } from "./progress";

const SourceSchema = z.object({ source: z.string().min(1).max(300) });
const ThinkingSchema = z.object({ level: z.enum(["high", "xhigh", "max"]), reason: z.string().min(1).max(300) });
const WebResearchSchema = z.object({
  need: z.enum(["time_sensitive", "primary_document_requested", "wikipedia_gap"]),
  question: z.string().min(1).max(500),
});

/** Read-only references and an optional reasoning increase, chosen by the answering model. */
export function createTurnTools(state: TurnState, onProgress?: (message: string) => void, signal?: AbortSignal): StructuredFunctionTool[] {
  return [
    ...createVisualizationFunctionTools(onProgress),
    ...createWikipediaTools((source) => { state.sources.set(source.url, source); state.articles.add(source.url); }, onProgress, signal).map((tool) => ({
      ...tool,
      execute: async (args: unknown) => {
        if (state.wikiCalls >= 6) throw new Error("Wikipedia's per-turn limit is reached. Finish from the evidence already gathered.");
        state.wikiCalls++;
        return tool.execute(args);
      },
    })),
    {
      name: "source_schema",
      description: "Read complete field metadata for a listed workspace source when the compact snapshot omitted needed fields.",
      parameters: z.toJSONSchema(SourceSchema),
      execute: async (args) => {
        const { source } = SourceSchema.parse(args);
        onProgress?.(toolProgress("checking source fields", source));
        const found = state.body.availableSources.find((candidate) => candidate.id === source);
        if (!found) throw new Error("That source is not in this workspace.");
        return found;
      },
    },
    {
      name: "enable_web_search",
      description: "Enable paid web search for a time-sensitive question, a requested primary document, or a specific gap after Wikipedia research. State the public question that needs it. Background lookups and generic verification use Wikipedia. This is your tool decision, not a user approval request.",
      parameters: z.toJSONSchema(WebResearchSchema),
      execute: async (args) => {
        const { need, question } = WebResearchSchema.parse(args);
        if (state.webUsed || state.body.task === "repair") throw new Error("Web search is unavailable for the rest of this turn.");
        if (need === "wikipedia_gap" && !state.wikiCalls) throw new Error("Try Wikipedia for this background question first.");
        state.webEnabled = true;
        onProgress?.(toolProgress("preparing web research", question));
        return { available: "web_search", question, budget: "One web-enabled response; focus the search on this question." };
      },
    },
    {
      name: "increase_thinking",
      description: "Increase reasoning effort from the automatic medium default for the rest of this turn: high for complex SQL/maps/debugging, xhigh/max for unusually difficult work. Available once in automatic mode. Independent reference lookups can accompany this call.",
      parameters: z.toJSONSchema(ThinkingSchema),
      execute: async (args) => {
        const { level } = ThinkingSchema.parse(args);
        if (state.body.preferences.thinking !== "auto" || state.thinkingBumps) throw new Error("The thinking level is fixed for this turn.");
        if (AiThinkingLevelSchema.options.indexOf(level) <= AiThinkingLevelSchema.options.indexOf(state.activity.thinking)) {
          throw new Error("Choose a higher thinking level if this task needs it.");
        }
        state.thinkingBumps++;
        state.activity.thinking = level;
        onProgress?.(`thinking · ${level}…`);
        return { thinking: level };
      },
    },
  ];
}

/** Tool availability reflects remaining budgets and the user's manual thinking choice. */
export function turnPolicy(state: TurnState): ResponsePolicy {
  const repair = state.body.task === "repair";
  return {
    thinking: state.activity.thinking,
    functions: [
      "get_visualization_tips", "source_schema",
      ...(!repair && state.wikiCalls < 6 ? ["wikipedia_search", "wikipedia_article"] : []),
      ...(!repair && !state.webUsed && !state.webEnabled ? ["enable_web_search"] : []),
      ...(state.body.preferences.thinking === "auto" && !state.thinkingBumps ? ["increase_thinking"] : []),
    ],
    webSearch: !repair && state.webEnabled && !state.webUsed,
  };
}

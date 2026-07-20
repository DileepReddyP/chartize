import { z } from "zod";
import type { StructuredFunctionTool } from "./provider";
import {
  VISUALIZATION_TIP_TOPICS,
  VisualizationTipsArgumentsSchema,
  visualizationTipsFor,
} from "./visualization-tips";

export function createVisualizationFunctionTools(): StructuredFunctionTool[] {
  return [{
    name: "get_visualization_tips",
    description: "Retrieve Chartize's local digest of the official GGSQL 0.4.1 documentation and its executable cookbook for the requested drawing or browser-local data technique. The response includes the canonical https://ggsql.org/llms.txt reference; do not web-search GGSQL syntax. Call this before writing or repairing local-data cleanup/mutations, text labels, endpoint labels, event annotations, dense or layered charts, maps, uncertainty, facets, scales, or statistical layers.",
    parameters: {
      type: "object",
      properties: {
        topics: {
          type: "array",
          items: { type: "string", enum: [...VISUALIZATION_TIP_TOPICS] },
          minItems: 1,
          maxItems: 4,
          description: "One to four techniques relevant to the requested visualization edit.",
        },
      },
      required: ["topics"],
      additionalProperties: false,
    },
    execute: async (argumentsValue) => {
      const { topics } = VisualizationTipsArgumentsSchema.parse(argumentsValue);
      return visualizationTipsFor(topics);
    },
  }];
}

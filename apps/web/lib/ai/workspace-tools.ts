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
    description: "Retrieve Chartize's compact GGSQL 0.4.1 cookbook for the drawing or browser-local data technique needed in this turn. Call this before writing or repairing local-data cleanup/mutations, text labels, endpoint labels, event annotations, dense or layered charts, maps, uncertainty, facets, scales, or statistical layers. The returned rules include engine compatibility, row-cardinality invariants, and executable patterns that are intentionally not all repeated in the base prompt.",
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

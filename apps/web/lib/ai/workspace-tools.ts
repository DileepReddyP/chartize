import type { StructuredFunctionTool } from "./provider";
import { toolProgress } from "./progress";
import {
  VISUALIZATION_TIP_TOPICS,
  VisualizationTipsArgumentsSchema,
  visualizationTipsFor,
} from "./visualization-tips";

export function createVisualizationFunctionTools(onProgress?: (message: string) => void): StructuredFunctionTool[] {
  return [{
    name: "get_visualization_tips",
    description: "Retrieve Chartize's local digest of the official GGSQL 0.4.1 documentation and its executable cookbook for the requested drawing or browser-local data technique. The response includes the canonical https://ggsql.org/llms.txt reference; do not web-search GGSQL syntax. Call this before writing or repairing local-data cleanup, text labels, endpoint labels, event annotations, dense or layered charts, maps, uncertainty, facets, scales, or statistical layers. For a title-only edit or a simple read-only data query, reuse the existing syntax without a lookup. The cleanup topic defaults to non-mutating CTEs and permits persistent local mutation only when the user explicitly asks for it.",
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
      onProgress?.(toolProgress("checking GGSQL reference", topics.join(", ")));
      return visualizationTipsFor(topics);
    },
  }];
}

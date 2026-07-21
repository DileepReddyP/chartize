import { visualPointState } from "../ggsql/query-context";
import { makeDefaultDraft } from "../ggsql/serialize";
import type { VisualizationExample } from "../ggsql/examples";
import type { NewWorkspaceInput } from "./store";

export function workspaceInputForExample(example: VisualizationExample): NewWorkspaceInput {
  const point = visualPointState(example.query);
  const draft = makeDefaultDraft(example.source);
  draft.title = point.title || example.title;
  draft.subtitle = point.subtitle || example.description;
  return {
    title: draft.title,
    draft,
    query: example.query,
    dockSource: example.source,
  };
}

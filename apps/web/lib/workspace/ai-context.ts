import type { AiContext, AiContextReference, AiRuntimeError } from "@chartize/contracts";

interface ContextTable {
  columns: string[];
  rows: string[][];
}

interface GridContext extends ContextTable {
  summary: string;
}

interface ChartRangeContext {
  x?: [unknown, unknown] | undefined;
  y?: [unknown, unknown] | undefined;
  summary: string;
  data: ContextTable;
}

export interface ResolveAiWorkspaceContextOptions {
  context: AiContext;
  entryNote: string;
  viewNote: string;
  blank: boolean;
  isMap: boolean;
  gridSelection: GridContext | null;
  chartRange: ChartRangeContext | null;
  visualSelectionCount: number;
  visualSelectionData: ContextTable | null;
  fallbackData: ContextTable;
  dataPreview: ContextTable;
}

export interface ResolvedAiWorkspaceContext {
  context: AiContext;
  note: string;
  reference: AiContextReference;
  sample: ContextTable;
}

interface ChooseDwimAiContextOptions {
  blank: boolean;
  hasEditorContext: boolean;
  hasGridSelection: boolean;
  hasVisualSelection: boolean;
  focusArea: "code" | "chart" | "table";
}

/** Chooses the active selection, blank workspace, or focused pane as the AI subject. */
export function chooseDwimAiContext(options: ChooseDwimAiContextOptions): AiContext {
  if (options.hasEditorContext) return "code";
  if (options.hasGridSelection) return "data";
  if (options.hasVisualSelection) return "chart";
  if (options.blank) return "general";
  if (options.focusArea === "code") return "code";
  if (options.focusArea === "table") return "data";
  return "chart";
}

function boundedNote(value: string, maximum: number) {
  const compact = value.replaceAll(/\s+/g, " ").trim();
  if (compact.length <= maximum) return compact;
  return `${compact.slice(0, maximum - 1).trimEnd()}…`;
}

function activeSelectionSample(options: ResolveAiWorkspaceContextOptions) {
  if (options.gridSelection) return options.gridSelection;
  if (options.visualSelectionData?.rows.length) return options.visualSelectionData;
  if (options.chartRange?.data.rows.length) return options.chartRange.data;
  return null;
}

/** Resolves the current selection, rendered chart metadata, context note and row sample at send time. */
export function resolveAiWorkspaceContext(options: ResolveAiWorkspaceContextOptions): ResolvedAiWorkspaceContext {
  const attachment = "Selected row values stay in this browser until needed to answer your question.";
  let note: string;
  let sample: ContextTable;

  if (options.context === "data") {
    if (options.gridSelection) {
      note = `${options.viewNote} Data selection: ${options.gridSelection.summary}. Columns: ${options.gridSelection.columns.join(", ")}. ${attachment}`;
      sample = options.gridSelection;
    } else {
      note = `${options.viewNote} The active data table and source schema are the primary context.`;
      sample = options.dataPreview;
    }
  } else if (options.context === "chart") {
    if (options.chartRange) {
      const noun = options.isMap ? "map area" : "chart range";
      const count = options.visualSelectionCount
        ? ` It contains ${options.visualSelectionCount.toLocaleString()} rendered item${options.visualSelectionCount === 1 ? "" : "s"}.`
        : "";
      note = `${options.viewNote} Selected ${noun}: ${options.chartRange.summary}.${count} X range: ${JSON.stringify(options.chartRange.x)}. Y range: ${JSON.stringify(options.chartRange.y)}. ${attachment}`;
      sample = options.visualSelectionData?.rows.length ? options.visualSelectionData : options.chartRange.data;
    } else if (options.visualSelectionCount) {
      const noun = options.isMap ? "map feature" : "visual item";
      note = `${options.viewNote} ${options.visualSelectionCount.toLocaleString()} ${noun}${options.visualSelectionCount === 1 ? " is" : "s are"} selected as the active subject. ${attachment}`;
      sample = options.visualSelectionData ?? options.fallbackData;
    } else {
      note = `${options.viewNote} ${options.blank ? "The visualization canvas is blank; use the available source catalog to build the requested view." : "The rendered chart and the GGSQL that produced it are the primary context."}`;
      sample = options.fallbackData;
    }
  } else if (options.context === "code") {
    note = options.entryNote || `${options.viewNote} The current GGSQL editor is the primary context.`;
    sample = options.fallbackData;
  } else {
    const stickyUpload = /^New browser-local source/i.test(options.entryNote);
    const selected = activeSelectionSample(options);
    note = stickyUpload
      ? options.entryNote
      : options.blank
        ? `${options.viewNote} The visualization canvas is blank; use the available source catalog to build the requested view.`
        : `${options.viewNote} The current query, rendered view, and source catalog are attached.${selected ? ` A live selection is available. ${attachment}` : ""}`;
    sample = selected ?? options.fallbackData;
  }

  const displayNote = boundedNote(note, 4000);
  return {
    context: options.context,
    note: displayNote,
    reference: {
      kind: options.context,
      note: boundedNote(displayNote, 1600),
    },
    sample,
  };
}

export function aiQueryStatus(
  currentQuery: string,
  renderedQuery: string,
  runtimeErrors: AiRuntimeError[],
): "blank" | "rendered" | "edited" | "failed" {
  if (!currentQuery.trim()) return "blank";
  const failed = [...runtimeErrors].reverse().find((error) => error.stage === "query" && error.failedQuery === currentQuery);
  if (failed) return "failed";
  return currentQuery === renderedQuery ? "rendered" : "edited";
}

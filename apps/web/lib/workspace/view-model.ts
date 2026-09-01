"use client";

import type { FieldMetadata } from "@chartize/contracts";
import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import {
  selectedProjectionLabels,
  sourceFromQuery,
  sourcesFromQuery,
  splitGgsql,
  visualPointState,
  visualSelectionFields,
} from "../ggsql/query-context";
import {
  describeChartExtent,
  describeChartSelection,
  selectionTableFromSpec,
  tableFromVisualItemSelections,
  visualFieldsFromPreview,
} from "./chart-data";
import { useChartizeWorkspace } from "./store";

export interface WorkspaceSource {
  id: string;
  title: string;
  description: string;
  namespace: "chartize" | "user" | "ggsql";
  fields: FieldMetadata[];
  rows?: number;
  disabled?: boolean;
}

export function useWorkspaceViewModel() {
  const input = useChartizeWorkspace(useShallow((state) => ({
    query: state.query,
    resultQuery: state.resultQuery,
    draft: state.draft,
    spec: state.spec,
    selectedData: state.selectedData,
    chartSelection: state.chartSelection,
    mapFeatureSelections: state.mapFeatureSelections,
    catalogDatasets: state.catalogDatasets,
    localDatasets: state.localDatasets,
  })));

  return useMemo(() => {
    const activeSources = sourcesFromQuery(input.query);
    const renderedQuery = input.resultQuery;
    const renderedSources = sourcesFromQuery(renderedQuery);
    const isBlankWorkspace = !input.query.trim();
    const activeSource = activeSources[0] ?? (isBlankWorkspace ? "" : sourceFromQuery(input.query, input.draft.source));
    const sources: WorkspaceSource[] = [
      ...input.catalogDatasets.map((dataset) => ({
        id: `chartize:${dataset.slug}`,
        title: dataset.title,
        description: dataset.description,
        namespace: "chartize" as const,
        rows: dataset.rowCount,
        fields: dataset.fields,
      })),
      ...input.localDatasets.map((dataset) => ({
        id: dataset.tableName.startsWith("ggsql:") ? dataset.tableName : `user:${dataset.tableName}`,
        title: dataset.title,
        description: dataset.description,
        namespace: dataset.tableName.startsWith("ggsql:") ? "ggsql" as const : "user" as const,
        fields: dataset.fields,
      })),
    ];
    const activeSourceDetails = activeSources.flatMap((source) => {
      const match = sources.find((candidate) => candidate.id === source);
      return match ? [match] : [];
    });
    const renderedSourceDetails = renderedSources.flatMap((source) => {
      const match = sources.find((candidate) => candidate.id === source);
      return match ? [match] : [];
    });
    const fieldsByName = new Map<string, FieldMetadata>();
    activeSourceDetails.forEach((source) => source.fields.forEach((field) => {
      if (!fieldsByName.has(field.name)) fieldsByName.set(field.name, field);
    }));
    const activeFields = [...fieldsByName.values()];
    const renderedFieldsByName = new Map<string, FieldMetadata>();
    renderedSourceDetails.forEach((source) => source.fields.forEach((field) => {
      if (!renderedFieldsByName.has(field.name)) renderedFieldsByName.set(field.name, field);
    }));
    const renderedFields = [...renderedFieldsByName.values()];
    const selectedProjectionNames = selectedProjectionLabels(input.query);
    const selectedFieldNames = new Set(selectedProjectionNames);
    const visualFields = visualFieldsFromPreview(activeFields, input.selectedData, selectedProjectionNames);
    const visualState = visualPointState(input.query);
    const renderedVisualState = visualPointState(renderedQuery);
    const isMap = /\bDRAW\s+spatial\b/i.test(splitGgsql(renderedQuery).visual);
    const chartSelectionData = selectionTableFromSpec(input.spec) ?? input.selectedData;
    const selectionFields = visualSelectionFields(renderedQuery);
    const chartSelectionDetails = describeChartSelection(
      input.chartSelection,
      chartSelectionData,
      selectionFields.x,
      selectionFields.y,
      renderedFields,
      renderedVisualState.labelX,
      renderedVisualState.labelY,
    );
    const aiView = {
      title: renderedVisualState.title || input.draft.title,
      subtitle: renderedVisualState.subtitle || input.draft.subtitle,
      sources: renderedSourceDetails.map(({ id, title, description }) => ({ id, title, description })),
    };
    const titleNote = aiView.title ? `Chart: “${aiView.title}”.` : "Untitled chart.";
    const subtitleNote = aiView.subtitle ? ` Subtitle: “${aiView.subtitle}”.` : "";
    const sourceNote = aiView.sources.length
      ? ` Active ${aiView.sources.length === 1 ? "dataset" : "datasets"}: ${aiView.sources.map((source) => `${source.title} (${source.id})`).join(", ")}.`
      : "";
    const extent = describeChartExtent(
      chartSelectionData,
      selectionFields.x,
      selectionFields.y,
      renderedFields,
      renderedVisualState.labelX,
      renderedVisualState.labelY,
    );
    const aiViewNote = `${titleNote}${subtitleNote}${sourceNote}${extent ? ` ${extent}.` : ""}`;
    const mapSelectedData = tableFromVisualItemSelections(input.mapFeatureSelections);
    const activeMapFeature = input.mapFeatureSelections.at(-1) ?? null;

    return {
      ...input,
      activeSources,
      activeSource,
      renderedSources,
      renderedActiveSource: renderedSources[0] ?? "",
      sources,
      activeFields,
      renderedFields,
      selectedProjectionNames,
      selectedFieldNames,
      visualFields,
      visualState,
      renderedVisualState,
      chartLegendTitles: {
        colour: renderedVisualState.labelColor,
        fill: renderedVisualState.labelFill,
        size: renderedVisualState.labelSize,
        shape: renderedVisualState.labelShape,
        linetype: renderedVisualState.labelLinetype,
        linewidth: renderedVisualState.labelLinewidth,
        opacity: renderedVisualState.labelOpacity,
      },
      isBlankWorkspace,
      isMap,
      chartSelectionData,
      chartSelectionDetails,
      mapSelectedData,
      activeMapFeature,
      aiView,
      aiViewNote,
    };
  }, [input]);
}

export type WorkspaceViewModel = ReturnType<typeof useWorkspaceViewModel>;

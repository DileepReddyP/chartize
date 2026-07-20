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
    draft: state.draft,
    spec: state.spec,
    selectedData: state.selectedData,
    chartSelection: state.chartSelection,
    mapFeatureSelection: state.mapFeatureSelection,
    catalogDatasets: state.catalogDatasets,
    localDatasets: state.localDatasets,
  })));

  return useMemo(() => {
    const activeSources = sourcesFromQuery(input.query);
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
    const fieldsByName = new Map<string, FieldMetadata>();
    activeSourceDetails.forEach((source) => source.fields.forEach((field) => {
      if (!fieldsByName.has(field.name)) fieldsByName.set(field.name, field);
    }));
    const activeFields = [...fieldsByName.values()];
    const selectedProjectionNames = selectedProjectionLabels(input.query);
    const selectedFieldNames = new Set(selectedProjectionNames);
    const visualFields = visualFieldsFromPreview(activeFields, input.selectedData, selectedProjectionNames);
    const visualState = visualPointState(input.query);
    const chartSelectionData = selectionTableFromSpec(input.spec) ?? input.selectedData;
    const selectionFields = visualSelectionFields(input.query);
    const chartSelectionDetails = describeChartSelection(
      input.chartSelection,
      chartSelectionData,
      selectionFields.x,
      selectionFields.y,
      activeFields,
      visualState.labelX,
      visualState.labelY,
    );
    const aiView = {
      title: visualState.title || input.draft.title,
      subtitle: visualState.subtitle || input.draft.subtitle,
      sources: activeSourceDetails.map(({ id, title, description }) => ({ id, title, description })),
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
      activeFields,
      visualState.labelX,
      visualState.labelY,
    );
    const aiViewNote = `${titleNote}${subtitleNote}${sourceNote}${extent ? ` ${extent}.` : ""}`;
    const mapFeatureContext = input.mapFeatureSelection
      ? `${aiViewNote} Selected map feature: ${input.mapFeatureSelection.title}. Attached feature values: ${input.mapFeatureSelection.values.map(({ field, value }) => `${field}=${value}`).join("; ")}. Treat this one geographic feature as the active subject unless the user broadens the question.`
      : "";

    return {
      ...input,
      activeSources,
      activeSource,
      sources,
      activeFields,
      selectedProjectionNames,
      selectedFieldNames,
      visualFields,
      visualState,
      chartLegendTitles: {
        colour: visualState.labelColor,
        fill: visualState.labelFill,
        size: visualState.labelSize,
        shape: visualState.labelShape,
        linetype: visualState.labelLinetype,
        linewidth: visualState.labelLinewidth,
        opacity: visualState.labelOpacity,
      },
      isBlankWorkspace,
      isMap: /\bDRAW\s+spatial\b/i.test(splitGgsql(input.query).visual),
      chartSelectionData,
      chartSelectionDetails,
      aiView,
      aiViewNote,
      mapFeatureContext,
    };
  }, [input]);
}

export type WorkspaceViewModel = ReturnType<typeof useWorkspaceViewModel>;

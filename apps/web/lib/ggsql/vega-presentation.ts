import {
  applyMapViewport,
  geometryFeatureCollection,
  geometryUsesLongitudeLatitude,
  robustGeometryFit,
  robustPlanarGeometryFit,
  type MapPointFields,
  type MapViewport,
} from "./geo-fit";

export interface ChartThreshold {
  fieldTitles: readonly string[];
  value: number;
  below: string;
  above: string;
}

export interface ChartDomains {
  x?: [unknown, unknown];
  y?: [unknown, unknown];
}

export interface ChartLegendTitles {
  colour?: string;
  fill?: string;
  size?: string;
  shape?: string;
  linetype?: string;
  linewidth?: string;
  opacity?: string;
}

const chartColors = {
  ink: "#0a0f0d",
  muted: "#596662",
  line: "#dce2e0",
  teal: "#3cbbb1",
  tealDark: "#147d76",
};

function replaceDefaultBlack(channel: unknown, color: string) {
  if (!channel || typeof channel !== "object" || Array.isArray(channel)) return channel;
  const value = (channel as { value?: unknown }).value;
  return value === "black" || value === "#000000" || value === "#747474" ? { ...channel, value: color } : channel;
}

function withoutDuplicateTextStroke(encoding: Record<string, unknown>) {
  if (!encoding.text) return encoding.stroke;
  const fill = encoding.fill as { value?: unknown } | undefined;
  const stroke = encoding.stroke as { value?: unknown } | undefined;
  return fill?.value !== undefined && fill.value === stroke?.value ? { value: null } : encoding.stroke;
}

function ordinalSuffix(day: number) {
  const lastTwo = day % 100;
  if (lastTwo >= 11 && lastTwo <= 13) return "th";
  if (day % 10 === 1) return "st";
  if (day % 10 === 2) return "nd";
  if (day % 10 === 3) return "rd";
  return "th";
}

function withOrdinalDateLabels(channel: unknown) {
  if (!channel || typeof channel !== "object" || Array.isArray(channel)) return channel;
  const value = channel as Record<string, unknown>;
  if (value.title !== "Poll Date" || !value.axis || typeof value.axis !== "object" || Array.isArray(value.axis)) return channel;
  const axis = value.axis as Record<string, unknown>;
  if (typeof axis.labelExpr !== "string") return channel;
  return {
    ...value,
    axis: {
      ...axis,
      labelExpr: axis.labelExpr.replace(/'([A-Z][a-z]+) (\d{1,2}), (\d{4})'/g, (_match, month: string, dayText: string, year: string) => {
        const day = Number(dayText);
        return `'${month} ${day}${ordinalSuffix(day)}, ${year}'`;
      }),
    },
  };
}

function withSignedDivergingMidpoint(channel: unknown) {
  if (!channel || typeof channel !== "object" || Array.isArray(channel)) return channel;
  const value = channel as Record<string, unknown>;
  const scale = value.scale;
  if (!scale || typeof scale !== "object" || Array.isArray(scale)) return channel;
  const scaleValue = scale as Record<string, unknown>;
  const domain = scaleValue.domain;
  const range = scaleValue.range;
  if (!Array.isArray(domain) || domain.length < 2 || !domain.every((item) => typeof item === "number")) return channel;
  if (!Array.isArray(range) || !range.some((item) => typeof item === "string" && item.toLocaleLowerCase() === "#ffffbf")) return channel;
  const numbers = domain as number[];
  if (Math.min(...numbers) >= 0 || Math.max(...numbers) <= 0) return channel;
  return { ...value, scale: { ...scaleValue, domainMid: 0 } };
}

function makeThresholdStroke(y: { scale?: { domain?: unknown } }, threshold: ChartThreshold) {
  const domain = y.scale?.domain;
  if (!Array.isArray(domain) || domain.length < 2 || !domain.every((value) => typeof value === "number")) {
    return { value: threshold.below };
  }
  const minimum = Math.min(...domain as number[]);
  const maximum = Math.max(...domain as number[]);
  if (threshold.value >= maximum) return { value: threshold.below };
  if (threshold.value <= minimum) return { value: threshold.above };
  const offset = (threshold.value - minimum) / (maximum - minimum);
  return {
    value: {
      gradient: "linear",
      x1: 0,
      x2: 0,
      y1: 1,
      y2: 0,
      stops: [
        { offset: 0, color: threshold.below },
        { offset, color: threshold.below },
        { offset: Math.min(1, offset + 0.002), color: threshold.above },
        { offset: 1, color: threshold.above },
      ],
    },
  };
}

function withLegendTitle(channel: unknown, title: string | undefined, genericNames: readonly string[]) {
  if (!title?.trim() || !channel || typeof channel !== "object" || Array.isArray(channel)) return channel;
  const value = channel as Record<string, unknown>;
  if (typeof value.field !== "string") return channel;
  const current = typeof value.title === "string" ? value.title.toLocaleLowerCase() : "";
  const generic = !current
    || genericNames.some((name) => current === name)
    || current.startsWith("__ggsql_aes_");
  return generic ? { ...value, title: title.trim() } : channel;
}

function styleSpecNode(
  node: Record<string, unknown>,
  threshold?: ChartThreshold,
  domains?: ChartDomains,
  legendTitles?: ChartLegendTitles,
): Record<string, unknown> {
  const encoding = node.encoding as Record<string, unknown> | undefined;
  const mark = typeof node.mark === "string" ? node.mark : (node.mark as { type?: string } | undefined)?.type;
  const y = encoding?.y as { field?: unknown; title?: unknown; scale?: { domain?: unknown } } | undefined;
  const yTitle = typeof y?.title === "string" ? y.title : "";
  const thresholdStroke = threshold && mark === "line" && typeof y?.field === "string"
    && threshold.fieldTitles.some((title) => title.toLocaleLowerCase() === yTitle.toLocaleLowerCase())
    ? makeThresholdStroke(y, threshold)
    : undefined;
  const withDomain = (channel: unknown, domain: [unknown, unknown] | undefined) => {
    if (!domain || !channel || typeof channel !== "object" || Array.isArray(channel)) return channel;
    const value = channel as Record<string, unknown>;
    return { ...value, scale: { ...((value.scale ?? {}) as Record<string, unknown>), domain } };
  };
  const styled: Record<string, unknown> = encoding
    ? {
        ...node,
        encoding: {
          ...encoding,
          // GGSQL can infer a shared label aesthetic as quantitative when
          // earlier layers contribute only null labels. Vega then renders
          // perfectly valid event strings as `NaN`. Text is a display
          // channel, so keep it nominal regardless of that union inference.
          text: encoding.text && typeof encoding.text === "object" && !Array.isArray(encoding.text)
            ? { ...(encoding.text as Record<string, unknown>), type: "nominal" }
            : encoding.text,
          x: withDomain(withOrdinalDateLabels(encoding.x), domains?.x),
          y: withDomain(encoding.y, domains?.y),
          color: withLegendTitle(replaceDefaultBlack(encoding.color, chartColors.tealDark), legendTitles?.colour, ["color", "colour"]),
          fill: withLegendTitle(withSignedDivergingMidpoint(replaceDefaultBlack(encoding.fill, chartColors.teal)), legendTitles?.fill, ["fill"]),
          size: withLegendTitle(encoding.size, legendTitles?.size, ["size"]),
          shape: withLegendTitle(encoding.shape, legendTitles?.shape, ["shape"]),
          stroke: withLegendTitle(thresholdStroke ?? replaceDefaultBlack(withoutDuplicateTextStroke(encoding), chartColors.tealDark), legendTitles?.colour, ["stroke", "color", "colour"]),
          strokeDash: withLegendTitle(encoding.strokeDash, legendTitles?.linetype, ["strokedash", "linetype"]),
          strokeWidth: withLegendTitle(encoding.strokeWidth, legendTitles?.linewidth, ["strokewidth", "linewidth"]),
          opacity: withLegendTitle(encoding.opacity, legendTitles?.opacity, ["opacity"]),
        },
      }
    : { ...node };

  for (const key of ["layer", "concat", "hconcat", "vconcat"] as const) {
    const children = styled[key];
    if (Array.isArray(children)) {
      styled[key] = children.map((child) => child && typeof child === "object" ? styleSpecNode(child as Record<string, unknown>, threshold, domains, legendTitles) : child);
    }
  }
  if (styled.spec && typeof styled.spec === "object" && !Array.isArray(styled.spec)) {
    styled.spec = styleSpecNode(styled.spec as Record<string, unknown>, threshold, domains, legendTitles);
  }
  return styled;
}

function mapPointFields(node: Record<string, unknown>, fields = new Map<string, MapPointFields>()) {
  const encoding = node.encoding;
  if (encoding && typeof encoding === "object" && !Array.isArray(encoding)) {
    const channels = encoding as Record<string, unknown>;
    const longitude = channels.longitude as { field?: unknown } | undefined;
    const latitude = channels.latitude as { field?: unknown } | undefined;
    if (typeof longitude?.field === "string" && typeof latitude?.field === "string") {
      fields.set(`${longitude.field}\u0000${latitude.field}`, { x: longitude.field, y: latitude.field });
    }
  }
  for (const key of ["layer", "concat", "hconcat", "vconcat"] as const) {
    const children = node[key];
    if (Array.isArray(children)) {
      children.forEach((child) => {
        if (child && typeof child === "object") mapPointFields(child as Record<string, unknown>, fields);
      });
    }
  }
  if (node.spec && typeof node.spec === "object" && !Array.isArray(node.spec)) {
    mapPointFields(node.spec as Record<string, unknown>, fields);
  }
  return [...fields.values()];
}

function withChartizePresentation(spec: Record<string, unknown>, threshold?: ChartThreshold, domains?: ChartDomains, legendTitles?: ChartLegendTitles) {
  const normalized = styleSpecNode(spec, threshold, domains, legendTitles);
  delete normalized.title;
  const config = (normalized.config ?? {}) as Record<string, unknown>;
  const axis = (config.axis ?? {}) as Record<string, unknown>;
  const legend = (config.legend ?? {}) as Record<string, unknown>;
  const view = (config.view ?? {}) as Record<string, unknown>;
  normalized.background = "#ffffff";
  normalized.config = {
    ...config,
    axis: {
      ...axis,
      gridColor: chartColors.line,
      gridWidth: 1,
      labelColor: chartColors.muted,
      labelFont: "system-ui",
      tickColor: chartColors.line,
      titleColor: chartColors.ink,
      titleFont: "system-ui",
    },
    legend: {
      ...legend,
      labelColor: chartColors.muted,
      labelFont: "system-ui",
      titleColor: chartColors.ink,
      titleFont: "system-ui",
    },
    view: { ...view, fill: "#ffffff", stroke: null },
  };
  return normalized;
}

/** Adds Chartize styling, explicit chart domains, and a stable map camera. */
export function presentChartSpec(
  input: Record<string, unknown>,
  threshold?: ChartThreshold,
  domains?: ChartDomains,
  mapViewport: MapViewport = { zoom: 1, panX: 0, panY: 0 },
  legendTitles?: ChartLegendTitles,
) {
  const spec = withChartizePresentation(input, threshold, domains, legendTitles);
  const data = spec.data as { values?: Array<Record<string, unknown>> } | undefined;
  const hasGeometry = data?.values?.some((value) => {
    const geometry = value.geometry as { type?: string; coordinates?: unknown } | undefined;
    return Boolean(geometry?.type && geometry.coordinates);
  });
  const projection = spec.projection as { type?: string; scale?: unknown; translate?: unknown } | undefined;
  if (!hasGeometry || (projection?.type && projection.type !== "identity")) return spec;
  const layers = Array.isArray(spec.layer)
    ? spec.layer.filter((layer) => !(layer && typeof layer === "object" && (layer as { description?: unknown }).description === "background"))
    : spec.layer;
  const values = data?.values ?? [];
  const rawGeoJson = geometryUsesLongitudeLatitude(values);
  const pointFields = mapPointFields(spec);
  const valuesWithViewport = applyMapViewport(values, geometryFeatureCollection(values), mapViewport, pointFields);

  // GGSQL emits a responsive identity projection for already-projected map
  // data. Preserve that camera: replacing it with Vega-Lite's inferred `fit`
  // can leave geoshape paths at the embed's initial translation while
  // longitude/latitude text marks move to the resized pane. The result is a
  // constant label offset even though every point lies inside its polygon.
  if (!rawGeoJson && projection?.scale !== undefined && projection.translate !== undefined) {
    return {
      ...spec,
      data: { ...data, values: valuesWithViewport },
      layer: layers,
      padding: spec.padding ?? 16,
    };
  }

  const robustFit = rawGeoJson ? robustGeometryFit(values) : robustPlanarGeometryFit(values);
  const fit = robustFit ?? geometryFeatureCollection(values);
  return {
    ...spec,
    data: { ...data, values: applyMapViewport(values, fit, mapViewport, pointFields) },
    layer: layers,
    padding: spec.padding ?? 16,
    projection: rawGeoJson
      ? { type: "mercator", ...(fit ? { fit } : {}) }
      : { type: "identity", reflectY: true, ...(fit ? { fit } : {}) },
  };
}

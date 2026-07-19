import {
  applyMapViewport,
  geometryFeatureCollection,
  geometryUsesLongitudeLatitude,
  robustGeometryFit,
  robustPlanarGeometryFit,
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

function styleSpecNode(node: Record<string, unknown>, threshold?: ChartThreshold, domains?: ChartDomains): Record<string, unknown> {
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
          x: withDomain(withOrdinalDateLabels(encoding.x), domains?.x),
          y: withDomain(encoding.y, domains?.y),
          color: replaceDefaultBlack(encoding.color, chartColors.tealDark),
          fill: replaceDefaultBlack(encoding.fill, chartColors.teal),
          stroke: thresholdStroke ?? replaceDefaultBlack(encoding.stroke, chartColors.tealDark),
        },
      }
    : { ...node };

  for (const key of ["layer", "concat", "hconcat", "vconcat"] as const) {
    const children = styled[key];
    if (Array.isArray(children)) {
      styled[key] = children.map((child) => child && typeof child === "object" ? styleSpecNode(child as Record<string, unknown>, threshold, domains) : child);
    }
  }
  if (styled.spec && typeof styled.spec === "object" && !Array.isArray(styled.spec)) {
    styled.spec = styleSpecNode(styled.spec as Record<string, unknown>, threshold, domains);
  }
  return styled;
}

function withChartizePresentation(spec: Record<string, unknown>, threshold?: ChartThreshold, domains?: ChartDomains) {
  const normalized = styleSpecNode(spec, threshold, domains);
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
) {
  const spec = withChartizePresentation(input, threshold, domains);
  const data = spec.data as { values?: Array<Record<string, unknown>> } | undefined;
  const hasGeometry = data?.values?.some((value) => {
    const geometry = value.geometry as { type?: string; coordinates?: unknown } | undefined;
    return Boolean(geometry?.type && geometry.coordinates);
  });
  const projection = spec.projection as { type?: string } | undefined;
  if (!hasGeometry || (projection?.type && projection.type !== "identity")) return spec;
  const layers = Array.isArray(spec.layer)
    ? spec.layer.filter((layer) => !(layer && typeof layer === "object" && (layer as { description?: unknown }).description === "background"))
    : spec.layer;
  const values = data?.values ?? [];
  const rawGeoJson = geometryUsesLongitudeLatitude(values);
  const robustFit = rawGeoJson ? robustGeometryFit(values) : robustPlanarGeometryFit(values);
  const fit = robustFit ?? geometryFeatureCollection(values);
  return {
    ...spec,
    data: { ...data, values: applyMapViewport(values, fit, mapViewport) },
    layer: layers,
    padding: spec.padding ?? 16,
    projection: rawGeoJson
      ? { type: "mercator", ...(fit ? { fit } : {}) }
      : { type: "identity", reflectY: true, ...(fit ? { fit } : {}) },
  };
}

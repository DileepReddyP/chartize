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

function withoutExplicitlyUntitledAxis(channel: unknown) {
  if (!channel || typeof channel !== "object" || Array.isArray(channel)) return channel;
  const value = channel as Record<string, unknown>;
  return value.title === null ? { ...value, axis: null } : channel;
}

function withSaneInlineLogDomain(channel: unknown, rows: Array<Record<string, unknown>>) {
  if (!channel || typeof channel !== "object" || Array.isArray(channel)) return channel;
  const value = channel as Record<string, unknown>;
  const field = typeof value.field === "string" ? value.field : "";
  const scale = value.scale;
  if (!field || !scale || typeof scale !== "object" || Array.isArray(scale)) return channel;
  const scaleValue = scale as Record<string, unknown>;
  const domain = scaleValue.domain;
  if (scaleValue.type !== "log" || !Array.isArray(domain) || domain.length < 2) return channel;
  const values = rows
    .map((row) => typeof row[field] === "number" ? row[field] as number : Number(row[field]))
    .filter((entry) => Number.isFinite(entry) && entry > 0);
  if (!values.length) return channel;
  const dataMinimum = Math.min(...values);
  const dataMaximum = Math.max(...values);
  const numericDomain = domain.filter((entry): entry is number => typeof entry === "number");
  const invalidDomain = numericDomain.length < 2;
  const domainMinimum = invalidDomain ? dataMinimum : Math.min(...numericDomain);
  const domainMaximum = invalidDomain ? dataMaximum : Math.max(...numericDomain);
  const brokenMinimum = invalidDomain || !Number.isFinite(domainMinimum) || domainMinimum <= 0 || domainMinimum < dataMinimum / 1_000_000;
  const wastefulMaximum = invalidDomain || (Number.isFinite(domainMaximum) && domainMaximum > dataMaximum * 5);
  if (!brokenMinimum && !wastefulMaximum) return channel;

  const axis = value.axis;
  const repairedAxis = axis && typeof axis === "object" && !Array.isArray(axis)
    ? (() => {
        const { labelExpr: _labelExpr, values: _values, ...rest } = axis as Record<string, unknown>;
        return { ...rest, format: rest.format ?? "~s" };
      })()
    : axis;
  return {
    ...value,
    ...(repairedAxis === undefined ? {} : { axis: repairedAxis }),
    scale: {
      ...scaleValue,
      domain: [brokenMinimum ? dataMinimum : domainMinimum, wastefulMaximum ? dataMaximum : domainMaximum],
      nice: false,
    },
  };
}

function withCompactLargeNumberLegend(channel: unknown, rows: Array<Record<string, unknown>>) {
  if (!channel || typeof channel !== "object" || Array.isArray(channel)) return channel;
  const value = channel as Record<string, unknown>;
  const field = typeof value.field === "string" ? value.field : "";
  if (!field || value.legend === null) return channel;
  const numbers = rows
    .map((row) => row[field])
    .filter((entry) => entry !== null && entry !== undefined && entry !== "")
    .map(Number)
    .filter((entry) => Number.isFinite(entry));
  if (!numbers.length || Math.max(...numbers.map(Math.abs)) < 1_000_000) return channel;
  const legend = value.legend && typeof value.legend === "object" && !Array.isArray(value.legend)
    ? value.legend as Record<string, unknown>
    : {};
  const { labelExpr: _generatedLabels, ...rest } = legend;
  return { ...value, legend: { ...rest, format: "~s" } };
}

function withSparseDenseDiscreteAxis(channel: unknown, rows: Array<Record<string, unknown>>) {
  if (!channel || typeof channel !== "object" || Array.isArray(channel)) return channel;
  const value = channel as Record<string, unknown>;
  if (!["nominal", "ordinal"].includes(String(value.type)) || typeof value.field !== "string" || value.axis === null) return channel;
  const unique = [...new Set(rows.map((row) => row[value.field as string]).filter((entry) => entry !== null && entry !== undefined))];
  if (unique.length <= 36) return channel;
  const stride = Math.ceil(unique.length / 10);
  const values = unique.filter((_entry, index) => index % stride === 0);
  const last = unique.at(-1);
  if (last !== undefined && values.at(-1) !== last) values.push(last);
  const axis = value.axis && typeof value.axis === "object" && !Array.isArray(value.axis)
    ? value.axis as Record<string, unknown>
    : {};
  return { ...value, axis: { ...axis, values, labelAngle: 0, labelOverlap: "greedy", labelSeparation: 8 } };
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

function hasIntentionalStroke(channel: unknown) {
  if (!channel || typeof channel !== "object" || Array.isArray(channel)) return false;
  const value = channel as { field?: unknown; value?: unknown };
  if (typeof value.field === "string") return true;
  if (typeof value.value !== "string") return value.value !== undefined;
  return !["black", "#000000", "#747474"].includes(value.value.toLocaleLowerCase());
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
  inheritedRows: Array<Record<string, unknown>> = [],
): Record<string, unknown> {
  const data = node.data as { values?: unknown } | undefined;
  const rows = Array.isArray(data?.values)
    ? data.values.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object" && !Array.isArray(row))
    : inheritedRows;
  const encoding = node.encoding as Record<string, unknown> | undefined;
  const mark = typeof node.mark === "string" ? node.mark : (node.mark as { type?: string } | undefined)?.type;
  const y = encoding?.y as { field?: unknown; title?: unknown; scale?: { domain?: unknown } } | undefined;
  const yField = typeof y?.field === "string" ? y.field : "";
  const yTitle = typeof y?.title === "string" ? y.title : "";
  const thresholdStroke = threshold && mark === "line" && typeof y?.field === "string"
    && threshold.fieldTitles.some((title) => {
      const normalized = title.toLocaleLowerCase();
      return normalized === yField.toLocaleLowerCase() || normalized === yTitle.toLocaleLowerCase();
    })
    && !hasIntentionalStroke(encoding?.stroke)
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
          x: withDomain(withoutExplicitlyUntitledAxis(withSparseDenseDiscreteAxis(withOrdinalDateLabels(withSaneInlineLogDomain(encoding.x, rows)), rows)), domains?.x),
          y: withDomain(withoutExplicitlyUntitledAxis(withSaneInlineLogDomain(encoding.y, rows)), domains?.y),
          color: withLegendTitle(replaceDefaultBlack(encoding.color, chartColors.tealDark), legendTitles?.colour, ["color", "colour"]),
          fill: withLegendTitle(withCompactLargeNumberLegend(withSignedDivergingMidpoint(replaceDefaultBlack(encoding.fill, chartColors.teal)), rows), legendTitles?.fill, ["fill"]),
          size: withLegendTitle(withCompactLargeNumberLegend(encoding.size, rows), legendTitles?.size, ["size"]),
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
      styled[key] = children.map((child) => child && typeof child === "object" ? styleSpecNode(child as Record<string, unknown>, threshold, domains, legendTitles, rows) : child);
    }
  }
  if (styled.spec && typeof styled.spec === "object" && !Array.isArray(styled.spec)) {
    styled.spec = styleSpecNode(styled.spec as Record<string, unknown>, threshold, domains, legendTitles, rows);
  }
  return styled;
}

interface TaperedLinewidthKey {
  title: string;
  minimum: number;
  maximum: number;
}

/**
 * Vega's symbol legend for a quantitative geoshape stroke width can collapse
 * to bare numeric labels because the source mark is unfilled. A small trail
 * is both more literal and more compact: its width grows continuously from
 * the observed minimum to maximum and it remains part of exported SVG/PNG.
 */
function withTaperedLinewidthKey(input: Record<string, unknown>) {
  if (!input.projection || !Array.isArray(input.layer)) return input;
  let key: TaperedLinewidthKey | undefined;
  const stripLegend = (
    node: Record<string, unknown>,
    inheritedRows: Array<Record<string, unknown>>,
  ): Record<string, unknown> => {
    const data = node.data as { values?: unknown } | undefined;
    const rows = Array.isArray(data?.values)
      ? data.values.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object" && !Array.isArray(row))
      : inheritedRows;
    const encoding = node.encoding as Record<string, unknown> | undefined;
    const width = encoding?.strokeWidth;
    let next = node;
    if (!key && width && typeof width === "object" && !Array.isArray(width)) {
      const channel = width as Record<string, unknown>;
      const field = typeof channel.field === "string" ? channel.field : "";
      const values = field
        ? rows
            .map((row) => row[field])
            .filter((value) => value !== null && value !== undefined && value !== "")
            .map(Number)
            .filter((value) => Number.isFinite(value))
        : [];
      if (values.length && channel.legend !== null) {
        key = {
          title: typeof channel.title === "string" && channel.title.trim() ? channel.title.trim() : "Line width",
          minimum: Math.min(...values),
          maximum: Math.max(...values),
        };
        next = { ...node, encoding: { ...encoding, strokeWidth: { ...channel, legend: null } } };
      }
    }
    for (const collection of ["layer", "concat", "hconcat", "vconcat"] as const) {
      const children = next[collection];
      if (Array.isArray(children)) {
        next = {
          ...next,
          [collection]: children.map((child) => child && typeof child === "object"
            ? stripLegend(child as Record<string, unknown>, rows)
            : child),
        };
      }
    }
    return next;
  };

  const rows = (input.data as { values?: unknown } | undefined)?.values;
  const normalizedRows = Array.isArray(rows)
    ? rows.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object" && !Array.isArray(row))
    : [];
  const stripped = stripLegend(input, normalizedRows);
  if (!key || key.minimum === key.maximum || !Array.isArray(stripped.layer)) return stripped;

  const precision = key.maximum - key.minimum < 10 ? 1 : 0;
  const number = (value: number) => value.toLocaleString("en-US", { maximumFractionDigits: precision });
  const x = (field: string) => ({ field, type: "quantitative", scale: { domain: [0, 1] }, axis: null });
  const y = (field: string) => ({ field, type: "quantitative", scale: { domain: [0, 1] }, axis: null });
  const legendLayers: Array<Record<string, unknown>> = [
    {
      description: "linewidth legend title",
      data: { values: [{ __ggsql_legend_x__: .775, __ggsql_legend_y__: .155, __ggsql_legend_label__: key.title }] },
      mark: { type: "text", align: "left", baseline: "middle", color: chartColors.ink, font: "system-ui", fontSize: 11, fontWeight: 550 },
      encoding: { x: x("__ggsql_legend_x__"), y: y("__ggsql_legend_y__"), text: { field: "__ggsql_legend_label__", type: "nominal" } },
    },
    {
      description: "tapered linewidth legend",
      data: { values: [
        { __ggsql_legend_x__: .79, __ggsql_legend_y__: .095, __ggsql_legend_width__: key.minimum },
        { __ggsql_legend_x__: .965, __ggsql_legend_y__: .095, __ggsql_legend_width__: key.maximum },
      ] },
      mark: { type: "trail", color: chartColors.muted },
      encoding: {
        x: x("__ggsql_legend_x__"),
        y: y("__ggsql_legend_y__"),
        size: { field: "__ggsql_legend_width__", type: "quantitative", scale: { domain: [key.minimum, key.maximum], range: [1.5, 11] }, legend: null },
        order: { field: "__ggsql_legend_x__", type: "quantitative" },
      },
    },
    {
      description: "linewidth legend values",
      data: { values: [
        { __ggsql_legend_x__: .79, __ggsql_legend_y__: .055, __ggsql_legend_label__: number(key.minimum) },
        { __ggsql_legend_x__: .965, __ggsql_legend_y__: .055, __ggsql_legend_label__: number(key.maximum) },
      ] },
      mark: { type: "text", align: "center", baseline: "middle", color: chartColors.muted, font: "ui-monospace", fontSize: 8 },
      encoding: { x: x("__ggsql_legend_x__"), y: y("__ggsql_legend_y__"), text: { field: "__ggsql_legend_label__", type: "nominal" } },
    },
  ];
  const resolve = stripped.resolve && typeof stripped.resolve === "object" && !Array.isArray(stripped.resolve)
    ? stripped.resolve as Record<string, unknown>
    : {};
  const scale = resolve.scale && typeof resolve.scale === "object" && !Array.isArray(resolve.scale)
    ? resolve.scale as Record<string, unknown>
    : {};
  return {
    ...stripped,
    layer: [...stripped.layer, ...legendLayers],
    resolve: { ...resolve, scale: { ...scale, x: "independent", y: "independent", size: "independent" } },
  };
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
  const normalized = withTaperedLinewidthKey(styleSpecNode(spec, threshold, domains, legendTitles));
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
      labelLimit: 130,
      labelOverlap: "greedy",
      labelSeparation: 8,
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

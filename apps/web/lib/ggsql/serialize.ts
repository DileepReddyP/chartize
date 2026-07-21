import type { GgsqlDraft } from "@chartize/contracts";

const quoteIdentifier = (value: string) => `"${value.replaceAll('"', '""')}"`;
const quoteSource = (value: string) => /^(ggsql|chartize|user):/.test(value) ? value : quoteIdentifier(value);
const quoteLiteral = (value: string) => `'${value.replaceAll("'", "''")}'`;
const literalSetting = (value: string) => /^-?(?:\d+\.?\d*|\.\d+)$/.test(value.trim()) ? value.trim() : quoteLiteral(value);

function filterSql(field: string, operator: string, value: string | number | boolean) {
  const literal = typeof value === "string" ? quoteLiteral(value) : String(value);
  if (operator === "contains") {
    return `CAST(${quoteIdentifier(field)} AS VARCHAR) LIKE ${quoteLiteral(`%${String(value)}%`)}`;
  }
  return `${quoteIdentifier(field)} ${operator} ${literal}`;
}

export function serializeDraft(draft: GgsqlDraft): string {
  const firstLayer = draft.layers[0];
  if (!firstLayer) throw new Error("At least one visualization layer is required.");
  const scenarioDeltas = draft.scenarioDeltas ?? [];
  const referenceRules = draft.referenceRules ?? [];

  const selected = new Set<string>();
  for (const layer of draft.layers) {
    if (layer.place) continue;
    const layerFields = layer.mark === "spatial"
      ? [layer.geometry, layer.color, layer.fill, layer.opacityField]
      : [
          layer.x, layer.y, layer.lon, layer.lat, layer.label, layer.xEnd, layer.yEnd, layer.xMin, layer.xMax, layer.yMin, layer.yMax,
          layer.slope, layer.color, layer.fill, layer.size, layer.shape, layer.linetype,
          layer.linewidth, layer.opacityField, layer.weight,
        ];
    for (const field of layerFields) {
      if (field) selected.add(field);
    }
  }
  for (const field of draft.groupBy) selected.add(field);
  for (const field of draft.tooltipFields) selected.add(field);
  const scenarioAliases = new Set(scenarioDeltas.map((scenario) => scenario.as));
  for (const scenario of scenarioDeltas) selected.add(scenario.field);

  const from = quoteSource(draft.source);
  const joins = draft.joins
    .map(
      (join) =>
        `${join.kind} JOIN ${quoteIdentifier(join.table)} ON ${from}.${quoteIdentifier(join.leftField)} = ${quoteIdentifier(join.table)}.${quoteIdentifier(join.rightField)}`,
    )
    .join("\n");
  const where = draft.filters.length
    ? `\nWHERE ${draft.filters.map((filter) => filterSql(filter.field, filter.operator, filter.value)).join(" AND ")}`
    : "";

  let select: string;
  let groupBy = "";
  let aggregateAlias = "";
  if (draft.aggregation !== "none" && (draft.aggregateField || draft.aggregation === "count")) {
    const dimensions = draft.groupBy.length ? draft.groupBy : [firstLayer.x, firstLayer.color].filter(Boolean);
    const uniqueDimensions = [...new Set(dimensions)];
    const aggregateFn = draft.aggregation === "mean" ? "AVG" : draft.aggregation.toUpperCase();
    aggregateAlias = draft.aggregation === "count" && !draft.aggregateField
      ? "_count"
      : `_${draft.aggregation}_${draft.aggregateField}`;
    const aggregateArgument = draft.aggregateField ? quoteIdentifier(draft.aggregateField) : "*";
    select = [
      ...uniqueDimensions.map(quoteIdentifier),
      `${aggregateFn}(${aggregateArgument}) AS ${quoteIdentifier(aggregateAlias)}`,
    ].join(", ");
    if (uniqueDimensions.length) groupBy = `\nGROUP BY ${uniqueDimensions.map(quoteIdentifier).join(", ")}`;
  } else {
    const projected = [...selected]
      .filter((field) => !scenarioAliases.has(field))
      .map(quoteIdentifier);
    projected.push(...scenarioDeltas.map((scenario) =>
      `${quoteIdentifier(scenario.field)} ${scenario.delta < 0 ? "-" : "+"} ${Math.abs(scenario.delta)} AS ${quoteIdentifier(scenario.as)}`));
    projected.push(...referenceRules.map((rule, index) =>
      `${literalSetting(rule.value)} AS ${quoteIdentifier(`__chartize_rule_${index}`)}`));
    select = projected.length ? projected.join(", ") : "*";
  }

  const visualLayers = draft.layers
    .map((layer, index) => {
      const mappings: string[] = [];
      const mapped = (field: string) => aggregateAlias && field === draft.aggregateField ? aggregateAlias : field;
      if (!layer.place && layer.mark === "spatial") {
        if (layer.geometry) mappings.push(`${quoteIdentifier(layer.geometry)} AS geometry`);
        if (layer.fill) mappings.push(`${quoteIdentifier(layer.fill)} AS fill`);
        else if (layer.fillLegendValue) mappings.push(`${quoteLiteral(layer.fillLegendValue)} AS fill`);
        if (layer.color) mappings.push(`${quoteIdentifier(layer.color)} AS colour`);
        else if (layer.colourLegendValue) mappings.push(`${quoteLiteral(layer.colourLegendValue)} AS colour`);
        if (layer.opacityField) mappings.push(`${quoteIdentifier(layer.opacityField)} AS opacity`);
      } else if (!layer.place) {
        if (layer.lon) mappings.push(`${quoteIdentifier(mapped(layer.lon))} AS lon`);
        else if (layer.x) mappings.push(`${quoteIdentifier(mapped(layer.x))} AS x`);
        if (layer.lat) mappings.push(`${quoteIdentifier(mapped(layer.lat))} AS lat`);
        else if (aggregateAlias) mappings.push(`${quoteIdentifier(aggregateAlias)} AS y`);
        else if (layer.y) mappings.push(`${quoteIdentifier(layer.y)} AS y`);
        if (layer.label) mappings.push(`${quoteIdentifier(layer.label)} AS label`);
        for (const [field, aesthetic] of [
          [layer.xEnd, "xend"], [layer.yEnd, "yend"], [layer.xMin, "xmin"], [layer.xMax, "xmax"],
          [layer.yMin, "ymin"], [layer.yMax, "ymax"], [layer.slope, "slope"],
        ] as const) if (field) mappings.push(`${quoteIdentifier(field)} AS ${aesthetic}`);
        if (layer.color) mappings.push(`${quoteIdentifier(layer.color)} AS colour`);
        else if (layer.colourLegendValue) mappings.push(`${quoteLiteral(layer.colourLegendValue)} AS colour`);
        if (layer.fill) mappings.push(`${quoteIdentifier(layer.fill)} AS fill`);
        else if (layer.fillLegendValue) mappings.push(`${quoteLiteral(layer.fillLegendValue)} AS fill`);
        if (layer.size && (!aggregateAlias || mapped(layer.size) === aggregateAlias)) mappings.push(`${quoteIdentifier(mapped(layer.size))} AS size`);
        for (const [field, aesthetic] of [
          [layer.shape, "shape"], [layer.linetype, "linetype"], [layer.linewidth, "linewidth"],
          [layer.opacityField, "opacity"], [layer.weight, "weight"],
        ] as const) if (field) mappings.push(`${quoteIdentifier(field)} AS ${aesthetic}`);
      }
      const settings: string[] = [];
      const opacity = layer.opacity ?? 0.9;
      const position = layer.position ?? "identity";
      if (opacity !== 0.9) settings.push(`opacity => ${opacity}`);
      if (position !== "identity") settings.push(`position => ${quoteLiteral(position)}`);
      if (layer.fixedColour) settings.push(`color => ${quoteLiteral(layer.fixedColour)}`);
      if (layer.fixedFill) settings.push(`fill => ${quoteLiteral(layer.fixedFill)}`);
      if (layer.fixedSize > 0) settings.push(`size => ${layer.fixedSize}`);
      if (layer.fixedLinewidth > 0) settings.push(`linewidth => ${layer.fixedLinewidth}`);
      if (layer.fixedLinetype) settings.push(`linetype => ${quoteLiteral(layer.fixedLinetype)}`);
      if (layer.fixedFontSize > 0) settings.push(`fontsize => ${layer.fixedFontSize}`);
      if (layer.fixedFontWeight) settings.push(`fontweight => ${quoteLiteral(layer.fixedFontWeight)}`);
      if (layer.mark === "smooth") {
        if (layer.smoothMethod) settings.push(`method => ${quoteLiteral(layer.smoothMethod)}`);
        if (Number.isFinite(layer.smoothAdjust) && layer.smoothAdjust !== 1) settings.push(`adjust => ${layer.smoothAdjust}`);
        if (Number.isFinite(layer.smoothBandwidth) && layer.smoothBandwidth > 0) settings.push(`bandwidth => ${layer.smoothBandwidth}`);
        if (layer.smoothKernel) settings.push(`kernel => ${quoteLiteral(layer.smoothKernel)}`);
      }
      if (layer.place) {
        for (const [value, aesthetic] of [
          [layer.literalX, "x"], [layer.literalY, "y"], [layer.literalXEnd, "xend"],
          [layer.literalYEnd, "yend"], [layer.literalSlope, "slope"],
        ] as const) if (value) settings.push(`${aesthetic} => ${literalSetting(value)}`);
      }
      return `${layer.place ? "PLACE" : "DRAW"} ${layer.mark}${mappings.length ? `\n  MAPPING ${mappings.join(", ")}` : ""}${settings.length ? `\n  SETTING ${settings.join(", ")}` : ""}${index ? "" : ""}`;
    })
    .join("\n");
  const referenceLayers = referenceRules.map((rule, index) =>
    `DRAW rule\n  MAPPING ${quoteIdentifier(`__chartize_rule_${index}`)} AS ${rule.axis}\n  SETTING aggregate => 'max', color => ${quoteLiteral(rule.colour)}, linetype => ${quoteLiteral(rule.linetype)}, linewidth => ${rule.linewidth}`,
  ).join("\n");

  const scales = draft.scales.map((scale) => {
    const type = scale.type ? ` ${scale.type.toLocaleUpperCase()}` : "";
    const palette = scale.palette ? ` TO ${scale.palette}` : "";
    const transform = scale.transform ? ` VIA ${scale.transform}` : "";
    const formatter = scale.labelFormat
      ? scale.labelFormat.startsWith("{")
        ? scale.labelFormat
        : ["date", "datetime", "time"].includes(scale.transform ?? "")
          ? `{:time ${scale.labelFormat}}`
          : scale.labelFormat
      : "";
    const renaming = formatter ? `\n  RENAMING * => ${quoteLiteral(formatter)}` : "";
    return `SCALE${type} ${scale.aesthetic}${palette}${transform}${renaming}`;
  }).join("\n");
  const labels = [`title => ${quoteLiteral(draft.title)}`];
  if (draft.subtitle) labels.push(`subtitle => ${quoteLiteral(draft.subtitle)}`);
  for (const [aesthetic, label] of Object.entries(draft.axisLabels)) {
    if (label) labels.push(`${aesthetic} => ${quoteLiteral(label)}`);
  }
  const namedProjections = new Set(["cartesian", "polar", "geographic", "mercator", "orthographic", "natural", "robinson", "mollweide", "albers", "lambert"]);
  const projection = draft.projection
    ? namedProjections.has(draft.projection.toLocaleLowerCase())
      ? `\nPROJECT TO ${draft.projection}`
      : `\nPROJECT TO crs\n  SETTING target => ${quoteLiteral(draft.projection)}`
    : "";

  return `SELECT ${select}\nFROM ${from}${joins ? `\n${joins}` : ""}${where}${groupBy}\nLIMIT ${draft.limit}\n\nVISUALISE\n${visualLayers}${referenceLayers ? `\n${referenceLayers}` : ""}${scales ? `\n${scales}` : ""}\nLABEL ${labels.join(", ")}${projection}`;
}

export function makeDefaultDraft(source = "ggsql:penguins"): GgsqlDraft {
  return {
    source,
    joins: [],
    filters: [],
    groupBy: [],
    aggregation: "none",
    aggregateField: "",
    scenarioDeltas: [],
    referenceRules: [],
    layers: [
      {
        mark: "point",
        x: "bill_len",
        y: "bill_dep",
        lon: "",
        lat: "",
        label: "",
        xEnd: "",
        yEnd: "",
        xMin: "",
        xMax: "",
        yMin: "",
        yMax: "",
        slope: "",
        color: "species",
        fill: "",
        size: "body_mass",
        shape: "",
        linetype: "",
        linewidth: "",
        opacityField: "",
        weight: "",
        geometry: "geometry",
        opacity: 0.9,
        position: "identity",
        colourLegendValue: "",
        fillLegendValue: "",
        fixedColour: "",
        fixedFill: "",
        fixedSize: 0,
        fixedLinewidth: 0,
        fixedLinetype: "",
        fixedFontSize: 0,
        fixedFontWeight: "",
        smoothMethod: "",
        smoothAdjust: 1,
        smoothBandwidth: 0,
        smoothKernel: "",
        place: false,
        literalX: "",
        literalY: "",
        literalXEnd: "",
        literalYEnd: "",
        literalSlope: "",
      },
    ],
    title: "How penguin measurements cluster by species",
    subtitle: "Compare bill measurements and body mass across three penguin species.",
    limit: 5000,
    projection: "",
    tooltipFields: ["species", "island"],
    scales: [],
    axisLabels: { x: "", y: "", colour: "", fill: "", size: "", shape: "", linetype: "", linewidth: "", opacity: "" },
  };
}

export function makeBlankDraft(source = ""): GgsqlDraft {
  const draft = makeDefaultDraft(source);
  draft.layers = [{
    ...draft.layers[0]!,
    x: "",
    y: "",
    color: "",
    fill: "",
    size: "",
    geometry: "",
  }];
  draft.title = "";
  draft.subtitle = "";
  draft.tooltipFields = [];
  draft.scales = [];
  draft.axisLabels = { x: "", y: "", colour: "", fill: "", size: "", shape: "", linetype: "", linewidth: "", opacity: "" };
  return draft;
}

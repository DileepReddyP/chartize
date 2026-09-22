import { z } from "zod";

export const VISUALIZATION_TIP_TOPICS = [
  "endpoint-labels",
  "event-annotations",
  "layered-series",
  "dense-labels",
  "maps",
  "semantic-color",
  "uncertainty",
  "scales-and-formatting",
  "facets",
  "statistical-layers",
  "local-data-cleanup",
] as const;

export type VisualizationTipTopic = typeof VISUALIZATION_TIP_TOPICS[number];

export const VisualizationTipsArgumentsSchema = z.object({
  topics: z.array(z.enum(VISUALIZATION_TIP_TOPICS)).min(1).max(4),
});

interface VisualizationTip {
  topic: VisualizationTipTopic;
  rules: string[];
  recipe: string;
}

export const GGSQL_OFFICIAL_REFERENCE = {
  version: "0.4.1",
  index: "https://ggsql.org/llms.txt",
  summary: [
    "A Chartize query is browser SQL followed by VISUALISE. Put data transformations in SELECT/WITH, alias computed values, and map only returned columns.",
    "DRAW creates data-driven layers with MAPPING; PLACE creates literal annotation layers with SETTING and no MAPPING.",
    "Layer order is paint order. Draw broad areas/ribbons first, marks next, and rules/text last.",
    "Supported scale transforms include date and log. Palette names are unquoted identifiers; formatter values use GGSQL forms such as '{:time %b %Y}' and '{:num %.1f}%'.",
    "LABEL names titles, subtitles, axes, and legends. PROJECT follows drawing, scales, facets, and labels; Albers maps may set origin and parallels.",
    "Text needs a position and label. Its offset is a scalar or two-number tuple, and every usable data row creates a text mark.",
    "Rules need x or y. Use PLACE rule for a literal threshold/event; use DRAW rule only when rule positions come from query rows.",
    "The Chartize browser SQL dialect is SQLite-like: avoid TRY_CAST and DuckDB-only SQL in workspace queries.",
    "Window PARTITION BY and ORDER BY accept unqualified column names only. Compute aggregates, CAST, CASE and other expressions in a preceding CTE, then rank their plain aliases: ROW_NUMBER() OVER (PARTITION BY route ORDER BY missing_flag, score DESC, row_id). Table-qualified names such as l.route also fail here. Check these clauses when the engine reports 'Parse tree contains errors'.",
  ],
} as const;

const VISUALIZATION_TIPS: Record<VisualizationTipTopic, VisualizationTip> = {
  "endpoint-labels": {
    topic: "endpoint-labels",
    rules: [
      "DRAW text emits one mark for every row with usable position and label values. Never map a full-series x/y column and a constant label when the intent is one endpoint label.",
      "For each series, make endpoint x, endpoint y, and endpoint label nullable together and non-null on exactly one row. A useful verification invariant is COUNT_IF(endpoint_label IS NOT NULL) = 1 per series.",
      "For exactly N labels, rank distinct eligible series after the chart's joins and filters, using ROW_NUMBER with a stable tie-breaker. Apply that rank only to the nullable label positions/text, preserving all other marks. RANK can include extra ties.",
      "Direct-label each series in its fixed semantic colour and normally omit the redundant legend. Use hjust, vjust, and an absolute offset for spacing; do not falsify the value merely to move the text.",
      "If several endpoints are close, give their text layers different vertical offsets or label a carefully chosen earlier point. Preserve enough right/top scale room to avoid clipping.",
    ],
    recipe: `WITH prepared AS (
  SELECT *, MAX(date_field) OVER () AS last_date
  FROM source_name
)
SELECT *,
  CASE WHEN date_field = last_date THEN date_field END AS endpoint_x,
  CASE WHEN date_field = last_date THEN observed_value END AS observed_endpoint_y,
  CASE WHEN date_field = last_date THEN 'Observed' END AS observed_endpoint_label
FROM prepared

VISUALISE
DRAW line
  MAPPING date_field AS x, observed_value AS y
  SETTING colour => '#173f5f'
DRAW text
  MAPPING endpoint_x AS x, observed_endpoint_y AS y, observed_endpoint_label AS label
  SETTING colour => '#173f5f', hjust => 'left', vjust => 'middle', offset => (8, -8)

Repeat the three nullable endpoint aliases and one text layer for each additional series.`,
  },
  "event-annotations": {
    topic: "event-annotations",
    rules: [
      "For known literal dates and labels, use PLACE rule and PLACE text. Do not repeat event values across the observation table or manufacture nullable event columns just to annotate a chart.",
      "PLACE has SETTING only and no MAPPING. Repeat a PLACE layer for separately styled events; tuple values are permitted only when each setting has the same length.",
      "Use data-driven nullable event_date/event_y/event_label columns only when annotations genuinely come from query rows. Do not aggregate a multi-event rule layer with max or min, because that collapses the dates.",
      "Keep labels terse and stagger nearby events across genuinely separate vertical bands. A one-unit nudge is not meaningful when the visible y-domain is tens of units wide.",
      "Draw ribbons and data first, then rules, then annotation text so the explanatory layer stays legible.",
    ],
    recipe: `For one known event, keep the chart query unchanged and append:
PLACE rule
  SETTING x => '2025-02-26', colour => '#6f7774', opacity => 0.55, linewidth => 1
PLACE text
  SETTING x => '2025-02-26', y => 49.5, label => 'Feb. 26 · crossover',
    rotation => -35, hjust => 'left', vjust => 'bottom', offset => (5, 5)

When dates/labels are data, project a nullable tuple and use:
DRAW rule
  MAPPING event_date AS x
  SETTING colour => '#6f7774', opacity => 0.55, linewidth => 1
DRAW text
  MAPPING event_date AS x, event_y AS y, event_label AS label
  SETTING rotation => -35, hjust => 'left', vjust => 'bottom', offset => (5, 5)`,
  },
  "layered-series": {
    topic: "layered-series",
    rules: [
      "Layer order is visual order: put broad underlays such as ribbons and areas first; then lines/points; then rules and text.",
      "Sort temporal observations in the SQL query. Use separate DRAW line blocks when series need stable fixed colours, linetypes, or distinct endpoint labels.",
      "Use SETTING colour for an exact literal colour. MAPPING 'red' AS colour creates a scaled category named red; it does not guarantee the literal colour red.",
      "Preserve semantic differences: solid for observed values, dashed for hypothetical scenarios, and clearly labeled uncertainty rather than another observed line.",
    ],
    recipe: `DRAW ribbon ...
DRAW line ... SETTING colour => '#173f5f', linewidth => 2.2
DRAW line ... SETTING colour => '#16877d', linetype => 'dashed', linewidth => 1.8
DRAW rule ...
DRAW text ...`,
  },
  "dense-labels": {
    topic: "dense-labels",
    rules: [
      "Treat legibility as correctness. First reduce label cardinality; only then use smaller type, rotation, or offsets.",
      "Direct-label a modest number of important series or features. For dense maps, label selected, extreme, or analytically important features instead of every polygon.",
      "Never place multiple text rows at the same coordinates. Stagger temporal annotations, and use point-on-surface rather than centroids for irregular polygons.",
      "Keep labels short, make the label colour match its series where useful, and leave plot padding on the side toward which labels extend.",
    ],
    recipe: "Use SQL rank/filter/CASE expressions to retain only the intended labels. Verify the number of non-null label rows matches the number of labels requested before returning GGSQL.",
  },
  maps: {
    topic: "maps",
    rules: [
      "Map the WKB geometry alias AS geometry in DRAW spatial and choose a projection centered on the actual data extent.",
      "For polygon labels, calculate ST_PointOnSurface coordinates and map them AS lon and AS lat; x/y is not the overlay coordinate system for a projected map.",
      "Join measures to boundaries using stable geographic identifiers, preserve leading zeroes, and avoid accidentally mapping geometry metadata such as ALAND.",
      "Signed change should use a diverging scale; unsigned magnitude should use a perceptually ordered sequential scale.",
    ],
    recipe: `DRAW spatial
  MAPPING geometry AS geometry, measure AS fill
DRAW text
  MAPPING label_lon AS lon, label_lat AS lat, display_label AS label
PROJECT TO albers
  SETTING origin => (-96, 37.5), parallel => (29.5, 45.5)`,
  },
  "semantic-color": {
    topic: "semantic-color",
    rules: [
      "Use colour to encode meaning consistently. Positive change defaults to teal/green or blue-green, negative change to red, and a neutral midpoint to pale yellow or grey.",
      "Use SETTING colour/fill for exact literals; use MAPPING plus SCALE when colour represents data and should produce a legend.",
      "Keep observed and hypothetical series visually distinct with both colour and linetype; never rely on red/green alone when another channel is available.",
      "Do not create a legend merely to repeat direct endpoint labels.",
    ],
    recipe: "Use SCALE CONTINUOUS fill TO RdYlGn for signed red–yellow–green fills, or stable fixed SETTING colours on separate line layers for direct-labeled comparison series.",
  },
  uncertainty: {
    topic: "uncertainty",
    rules: [
      "Draw a confidence ribbon behind its estimate line with x, ymin, and ymax; keep its opacity low enough that the line remains primary.",
      "An interval for one series is not automatically an interval for a difference, crossover, forecast, or causal effect.",
      "Use range for discrete intervals and ribbon for an ordered sequence of intervals.",
      "Label the interval meaning in the subtitle or legend when it is not obvious from the source.",
    ],
    recipe: `DRAW ribbon
  MAPPING date_field AS x, lower AS ymin, upper AS ymax
  SETTING fill => '#3cbbb1', opacity => 0.18
DRAW line
  MAPPING date_field AS x, estimate AS y
  SETTING colour => '#147d76', linewidth => 2`,
  },
  "scales-and-formatting": {
    topic: "scales-and-formatting",
    rules: [
      "Use the full GGSQL formatter expression, such as '{:time %b %Y}' or '{:num %.1f}%'; do not emit a bare strftime or Vega/d3 format.",
      "Use the same human-readable unit in axes, tooltip values, direct labels, and subtitle.",
      "A DISCRETE fill/colour scale requires a string result column. Cast numeric categories such as year to a VARCHAR alias in SQL and map that alias; never leave the numeric field mapped after this type diagnostic.",
      "Do not force a misleading zero baseline for line charts, but do start magnitude bars at zero unless a clearly disclosed analytical reason says otherwise.",
      "Expand a domain only enough to fit annotations; never change data values to create visual padding.",
    ],
    recipe: `SCALE x VIA date RENAMING * => '{:time %b %Y}'
SCALE y RENAMING * => '{:num %.1f}%'
LABEL x => 'Poll date', y => 'Approval'`,
  },
  facets: {
    topic: "facets",
    rules: [
      "Use small multiples when overlaying would create too many lines or ambiguous labels.",
      "Keep comparable facets on shared scales; use free scales only when magnitude differences would otherwise erase meaningful within-panel variation.",
      "Order facets analytically and keep the number of panels small enough to scan.",
      "A second faceting variable cannot be combined with ncol/nrow settings in the current GGSQL grammar.",
    ],
    recipe: "FACET group_field SETTING ncol => 3, or FACET row_field BY column_field without ncol/nrow.",
  },
  "statistical-layers": {
    topic: "statistical-layers",
    rules: [
      "Use DRAW smooth with numeric x/y: ols for an ordinary linear fit, tls when both axes have measurement error, and nw for a non-parametric smoother.",
      "A fitted line is descriptive unless the design supports causal inference; a smoother is not a forecast.",
      "Show raw points with restrained opacity when sample size permits, then draw the fit above them.",
      "Compute transformations and scenario values in SQL, alias them, and map aliases only—never expressions inside MAPPING.",
    ],
    recipe: `DRAW point
  MAPPING predictor AS x, outcome AS y
  SETTING opacity => 0.28
DRAW smooth
  MAPPING predictor AS x, outcome AS y
  SETTING method => 'ols', colour => '#2a1e5c', linewidth => 2`,
  },
  "local-data-cleanup": {
    topic: "local-data-cleanup",
    rules: [
      "The browser engine uses a compact SQLite-like SQL dialect. Do not use INITCAP, TRY_CAST, CREATE OR REPLACE TABLE, regexp functions, filesystem readers, or DuckDB-only helpers.",
      "Trust the catalog schema and import-time type inference. Do not wrap already-numeric, temporal, or boolean fields in trim/cast cleanup unless an inspection query found malformed values.",
      "Default to a non-mutating WITH/SELECT pipeline. Preview cleanup, imputation, scoring, and modeling in CTEs without creating or dropping a table.",
      "Use workspaceActions for DROP/CREATE TEMP TABLE, INSERT, UPDATE, or DELETE only when the current user explicitly asks to persist or modify a browser-local workspace copy. Building a chart or model alone is not permission to mutate. Never put those statements in the visualization query.",
      "For nullable numeric text, use CAST(NULLIF(NULLIF(LOWER(TRIM(CAST(value AS VARCHAR))), 'null'), '') AS DOUBLE). Inspect values first when an invalid non-null token may exist.",
      "For multi-word title casing, use a recursive character CTE with UPPER(SUBSTR(...)) after position 1, a space, or a hyphen. INITCAP is unavailable; do not add a quote-literal branch unless the source values actually require it.",
      "Stage window calculations in their own CTE, then COALESCE their aliases in the following SELECT. This parser rejects window expressions such as AVG(value) OVER (...) when they are written directly inside COALESCE.",
      "Keep a one-time local action and the visualization separate: the action creates or changes a derived local table; the visualization is one SELECT/WITH statement that reads it and keeps every mapped field in its final projection.",
    ],
    recipe: `WITH RECURSIVE source_rows AS (
  SELECT ROW_NUMBER() OVER () AS row_id,
    LOWER(TRIM(CAST(name AS VARCHAR))) AS name_key,
    CAST(NULLIF(NULLIF(LOWER(TRIM(CAST(value AS VARCHAR))), 'null'), '') AS DOUBLE) AS value
  FROM user:source
),
name_chars(row_id, name_key, pos, name) AS (
  SELECT row_id, name_key, 1, '' FROM source_rows
  UNION ALL
  SELECT row_id, name_key, pos + 1,
    name || CASE
      WHEN pos = 1 OR SUBSTR(name_key, pos - 1, 1) IN (' ', '-') THEN UPPER(SUBSTR(name_key, pos, 1))
      ELSE SUBSTR(name_key, pos, 1)
    END
  FROM name_chars WHERE pos <= LENGTH(name_key)
),
normalized AS (
  SELECT source_rows.*, name_chars.name AS clean_name
  FROM source_rows
  JOIN name_chars ON source_rows.row_id = name_chars.row_id
  WHERE name_chars.pos = LENGTH(name_chars.name_key) + 1
),
with_means AS (
  SELECT *, AVG(value) OVER (PARTITION BY clean_name) AS group_average, AVG(value) OVER () AS overall_average
  FROM normalized
)
SELECT *, COALESCE(value, group_average, overall_average) AS clean_value
FROM with_means`,
  },
};

export function visualizationTipsFor(topics: VisualizationTipTopic[]) {
  return {
    reference: "Chartize cookbook for GGSQL 0.4.1",
    official: GGSQL_OFFICIAL_REFERENCE,
    tips: [...new Set(topics)].map((topic) => VISUALIZATION_TIPS[topic]),
  };
}

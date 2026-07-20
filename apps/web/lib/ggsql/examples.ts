import type { ExecutionMode } from "@/lib/workspace/store";

export interface VisualizationExample {
  id: string;
  category: "quick" | "range" | "map" | "model" | "linked" | "playful";
  title: string;
  description: string;
  source: string;
  mode: ExecutionMode;
  tags: string[];
  query: string;
}

export const VISUALIZATION_EXAMPLES: VisualizationExample[] = [
  {
    id: "approval-simple",
    category: "quick",
    title: "trump approval · one line",
    description: "A minimal temporal line with readable dates and axis labels.",
    source: "chartize:presidential_approval_average",
    mode: "warehouse",
    tags: ["line", "time", "starter"],
    query: `SELECT "end_date", "approve"
FROM chartize:presidential_approval_average
LIMIT 5000

VISUALISE
DRAW line
  MAPPING "end_date" AS x, "approve" AS y
  SETTING color => '#3cbbb1', linewidth => 2
SCALE x VIA date
  RENAMING * => '{:time %B %-d, %Y}'
LABEL title => 'Presidential approval, daily average', subtitle => 'daily modeled average · second presidential term', x => 'Poll Date', y => 'Approval'`,
  },
  {
    id: "approval-uncertainty",
    category: "range",
    title: "approval · interval + opposition",
    description: "Two series, an approval confidence ribbon, and a 50% reference line.",
    source: "chartize:presidential_approval_average",
    mode: "warehouse",
    tags: ["ribbon", "layers", "uncertainty"],
    query: `SELECT "end_date", "approve", "disapprove", "approve_lower_ci", "approve_upper_ci", 50 AS "majority"
FROM chartize:presidential_approval_average
LIMIT 5000

VISUALISE
DRAW ribbon
  MAPPING "end_date" AS x, "approve_lower_ci" AS ymin, "approve_upper_ci" AS ymax
  SETTING fill => '#3cbbb1', opacity => 0.18
DRAW line
  MAPPING "end_date" AS x, "approve" AS y, 'Approval' AS colour
  SETTING linewidth => 2
DRAW line
  MAPPING "end_date" AS x, "disapprove" AS y, 'Disapproval' AS colour
  SETTING linewidth => 2
DRAW rule
  MAPPING "majority" AS y
  SETTING aggregate => 'max', color => '#596662', linetype => 'dashed'
SCALE x VIA date
  RENAMING * => '{:time %B %-d, %Y}'
SCALE DISCRETE colour TO tableau10
LABEL title => 'approval, disapproval + uncertainty', subtitle => 'daily average with approval confidence interval and majority threshold', x => 'Poll Date', y => 'Share', colour => 'Series'`,
  },
  {
    id: "generic-ballot-bands",
    category: "range",
    title: "generic ballot · competing bands",
    description: "Democratic and Republican averages with separate confidence ribbons.",
    source: "chartize:generic_ballot_average",
    mode: "warehouse",
    tags: ["ribbon", "polls", "multi-layer"],
    query: `SELECT "end_date", "dem", "rep", "dem_lower_ci", "dem_upper_ci", "rep_lower_ci", "rep_upper_ci"
FROM chartize:generic_ballot_average
LIMIT 5000

VISUALISE
DRAW ribbon
  MAPPING "end_date" AS x, "dem_lower_ci" AS ymin, "dem_upper_ci" AS ymax
  SETTING fill => '#3cbbb1', opacity => 0.16
DRAW ribbon
  MAPPING "end_date" AS x, "rep_lower_ci" AS ymin, "rep_upper_ci" AS ymax
  SETTING fill => '#ee4266', opacity => 0.12
DRAW line
  MAPPING "end_date" AS x, "dem" AS y, 'Democratic' AS colour
  SETTING linewidth => 2
DRAW line
  MAPPING "end_date" AS x, "rep" AS y, 'Republican' AS colour
  SETTING linewidth => 2
SCALE x VIA date
  RENAMING * => '{:time %B %-d, %Y}'
SCALE DISCRETE colour TO tableau10
LABEL title => 'generic ballot with uncertainty', subtitle => 'daily party averages and confidence intervals', x => 'Poll Date', y => 'Support', colour => 'Party'`,
  },
  {
    id: "county-regression",
    category: "model",
    title: "county population · OLS fit",
    description: "A ggpredict-style fitted relationship using the model GGSQL actually supports.",
    source: "chartize:county_population_2025",
    mode: "warehouse",
    tags: ["regression", "smooth", "log scale"],
    query: `SELECT "POPESTIMATE2020", "POPESTIMATE2025", "STNAME", "CTYNAME"
FROM chartize:county_population_2025
WHERE "SUMLEV" = '050' AND "POPESTIMATE2020" > 1000
LIMIT 5000

VISUALISE
DRAW point
  MAPPING "POPESTIMATE2020" AS x, "POPESTIMATE2025" AS y
  SETTING color => '#3cbbb1', opacity => 0.22
DRAW smooth
  MAPPING "POPESTIMATE2020" AS x, "POPESTIMATE2025" AS y
  SETTING method => 'ols', color => '#2a1e5c', linewidth => 2
SCALE x VIA log10
SCALE y VIA log10
LABEL title => 'county population: 2020 vs 2025', subtitle => 'descriptive OLS fit on log-scaled axes — not a forecast', x => '2020 population', y => '2025 population'`,
  },
  {
    id: "approval-scenario",
    category: "model",
    title: "approval · hypothetical delta",
    description: "Observed approval beside an explicitly labeled +3-point scenario.",
    source: "chartize:presidential_approval_average",
    mode: "warehouse",
    tags: ["scenario", "delta", "layers"],
    query: `SELECT "end_date", "approve", "approve" + 3 AS "approve_plus_3", 50 AS "majority"
FROM chartize:presidential_approval_average
LIMIT 5000

VISUALISE
DRAW line
  MAPPING "end_date" AS x, "approve" AS y, 'Observed approval' AS colour
  SETTING linewidth => 2
DRAW line
  MAPPING "end_date" AS x, "approve_plus_3" AS y, 'Hypothetical +3 points' AS colour
  SETTING linewidth => 2, linetype => 'dashed'
DRAW rule
  MAPPING "majority" AS y
  SETTING aggregate => 'max', color => '#596662', linetype => 'dotted'
SCALE x VIA date
  RENAMING * => '{:time %B %-d, %Y}'
SCALE DISCRETE colour TO tableau10
LABEL title => 'approval with hypothetical +3-point scenario', subtitle => 'scenario only — not observed data or a forecast', x => 'Poll Date', y => 'Approval', colour => 'Series'`,
  },
  {
    id: "county-population-map",
    category: "map",
    title: "county map · population",
    description: "A joined county choropleth with a log-scaled sequential palette.",
    source: "chartize:us_counties_2025",
    mode: "warehouse",
    tags: ["map", "join", "choropleth"],
    query: `SELECT b."geometry" AS "geometry", p."POPESTIMATE2025" AS "population", p."CTYNAME" AS "county", p."STNAME" AS "state"
FROM chartize:us_counties_2025 AS b
JOIN chartize:county_population_2025 AS p
  ON b."STATEFP" = p."STATE" AND b."COUNTYFP" = p."COUNTY"
WHERE p."SUMLEV" = '050'
LIMIT 4000

VISUALISE
DRAW spatial
  MAPPING "geometry" AS geometry, "population" AS fill
SCALE CONTINUOUS fill TO viridis VIA log10
LABEL title => 'county population, 2025', subtitle => 'population estimates joined to cartographic county boundaries', fill => '2025 population'
PROJECT TO albers
  SETTING origin => (-96, 37.5), parallel => (29.5, 45.5)`,
  },
  {
    id: "county-change-map",
    category: "map",
    title: "county map · population change",
    description: "A diverging choropleth of percent change from 2020 to 2025.",
    source: "chartize:us_counties_2025",
    mode: "warehouse",
    tags: ["map", "computed field", "diverging"],
    query: `SELECT b."geometry" AS "geometry",
  100.0 * (p."POPESTIMATE2025" - p."POPESTIMATE2020") / NULLIF(p."POPESTIMATE2020", 0) AS "population_change",
  p."CTYNAME" AS "county", p."STNAME" AS "state"
FROM chartize:us_counties_2025 AS b
JOIN chartize:county_population_2025 AS p
  ON b."STATEFP" = p."STATE" AND b."COUNTYFP" = p."COUNTY"
WHERE p."SUMLEV" = '050' AND p."POPESTIMATE2020" > 0
LIMIT 4000

VISUALISE
DRAW spatial
  MAPPING "geometry" AS geometry, "population_change" AS fill
SCALE CONTINUOUS fill TO vik
LABEL title => 'county population change, 2020–2025', subtitle => 'estimated percent change; diverging color separates growth from decline', fill => 'Change (%)'
PROJECT TO albers
  SETTING origin => (-96, 37.5), parallel => (29.5, 45.5)`,
  },
  {
    id: "county-smoking-map",
    category: "map",
    title: "county map · smoking prevalence",
    description: "CDC age-adjusted smoking estimates joined to Census county shapes.",
    source: "chartize:us_counties_2025",
    mode: "warehouse",
    tags: ["CDC PLACES", "join", "health"],
    query: `SELECT b."geometry" AS "geometry", h."data_value" AS "smoking", h."locationname" AS "county", h."stateabbr" AS "state"
FROM chartize:us_counties_2025 AS b
JOIN chartize:cdc_places_county_2025 AS h ON b."GEOID" = h."locationid"
WHERE h."measureid" = 'CSMOKING' AND h."datavaluetypeid" = 'AgeAdjPrv'
LIMIT 4000

VISUALISE
DRAW spatial
  MAPPING "geometry" AS geometry, "smoking" AS fill
SCALE CONTINUOUS fill TO viridis
LABEL title => 'adult smoking prevalence by county', subtitle => 'CDC PLACES 2025 release · age-adjusted modeled estimates', fill => 'Smoking (%)'
PROJECT TO albers
  SETTING origin => (-96, 37.5), parallel => (29.5, 45.5)`,
  },
  {
    id: "population-obesity-link",
    category: "linked",
    title: "population × obesity",
    description: "Join Census population estimates to CDC obesity prevalence and fit a descriptive trend.",
    source: "chartize:county_population_2025",
    mode: "warehouse",
    tags: ["Census + CDC", "join", "smooth"],
    query: `SELECT p."POPESTIMATE2025" AS "population", h."data_value" AS "obesity", p."CTYNAME" AS "county", p."STNAME" AS "state"
FROM chartize:county_population_2025 AS p
JOIN chartize:cdc_places_county_2025 AS h ON p."STATE" || p."COUNTY" = h."locationid"
WHERE p."SUMLEV" = '050' AND p."POPESTIMATE2025" > 0
  AND h."measureid" = 'OBESITY' AND h."datavaluetypeid" = 'AgeAdjPrv'
LIMIT 5000

VISUALISE
DRAW point
  MAPPING "population" AS x, "obesity" AS y
  SETTING color => '#3cbbb1', opacity => 0.24
DRAW smooth
  MAPPING "population" AS x, "obesity" AS y
  SETTING method => 'ols', color => '#2a1e5c', linewidth => 2
SCALE x VIA log10
LABEL title => 'county population × adult obesity', subtitle => 'descriptive association using Census 2025 population and CDC PLACES · not causal', x => '2025 population', y => 'Obesity prevalence (%)'`,
  },
  {
    id: "income-obesity-link",
    category: "linked",
    title: "income × obesity",
    description: "Relate BEA per-capita income to CDC obesity estimates across counties.",
    source: "chartize:bea_county_personal_income",
    mode: "warehouse",
    tags: ["BEA + CDC", "join", "regression"],
    query: `SELECT TRY_CAST(REPLACE(i."2024", ',', '') AS DOUBLE) AS "per_capita_income",
  h."data_value" AS "obesity", h."locationname" AS "county", h."stateabbr" AS "state"
FROM chartize:bea_county_personal_income AS i
JOIN chartize:cdc_places_county_2025 AS h ON trim(i."GeoFIPS") = h."locationid"
WHERE i."LineCode" = 3 AND h."measureid" = 'OBESITY'
  AND h."datavaluetypeid" = 'AgeAdjPrv' AND TRY_CAST(REPLACE(i."2024", ',', '') AS DOUBLE) > 0
LIMIT 5000

VISUALISE
DRAW point
  MAPPING "per_capita_income" AS x, "obesity" AS y
  SETTING color => '#3cbbb1', opacity => 0.26
DRAW smooth
  MAPPING "per_capita_income" AS x, "obesity" AS y
  SETTING method => 'ols', color => '#2a1e5c', linewidth => 2
LABEL title => 'income × adult obesity', subtitle => 'BEA 2024 per-capita income joined to CDC PLACES · descriptive, not causal', x => 'Per-capita personal income ($)', y => 'Obesity prevalence (%)'`,
  },
  {
    id: "county-income-map",
    category: "map",
    title: "county map · personal income",
    description: "Official BEA per-capita income joined to Census county boundaries.",
    source: "chartize:us_counties_2025",
    mode: "warehouse",
    tags: ["BEA + Census", "economy", "choropleth"],
    query: `SELECT b."geometry" AS "geometry", TRY_CAST(REPLACE(i."2024", ',', '') AS DOUBLE) AS "income",
  i."GeoName" AS "county"
FROM chartize:us_counties_2025 AS b
JOIN chartize:bea_county_personal_income AS i ON b."GEOID" = trim(i."GeoFIPS")
WHERE i."LineCode" = 3 AND TRY_CAST(REPLACE(i."2024", ',', '') AS DOUBLE) > 0
LIMIT 4000

VISUALISE
DRAW spatial
  MAPPING "geometry" AS geometry, "income" AS fill
SCALE CONTINUOUS fill TO viridis
LABEL title => 'per-capita personal income, 2024', subtitle => 'BEA CAINC1 joined to 2025 Census cartographic boundaries', fill => 'Income ($)'
PROJECT TO albers
  SETTING origin => (-96, 37.5), parallel => (29.5, 45.5)`,
  },
  {
    id: "county-real-gdp-change-map",
    category: "map",
    title: "county map · real GDP change",
    description: "Compare inflation-adjusted county output in 2019 and 2024.",
    source: "chartize:us_counties_2025",
    mode: "warehouse",
    tags: ["BEA + Census", "change", "diverging"],
    query: `SELECT b."geometry" AS "geometry", g."GeoName" AS "county",
  100.0 * (TRY_CAST(REPLACE(g."2024", ',', '') AS DOUBLE) - TRY_CAST(REPLACE(g."2019", ',', '') AS DOUBLE))
    / NULLIF(TRY_CAST(REPLACE(g."2019", ',', '') AS DOUBLE), 0) AS "real_gdp_change"
FROM chartize:us_counties_2025 AS b
JOIN chartize:bea_county_gdp AS g ON b."GEOID" = trim(g."GeoFIPS")
WHERE g."LineCode" = 1 AND TRY_CAST(REPLACE(g."2019", ',', '') AS DOUBLE) > 0
LIMIT 4000

VISUALISE
DRAW spatial
  MAPPING "geometry" AS geometry, "real_gdp_change" AS fill
SCALE CONTINUOUS fill TO vik
LABEL title => 'real county GDP change, 2019–2024', subtitle => 'inflation-adjusted BEA CAGDP1 estimates', fill => 'Change (%)'
PROJECT TO albers
  SETTING origin => (-96, 37.5), parallel => (29.5, 45.5)`,
  },
  {
    id: "sleepy-big-counties",
    category: "playful",
    title: "do big counties ever sleep?",
    description: "A playful—but still honest—look at population and insufficient sleep.",
    source: "chartize:cdc_places_county_2025",
    mode: "warehouse",
    tags: ["CDC PLACES", "playful", "not causal"],
    query: `SELECT "totalpopulation" AS "population", "data_value" AS "insufficient_sleep", "locationname" AS "county", "stateabbr" AS "state"
FROM chartize:cdc_places_county_2025
WHERE "measureid" = 'SLEEP' AND "datavaluetypeid" = 'AgeAdjPrv' AND "totalpopulation" > 0
LIMIT 5000

VISUALISE
DRAW point
  MAPPING "population" AS x, "insufficient_sleep" AS y
  SETTING color => '#ee4266', opacity => 0.2
DRAW smooth
  MAPPING "population" AS x, "insufficient_sleep" AS y
  SETTING method => 'ols', color => '#2a1e5c', linewidth => 2
SCALE x VIA log10
LABEL title => 'do big counties ever sleep?', subtitle => 'population versus insufficient sleep · a descriptive joke, emphatically not causation', x => 'County population', y => 'Insufficient sleep (%)'`,
  },
  {
    id: "penguins-campaign-trail",
    category: "playful",
    title: "penguins on the campaign trail",
    description: "The browser-only sample, dressed up as an entirely unserious field operation.",
    source: "ggsql:penguins",
    mode: "local",
    tags: ["private browser", "penguins", "joke"],
    query: `SELECT "bill_len", "body_mass", "species", "island"
FROM ggsql:penguins
LIMIT 1000

VISUALISE
DRAW point
  MAPPING "bill_len" AS x, "body_mass" AS y, "species" AS colour
  SETTING opacity => 0.7
SCALE DISCRETE colour TO tableau10
LABEL title => 'penguins on the campaign trail', subtitle => 'body mass versus bill length · no electoral inference permitted', x => 'Bill length', y => 'Body mass', colour => 'Candidate species'`,
  },
];

export const EXAMPLE_CATEGORIES: Array<{ id: VisualizationExample["category"]; title: string; description: string }> = [
  { id: "quick", title: "quick starts", description: "small, legible first charts" },
  { id: "range", title: "ranges + uncertainty", description: "bands, intervals, and comparison lines" },
  { id: "map", title: "maps", description: "spatial joins and choropleths" },
  { id: "model", title: "models + scenarios", description: "fits, deltas, and counterfactuals" },
  { id: "linked", title: "linked sources", description: "questions spanning warehouse tables" },
  { id: "playful", title: "playful", description: "valid charts with less-serious premises" },
];

import type { ExecutionMode } from "@/lib/workspace/store";

export interface VisualizationExample {
  id: string;
  title: string;
  description: string;
  source: string;
  mode: ExecutionMode;
  tags: string[];
  query: string;
}

export const VISUALIZATION_EXAMPLES: VisualizationExample[] = [
  {
    id: "approval-uncertainty",
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
PROJECT TO albers`,
  },
  {
    id: "county-change-map",
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
PROJECT TO albers`,
  },
];

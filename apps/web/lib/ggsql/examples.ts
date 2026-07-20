export interface VisualizationExample {
  id: string;
  category: "quick" | "range" | "map" | "model" | "linked" | "transit" | "climate" | "composition";
  title: string;
  description: string;
  source: string;
  tags: string[];
  query: string;
}

export const VISUALIZATION_EXAMPLES: VisualizationExample[] = [
  {
    id: "approval-simple",
    category: "quick",
    title: "presidential approval · one line",
    description: "A minimal temporal line with readable dates and axis labels.",
    source: "chartize:presidential_approval_average",
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
    tags: ["ribbon", "layers", "uncertainty"],
    query: `SELECT "end_date", "approve", "disapprove", "approve_lower_ci", "approve_upper_ci", 50 AS "majority"
FROM chartize:presidential_approval_average
LIMIT 5000

VISUALISE
DRAW ribbon
  MAPPING "end_date" AS x, "approve_lower_ci" AS ymin, "approve_upper_ci" AS ymax
  SETTING fill => '#3cbbb1', opacity => 0.18
DRAW line
  MAPPING "end_date" AS x, "approve" AS y
  SETTING colour => '#16877d', linewidth => 2
DRAW line
  MAPPING "end_date" AS x, "disapprove" AS y
  SETTING colour => '#c44e52', linewidth => 2
DRAW rule
  MAPPING "majority" AS y
  SETTING aggregate => 'max', color => '#596662', linetype => 'dashed'
SCALE x VIA date
  RENAMING * => '{:time %B %-d, %Y}'
LABEL title => 'approval, disapproval + uncertainty', subtitle => 'approval in teal · disapproval in red · approval uncertainty shown as a band', x => 'Poll Date', y => 'Share'`,
  },
  {
    id: "generic-ballot-bands",
    category: "range",
    title: "generic ballot · competing bands",
    description: "Democratic and Republican averages with separate confidence ribbons.",
    source: "chartize:generic_ballot_average",
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
  MAPPING "end_date" AS x, "dem" AS y
  SETTING colour => '#3976c6', linewidth => 2
DRAW line
  MAPPING "end_date" AS x, "rep" AS y
  SETTING colour => '#d34d5f', linewidth => 2
SCALE x VIA date
  RENAMING * => '{:time %B %-d, %Y}'
LABEL title => 'generic ballot with uncertainty', subtitle => 'Democratic average in blue · Republican average in red · confidence intervals shown as bands', x => 'Poll Date', y => 'Support'`,
  },
  {
    id: "county-regression",
    category: "model",
    title: "county population · OLS fit",
    description: "A ggpredict-style fitted relationship using the model GGSQL actually supports.",
    source: "chartize:county_population_2025",
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
SCALE x VIA log
SCALE y VIA log
LABEL title => 'county population: 2020 vs 2025', subtitle => 'descriptive OLS fit on log-scaled axes — not a forecast', x => '2020 population', y => '2025 population'`,
  },
  {
    id: "approval-scenario",
    category: "model",
    title: "approval · hypothetical delta",
    description: "Observed approval beside an explicitly labeled +3-point scenario.",
    source: "chartize:presidential_approval_average",
    tags: ["scenario", "delta", "layers"],
    query: `SELECT "end_date", "approve", "approve" + 3 AS "approve_plus_3", 50 AS "majority"
FROM chartize:presidential_approval_average
LIMIT 5000

VISUALISE
DRAW line
  MAPPING "end_date" AS x, "approve" AS y
  SETTING colour => '#16877d', linewidth => 2
DRAW line
  MAPPING "end_date" AS x, "approve_plus_3" AS y
  SETTING colour => '#2a1e5c', linewidth => 2, linetype => 'dashed'
DRAW rule
  MAPPING "majority" AS y
  SETTING aggregate => 'max', color => '#596662', linetype => 'dotted'
SCALE x VIA date
  RENAMING * => '{:time %B %-d, %Y}'
LABEL title => 'approval with hypothetical +3-point scenario', subtitle => 'observed in teal · hypothetical in dashed amethyst · scenario only, not a forecast', x => 'Poll Date', y => 'Approval'`,
  },
  {
    id: "county-population-map",
    category: "map",
    title: "county map · population",
    description: "A joined county choropleth with a log-scaled sequential palette.",
    source: "chartize:us_counties_2025",
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
SCALE CONTINUOUS fill TO viridis VIA log
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
SCALE CONTINUOUS fill TO RdYlGn
LABEL title => 'county population change, 2020–2025', subtitle => 'red decline · yellow little change · green growth', fill => 'Change (%)'
PROJECT TO albers
  SETTING origin => (-96, 37.5), parallel => (29.5, 45.5)`,
  },
  {
    id: "county-smoking-map",
    category: "map",
    title: "county map · smoking prevalence",
    description: "CDC age-adjusted smoking estimates joined to Census county shapes.",
    source: "chartize:us_counties_2025",
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
SCALE x VIA log
LABEL title => 'county population × adult obesity', subtitle => 'descriptive OLS overlay on a log population axis · Census + CDC PLACES · not causal', x => '2025 population', y => 'Obesity prevalence (%)'`,
  },
  {
    id: "income-obesity-link",
    category: "linked",
    title: "income × obesity",
    description: "Relate BEA per-capita income to CDC obesity estimates across counties.",
    source: "chartize:bea_county_personal_income",
    tags: ["BEA + CDC", "join", "regression"],
    query: `SELECT CAST(REPLACE(i."2024", ',', '') AS DOUBLE) AS "per_capita_income",
  h."data_value" AS "obesity", h."locationname" AS "county", h."stateabbr" AS "state"
FROM chartize:bea_county_personal_income AS i
JOIN chartize:cdc_places_county_2025 AS h ON trim(i."GeoFIPS") = h."locationid"
WHERE i."LineCode" = 3 AND h."measureid" = 'OBESITY'
  AND h."datavaluetypeid" = 'AgeAdjPrv' AND CAST(REPLACE(i."2024", ',', '') AS DOUBLE) > 0
LIMIT 5000

VISUALISE
DRAW point
  MAPPING "per_capita_income" AS x, "obesity" AS y
  SETTING color => '#3cbbb1', opacity => 0.26
DRAW smooth
  MAPPING "per_capita_income" AS x, "obesity" AS y
  SETTING method => 'ols', color => '#2a1e5c', linewidth => 2
SCALE x VIA log
LABEL title => 'income × adult obesity', subtitle => 'descriptive OLS overlay on a log income axis · BEA + CDC PLACES · not causal', x => 'Per-capita personal income ($)', y => 'Obesity prevalence (%)'`,
  },
  {
    id: "county-income-map",
    category: "map",
    title: "county map · personal income",
    description: "Official BEA per-capita income joined to Census county boundaries.",
    source: "chartize:us_counties_2025",
    tags: ["BEA + Census", "economy", "choropleth"],
    query: `SELECT b."geometry" AS "geometry", CAST(REPLACE(i."2024", ',', '') AS DOUBLE) AS "income",
  i."GeoName" AS "county"
FROM chartize:us_counties_2025 AS b
JOIN chartize:bea_county_personal_income AS i ON b."GEOID" = trim(i."GeoFIPS")
WHERE i."LineCode" = 3 AND CAST(REPLACE(i."2024", ',', '') AS DOUBLE) > 0
LIMIT 4000

VISUALISE
DRAW spatial
  MAPPING "geometry" AS geometry, "income" AS fill
SCALE CONTINUOUS fill TO viridis VIA log
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
    tags: ["BEA + Census", "change", "diverging"],
    query: `SELECT b."geometry" AS "geometry", g."GeoName" AS "county",
  100.0 * (CAST(REPLACE(g."2024", ',', '') AS DOUBLE) - CAST(REPLACE(g."2019", ',', '') AS DOUBLE))
    / NULLIF(CAST(REPLACE(g."2019", ',', '') AS DOUBLE), 0) AS "real_gdp_change"
FROM chartize:us_counties_2025 AS b
JOIN chartize:bea_county_gdp AS g ON b."GEOID" = trim(g."GeoFIPS")
WHERE g."LineCode" = 1 AND CAST(REPLACE(g."2019", ',', '') AS DOUBLE) > 0
LIMIT 4000

VISUALISE
DRAW spatial
  MAPPING "geometry" AS geometry, "real_gdp_change" AS fill
SCALE CONTINUOUS fill TO RdYlGn
LABEL title => 'real county GDP change, 2019–2024', subtitle => 'red decline · yellow little change · green growth · inflation-adjusted BEA estimates', fill => 'Change (%)'
PROJECT TO albers
  SETTING origin => (-96, 37.5), parallel => (29.5, 45.5)`,
  },
  {
    id: "mta-route-delay-map",
    category: "transit",
    title: "subway map · customer delay",
    description: "Join passenger-weighted route delay to official MTA service-line geometry.",
    source: "chartize:mta_subway_service_lines",
    tags: ["MTA", "map", "weighted join"],
    query: `WITH route_delay AS (
  SELECT "line" AS "route",
    SUM("num_passengers" * ("additional_platform_time" + "additional_train_time"))
      / NULLIF(SUM("num_passengers"), 0) AS "extra_minutes",
    SUM("num_passengers") / 1000000.0 AS "passenger_millions"
  FROM chartize:mta_subway_journey_metrics_2024_2025
  WHERE "month" >= '2025-01-01' AND "month" < '2026-01-01' AND "period" = 'peak'
  GROUP BY "line"
)
SELECT l."geometry" AS "geometry", l."service" AS "route", l."service_name" AS "service_name",
  d."extra_minutes" AS "extra_minutes", d."passenger_millions" AS "passenger_millions"
FROM chartize:mta_subway_service_lines AS l
JOIN route_delay AS d ON l."service" = d."route"

VISUALISE
DRAW spatial
  MAPPING "geometry" AS geometry FROM chartize:nyc_borough_boundaries
  SETTING fill => '#f4f6f5', stroke => '#c4cbca', linewidth => 0.8
DRAW spatial
  MAPPING "geometry" AS geometry, "extra_minutes" AS stroke, "passenger_millions" AS linewidth
  SETTING fill => null
SCALE CONTINUOUS stroke TO ylorrd
SCALE CONTINUOUS linewidth TO (1.2, 6)
LABEL title => 'where peak subway trips lose time', subtitle => '2025 passenger-weighted extra platform + train minutes · line width reflects ridership', stroke => 'Extra minutes', linewidth => 'Million riders'
PROJECT TO mercator`,
  },
  {
    id: "mta-route-delay-heatmap",
    category: "transit",
    title: "subway delay · route × month",
    description: "A 24-month route heatmap weighted by the passengers exposed to each delay.",
    source: "chartize:mta_subway_journey_metrics_2024_2025",
    tags: ["MTA", "tile", "weighted metric"],
    query: `SELECT strftime('%Y-%m', "month") AS "month_label", "line" AS "route",
  SUM("num_passengers" * ("additional_platform_time" + "additional_train_time"))
    / NULLIF(SUM("num_passengers"), 0) AS "extra_minutes"
FROM chartize:mta_subway_journey_metrics_2024_2025
WHERE "period" = 'peak'
GROUP BY "month_label", "line"
ORDER BY "month_label", "line"

VISUALISE
DRAW tile
  MAPPING "month_label" AS x, "route" AS y, "extra_minutes" AS fill
  SETTING stroke => '#f4f6f5', linewidth => 0.5
SCALE CONTINUOUS fill TO ylorrd
LABEL title => 'peak subway delay by route', subtitle => 'passenger-weighted extra platform + train minutes · 2024–2025', x => 'Month', y => 'Route', fill => 'Delay (min)'`,
  },
  {
    id: "mta-station-accessibility-map",
    category: "transit",
    title: "subway stations · step-free access",
    description: "Explore the official station points with ADA status as a categorical layer.",
    source: "chartize:mta_subway_stations",
    tags: ["MTA", "stations", "accessibility"],
    query: `SELECT "geometry" AS "geometry", "stop_name" AS "station", "borough" AS "borough",
  "daytime_routes" AS "routes", CASE WHEN "ada" = '1' THEN 'ADA accessible' ELSE 'Not fully ADA accessible' END AS "access_status"
FROM chartize:mta_subway_stations

VISUALISE
DRAW spatial
  MAPPING "geometry" AS geometry, "access_status" AS fill
  SETTING stroke => '#ffffff', linewidth => 0.5, opacity => 0.9
SCALE DISCRETE fill FROM ('ADA accessible', 'Not fully ADA accessible') TO ('#3cbbb1', '#c4cbca')
LABEL title => 'step-free access across subway stations', subtitle => 'official MTA station inventory · connected station complexes may contain multiple points', fill => 'Station status'
PROJECT TO mercator`,
  },
  {
    id: "june-temperature-heatmap",
    category: "climate",
    title: "June 2026 · calendar temperatures",
    description: "Read Central Park's June weather as a familiar Sunday-to-Saturday calendar.",
    source: "chartize:nyc_central_park_weather_2024_2026",
    tags: ["NOAA", "tile", "calendar"],
    query: `WITH june AS (
  SELECT CAST(strftime('%d', "DATE") AS INTEGER) AS "day_of_month",
    CASE strftime('%w', "DATE")
      WHEN '0' THEN 'Sun' WHEN '1' THEN 'Mon' WHEN '2' THEN 'Tue' WHEN '3' THEN 'Wed'
      WHEN '4' THEN 'Thu' WHEN '5' THEN 'Fri' ELSE 'Sat' END AS "weekday",
    1 + CAST(CAST(strftime('%d', "DATE") AS INTEGER) / 7 AS INTEGER) AS "week_number",
    (CAST("TMAX" AS DOUBLE) + CAST("TMIN" AS DOUBLE)) / 2.0 AS "daily_midpoint_c",
    CAST("TMAX" AS DOUBLE) AS "high_c", CAST("TMIN" AS DOUBLE) AS "low_c"
  FROM chartize:nyc_central_park_weather_2024_2026
  WHERE strftime('%Y-%m', "DATE") = '2026-06' AND "TMAX" IS NOT NULL AND "TMIN" IS NOT NULL
)
SELECT 'June ' || "day_of_month" || ', 2026' AS "date_label", "day_of_month",
  "weekday", 'week ' || "week_number" AS "calendar_week",
  "daily_midpoint_c", "high_c", "low_c"
FROM june
ORDER BY "week_number", "day_of_month"

VISUALISE
DRAW tile
  MAPPING "weekday" AS x, "calendar_week" AS y, "daily_midpoint_c" AS fill
  SETTING stroke => '#ffffff', linewidth => 2
DRAW text
  MAPPING "weekday" AS x, "calendar_week" AS y, "day_of_month" AS label
  SETTING colour => '#0a0f0d', fontsize => 10, fontweight => 'bold'
SCALE DISCRETE x FROM ('Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat')
SCALE DISCRETE y FROM ('week 1', 'week 2', 'week 3', 'week 4', 'week 5')
SCALE CONTINUOUS fill TO inferno
LABEL title => 'June 2026, day by day', subtitle => 'Central Park daily midpoint of NOAA maximum and minimum temperature', x => 'Day of week', y => null, fill => 'Midpoint (°C)'`,
  },
  {
    id: "nyc-seasonal-temperature-range",
    category: "climate",
    title: "temperature · seasonal range",
    description: "Summarize two years as monthly mean daily lows, midpoints, and highs.",
    source: "chartize:nyc_central_park_weather_2024_2025",
    tags: ["NOAA", "range", "seasonality"],
    query: `WITH daily AS (
  SELECT CAST(strftime('%m', "DATE") AS INTEGER) AS "month_number",
    CAST("TMIN" AS DOUBLE) AS "daily_low", CAST("TMAX" AS DOUBLE) AS "daily_high"
  FROM chartize:nyc_central_park_weather_2024_2025
  WHERE "TMAX" IS NOT NULL AND "TMIN" IS NOT NULL
)
SELECT "month_number", CASE "month_number"
    WHEN 1 THEN 'Jan' WHEN 2 THEN 'Feb' WHEN 3 THEN 'Mar' WHEN 4 THEN 'Apr'
    WHEN 5 THEN 'May' WHEN 6 THEN 'Jun' WHEN 7 THEN 'Jul' WHEN 8 THEN 'Aug'
    WHEN 9 THEN 'Sep' WHEN 10 THEN 'Oct' WHEN 11 THEN 'Nov' ELSE 'Dec' END AS "month_name",
  AVG("daily_low") AS "mean_low_c", AVG(("daily_low" + "daily_high") / 2.0) AS "mean_midpoint_c",
  AVG("daily_high") AS "mean_high_c"
FROM daily
GROUP BY "month_number"
ORDER BY "month_number"

VISUALISE
DRAW range
  MAPPING "month_name" AS x, "mean_low_c" AS ymin, "mean_high_c" AS ymax
  SETTING colour => '#3cbbb1', linewidth => 3, hinge => null
DRAW point
  MAPPING "month_name" AS x, "mean_midpoint_c" AS y
  SETTING fill => '#2a1e5c', stroke => '#ffffff', size => 4
SCALE DISCRETE x FROM ('Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec')
LABEL title => 'New York’s seasonal temperature envelope', subtitle => 'mean daily low-to-high range with midpoint · Central Park, 2024–2025', x => 'Month', y => 'Temperature (°C)'`,
  },
  {
    id: "us-land-use-square",
    category: "composition",
    title: "American land · silhouette atlas",
    description: "A Bloomberg-inspired unit map that packs official USDA acreage into the contiguous-U.S. outline.",
    source: "chartize:usda_major_land_uses",
    tags: ["USDA", "unit map", "composition"],
    query: `WITH categories AS (
  SELECT CASE "Land use"
      WHEN 'Grassland pasture and range' THEN 'Grass + range' WHEN 'Forest-use land (all)' THEN 'Forest'
      WHEN 'Total cropland' THEN 'Cropland' WHEN 'All special uses of land' THEN 'Parks + special uses'
      WHEN 'Miscellaneous other land' THEN 'Other' ELSE 'Urban' END AS "land_use",
    CAST("Value" AS DOUBLE) AS "thousand_acres",
    CASE "Land use"
      WHEN 'Grassland pasture and range' THEN 1 WHEN 'Forest-use land (all)' THEN 2
      WHEN 'Total cropland' THEN 3 WHEN 'All special uses of land' THEN 4
      WHEN 'Miscellaneous other land' THEN 5 ELSE 6 END AS "display_order"
  FROM chartize:usda_major_land_uses
  WHERE "Region or State" = '48 States' AND "Year" = 2017
    AND "Land use" IN ('Grassland pasture and range', 'Forest-use land (all)', 'Total cropland',
      'All special uses of land', 'Land in urban areas', 'Miscellaneous other land')
), running AS (
  SELECT *, SUM("thousand_acres") OVER () AS "total_acres",
    SUM("thousand_acres") OVER (ORDER BY "display_order") AS "running_acres"
  FROM categories
), segments AS (
  SELECT *, "running_acres" - "thousand_acres" AS "starting_acres" FROM running
), mainland_states AS (
  SELECT "geometry" AS "state_geometry", "STUSPS" AS "state_abbr", "NAME" AS "state_name"
  FROM chartize:us_states_2025
  WHERE "STATEFP" NOT IN ('02', '15', '60', '66', '69', '72', '78')
), numbers AS (
  SELECT ROW_NUMBER() OVER () - 1 AS "cell_number"
  FROM chartize:usda_major_land_uses
  LIMIT 1664
), grid AS (
  SELECT CAST("cell_number" % 64 AS INTEGER) AS "grid_column",
    CAST(floor("cell_number" / 64.0) AS INTEGER) AS "grid_row",
    -125.0 + (CAST("cell_number" % 64 AS INTEGER) + 0.5) * 0.91 AS "longitude",
    24.0 + (CAST(floor("cell_number" / 64.0) AS INTEGER) + 0.5) * 0.97 AS "latitude"
  FROM numbers
), clipped_grid AS (
  SELECT g.*,
    BuildMbr(g."longitude" - 0.41, g."latitude" - 0.43,
      g."longitude" + 0.41, g."latitude" + 0.43, 4326) AS "cell_geometry"
  FROM grid AS g
  WHERE (g."grid_row" = 0 AND g."grid_column" BETWEEN 51 AND 53)
    OR (g."grid_row" = 1 AND g."grid_column" BETWEEN 49 AND 53)
    OR (g."grid_row" = 2 AND (g."grid_column" BETWEEN 29 AND 38 OR g."grid_column" BETWEEN 47 AND 54))
    OR (g."grid_row" = 3 AND (g."grid_column" BETWEEN 24 AND 41 OR g."grid_column" BETWEEN 44 AND 55))
    OR (g."grid_row" = 4 AND g."grid_column" BETWEEN 19 AND 55)
    OR (g."grid_row" = 5 AND g."grid_column" BETWEEN 15 AND 56)
    OR (g."grid_row" = 6 AND g."grid_column" BETWEEN 12 AND 57)
    OR (g."grid_row" = 7 AND g."grid_column" BETWEEN 9 AND 58)
    OR (g."grid_row" = 8 AND g."grid_column" BETWEEN 7 AND 59)
    OR (g."grid_row" = 9 AND g."grid_column" BETWEEN 5 AND 60)
    OR (g."grid_row" = 10 AND g."grid_column" BETWEEN 4 AND 61)
    OR (g."grid_row" = 11 AND g."grid_column" BETWEEN 3 AND 62)
    OR (g."grid_row" = 12 AND g."grid_column" BETWEEN 2 AND 63)
    OR (g."grid_row" = 13 AND g."grid_column" BETWEEN 1 AND 63)
    OR (g."grid_row" = 14 AND g."grid_column" BETWEEN 0 AND 63)
    OR (g."grid_row" = 15 AND g."grid_column" BETWEEN 0 AND 63)
    OR (g."grid_row" = 16 AND g."grid_column" BETWEEN 0 AND 62)
    OR (g."grid_row" = 17 AND g."grid_column" BETWEEN 1 AND 62)
    OR (g."grid_row" = 18 AND g."grid_column" BETWEEN 1 AND 61)
    OR (g."grid_row" = 19 AND g."grid_column" BETWEEN 2 AND 60)
    OR (g."grid_row" = 20 AND g."grid_column" BETWEEN 3 AND 59)
    OR (g."grid_row" = 21 AND g."grid_column" BETWEEN 4 AND 58)
    OR (g."grid_row" = 22 AND g."grid_column" BETWEEN 5 AND 57)
    OR (g."grid_row" = 23 AND g."grid_column" BETWEEN 7 AND 56)
    OR (g."grid_row" = 24 AND g."grid_column" BETWEEN 8 AND 54)
    OR (g."grid_row" = 25 AND g."grid_column" BETWEEN 10 AND 52)
), ranked_cells AS (
  SELECT *, ROW_NUMBER() OVER (
      ORDER BY "grid_row" DESC, "grid_column"
    ) - 1 AS "cell_index",
    COUNT(*) OVER () AS "cell_count"
  FROM clipped_grid
), assigned_cells AS (
  SELECT c."cell_geometry", c."grid_column", c."grid_row", s."land_use",
    ROUND(1000.0 * s."total_acres" / c."cell_count") AS "acres_per_tile"
  FROM ranked_cells AS c
  JOIN segments AS s
    ON c."cell_index" >= floor(c."cell_count" * s."starting_acres" / s."total_acres")
   AND c."cell_index" < floor(c."cell_count" * s."running_acres" / s."total_acres")
), atlas AS (
  SELECT "cell_geometry", NULL AS "state_geometry", "land_use", "acres_per_tile",
    "grid_column", "grid_row", NULL AS "state_name"
  FROM assigned_cells
  UNION ALL
  SELECT NULL AS "cell_geometry", "state_geometry", NULL AS "land_use", NULL AS "acres_per_tile",
    NULL AS "grid_column", NULL AS "grid_row", "state_name"
  FROM mainland_states
)
SELECT * FROM atlas

VISUALISE
DRAW spatial
  MAPPING "cell_geometry" AS geometry, "land_use" AS fill
  SETTING stroke => '#ffffff', linewidth => 0.35, opacity => 0.97
DRAW spatial
  MAPPING "state_geometry" AS geometry
  SETTING fill => null, stroke => '#5d6864', linewidth => 0.45, opacity => 0.58
SCALE DISCRETE fill FROM ('Grass + range', 'Forest', 'Cropland', 'Parks + special uses', 'Other', 'Urban') TO ('#d4aa55', '#356b59', '#ee4266', '#93b85c', '#c9d0ce', '#6575a4')
LABEL title => 'how the contiguous U.S. uses its land', subtitle => 'each tile carries an equal share of the 1.89-billion-acre 2017 inventory · composition, not local land cover', fill => 'Major land use'
PROJECT TO albers
  SETTING origin => (-96, 37.5), parallel => (29.5, 45.5)`,
  },
];

export const EXAMPLE_CATEGORIES: Array<{ id: VisualizationExample["category"]; title: string; description: string }> = [
  { id: "quick", title: "quick starts", description: "small, legible first charts" },
  { id: "range", title: "ranges + uncertainty", description: "bands, intervals, and comparison lines" },
  { id: "map", title: "maps", description: "spatial joins and choropleths" },
  { id: "model", title: "models + scenarios", description: "fits, deltas, and counterfactuals" },
  { id: "linked", title: "linked sources", description: "questions spanning linked datasets" },
  { id: "transit", title: "New York transit", description: "route geometry, passenger delay, and station access" },
  { id: "climate", title: "weather + seasons", description: "daily heatmaps and compact temperature ranges" },
  { id: "composition", title: "composition", description: "part-to-whole views with deliberately shaped layouts" },
];

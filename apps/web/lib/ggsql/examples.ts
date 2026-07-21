export interface VisualizationExample {
  id: string;
  category: "quick" | "range" | "map" | "model" | "linked" | "transit" | "climate" | "world" | "food" | "composition";
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
    title: "presidential approval · daily average",
    description: "Follow the modeled national approval average from day to day.",
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
LABEL title => 'Presidential approval, daily average', subtitle => 'Modeled national average · second presidential term', x => 'Poll Date', y => 'Approval'`,
  },
  {
    id: "approval-uncertainty",
    category: "range",
    title: "approval and disapproval · uncertainty",
    description: "Compare both daily averages while keeping approval uncertainty visible.",
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
LABEL title => 'Presidential approval and disapproval', subtitle => 'Daily modeled averages · approval uncertainty shown as a band · 50% reference line', x => 'Poll Date', y => 'Share'`,
  },
  {
    id: "generic-ballot-bands",
    category: "range",
    title: "generic ballot · uncertainty",
    description: "Compare party support without hiding the uncertainty around either average.",
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
LABEL title => 'Which party leads the generic ballot?', subtitle => 'Daily national averages with confidence bands · Democratic in blue · Republican in red', x => 'Poll Date', y => 'Support'`,
  },
  {
    id: "county-regression",
    category: "model",
    title: "county population · 2020 to 2025",
    description: "Compare each county’s 2020 and 2025 population on logarithmic axes.",
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
LABEL title => 'How county populations changed, 2020–2025', subtitle => 'Each point is a county · descriptive trend on logarithmic axes · not a forecast', x => '2020 population', y => '2025 population'`,
  },
  {
    id: "approval-scenario",
    category: "model",
    title: "approval · three-point scenario",
    description: "Compare observed approval with an illustrative three-point increase.",
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
LABEL title => 'What if approval were three points higher?', subtitle => 'Observed daily average and a +3 point scenario · illustrative, not a forecast', x => 'Poll Date', y => 'Approval'`,
  },
  {
    id: "county-population-map",
    category: "map",
    title: "county population · 2025",
    description: "See how the estimated population is distributed across U.S. counties.",
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
LABEL title => 'Where Americans live, county by county', subtitle => '2025 Census population estimates · colour uses a logarithmic scale', fill => '2025 population'
PROJECT TO albers
  SETTING origin => (-96, 37.5), parallel => (29.5, 45.5)`,
  },
  {
    id: "county-change-map",
    category: "map",
    title: "county population change · 2020 to 2025",
    description: "Find the counties that gained or lost population over five years.",
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
LABEL title => 'Where U.S. counties gained and lost population', subtitle => 'Estimated change from 2020 to 2025 · red decline · yellow little change · green growth', fill => 'Change (%)'
PROJECT TO albers
  SETTING origin => (-96, 37.5), parallel => (29.5, 45.5)`,
  },
  {
    id: "county-smoking-map",
    category: "map",
    title: "county smoking · 2025",
    description: "Compare modeled adult smoking prevalence across U.S. counties.",
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
LABEL title => 'Where adult smoking is most prevalent', subtitle => 'CDC PLACES 2025 · age-adjusted modeled estimates by county', fill => 'Smoking (%)'
PROJECT TO albers
  SETTING origin => (-96, 37.5), parallel => (29.5, 45.5)`,
  },
  {
    id: "population-obesity-link",
    category: "linked",
    title: "county size and adult obesity",
    description: "Ask whether larger counties show a different pattern in modeled obesity prevalence.",
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
LABEL title => 'Does county size relate to adult obesity?', subtitle => 'Each point is a county · descriptive Census and CDC trend · not causal', x => '2025 population', y => 'Obesity prevalence (%)'`,
  },
  {
    id: "income-obesity-link",
    category: "linked",
    title: "income and adult obesity",
    description: "Compare county income with modeled adult obesity prevalence.",
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
LABEL title => 'How income and adult obesity vary across counties', subtitle => 'BEA income and CDC modeled prevalence · descriptive trend · not causal', x => 'Per-capita personal income ($)', y => 'Obesity prevalence (%)'`,
  },
  {
    id: "county-income-map",
    category: "map",
    title: "county personal income · 2024",
    description: "Compare personal income per person across U.S. counties.",
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
LABEL title => 'Where personal income per person is highest', subtitle => '2024 BEA county estimates · colour uses a logarithmic scale', fill => 'Income ($)'
PROJECT TO albers
  SETTING origin => (-96, 37.5), parallel => (29.5, 45.5)`,
  },
  {
    id: "county-real-gdp-change-map",
    category: "map",
    title: "county economic growth · 2019 to 2024",
    description: "Compare inflation-adjusted economic output across U.S. counties.",
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
LABEL title => 'Where county economies grew or shrank', subtitle => 'Inflation-adjusted real GDP change, 2019–2024 · red decline · yellow little change · green growth', fill => 'Change (%)'
PROJECT TO albers
  SETTING origin => (-96, 37.5), parallel => (29.5, 45.5)`,
  },
  {
    id: "mta-route-delay-map",
    category: "transit",
    title: "subway delays · where riders lose time",
    description: "See where peak-period delays affect the most riders across the subway network.",
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
), label_lines AS (
  SELECT "service" AS "route", MAX(CAST("shape_stlength" AS DOUBLE)) AS "longest_segment"
  FROM chartize:mta_subway_service_lines
  GROUP BY "service"
), joined_lines AS (
  SELECT l."geometry" AS "geometry", l."service" AS "route", l."service_name" AS "service_name",
    d."extra_minutes" AS "extra_minutes", d."passenger_millions" AS "passenger_millions",
    CASE WHEN CAST(l."shape_stlength" AS DOUBLE) = m."longest_segment"
      THEN ST_X(ST_EndPoint(ST_GeometryN(ST_GeomFromWKB(l."geometry"), 1))) END AS "label_lon",
    CASE WHEN CAST(l."shape_stlength" AS DOUBLE) = m."longest_segment"
      THEN ST_Y(ST_EndPoint(ST_GeometryN(ST_GeomFromWKB(l."geometry"), 1))) END AS "label_lat",
    CASE WHEN CAST(l."shape_stlength" AS DOUBLE) = m."longest_segment"
      THEN l."service" END AS "route_label",
    CASE
      WHEN l."service" IN ('1', '2', '3') THEN '#EE352E'
      WHEN l."service" IN ('4', '5', '6') THEN '#00933C'
      WHEN l."service" = '7' THEN '#B933AD'
      WHEN l."service" IN ('A', 'C', 'E') THEN '#0039A6'
      WHEN l."service" IN ('B', 'D', 'F', 'M') THEN '#FF6319'
      WHEN l."service" = 'G' THEN '#6CBE45'
      WHEN l."service" IN ('J', 'Z') THEN '#996633'
      WHEN l."service" = 'L' THEN '#A7A9AC'
      WHEN l."service" IN ('N', 'Q', 'R', 'W') THEN '#FCCC0A'
      ELSE '#808183'
    END AS "route_color"
  FROM chartize:mta_subway_service_lines AS l
  JOIN route_delay AS d ON l."service" = d."route"
  JOIN label_lines AS m ON l."service" = m."route"
)
SELECT "geometry", "route", "service_name", "extra_minutes", "passenger_millions",
  "label_lon", "label_lat", "route_label",
  CASE
    WHEN "route_label" IS NULL THEN 'none'
    WHEN "route" IN ('N', 'Q', 'R', 'W') THEN 'dark'
    ELSE 'light'
  END AS "route_text_tone",
  "route_color"
FROM joined_lines

VISUALISE
DRAW spatial
  MAPPING "geometry" AS geometry FROM chartize:nyc_borough_boundaries
  SETTING fill => '#f4f6f5', stroke => '#c4cbca', linewidth => 0.8
DRAW spatial
  MAPPING "geometry" AS geometry, "extra_minutes" AS stroke, "passenger_millions" AS linewidth
  SETTING fill => null
DRAW point
  MAPPING "label_lon" AS lon, "label_lat" AS lat, "route_color" AS fill
  SETTING size => 9
DRAW text
  MAPPING "label_lon" AS lon, "label_lat" AS lat, "route_label" AS label
  SETTING fontsize => 6, fontweight => 'bold', colour => '#ffffff'
  FILTER route_text_tone = 'light'
DRAW text
  MAPPING "label_lon" AS lon, "label_lat" AS lat, "route_label" AS label
  SETTING fontsize => 6, fontweight => 'bold', colour => '#0a0f0d'
  FILTER route_text_tone = 'dark'
SCALE CONTINUOUS stroke TO ylorrd
SCALE CONTINUOUS linewidth TO (1.2, 6)
SCALE IDENTITY fill
LABEL title => 'Where peak subway trips lose time', subtitle => '2025 passenger-weighted delay · wider lines carry more peak-period riders', stroke => 'Extra minutes', linewidth => 'Peak riders (M)'
PROJECT TO mercator`,
  },
  {
    id: "mta-route-delay-heatmap",
    category: "transit",
    title: "subway delays · busiest routes by month",
    description: "Compare two years of monthly delays on the 16 routes carrying the most riders.",
    source: "chartize:mta_subway_journey_metrics_2024_2025",
    tags: ["MTA", "tile", "weighted metric"],
    query: `WITH busiest_routes AS (
  SELECT "line" AS "route"
  FROM chartize:mta_subway_journey_metrics_2024_2025
  WHERE "period" = 'peak'
  GROUP BY "line"
  ORDER BY SUM("num_passengers") DESC
  LIMIT 16
)
SELECT strftime('%Y-%m', m."month") AS "month_label", m."line" AS "route",
  SUM(m."num_passengers" * (m."additional_platform_time" + m."additional_train_time"))
    / NULLIF(SUM(m."num_passengers"), 0) AS "extra_minutes"
FROM chartize:mta_subway_journey_metrics_2024_2025 AS m
JOIN busiest_routes AS b ON m."line" = b."route"
WHERE m."period" = 'peak'
GROUP BY "month_label", m."line"
ORDER BY "month_label", "line"

VISUALISE
DRAW tile
  MAPPING "month_label" AS x, "route" AS y, "extra_minutes" AS fill
  SETTING stroke => '#f4f6f5', linewidth => 0.5
SCALE CONTINUOUS fill TO ylorrd
LABEL title => 'When delays peak on the busiest subway routes', subtitle => '16 highest-ridership routes · passenger-weighted extra platform and train time · monthly, 2024–2025', x => 'Month', y => 'Route', fill => 'Delay (min)'`,
  },
  {
    id: "mta-station-accessibility-map",
    category: "transit",
    title: "subway access · step-free stations",
    description: "Explore which subway stations are marked as accessible without stairs.",
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
LABEL title => 'Where New York’s subway is step-free', subtitle => 'Official MTA station inventory · connected station complexes may appear more than once', fill => 'Station status'
PROJECT TO mercator`,
  },
  {
    id: "june-temperature-heatmap",
    category: "climate",
    title: "New York weather · June 2026",
    description: "Read a month of Central Park temperatures as a familiar calendar.",
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
LABEL title => 'June 2026 in New York, day by day', subtitle => 'Central Park midpoint between each day’s NOAA low and high temperature', x => 'Day of week', y => null, fill => 'Midpoint (°C)'`,
  },
  {
    id: "nyc-seasonal-temperature-range",
    category: "climate",
    title: "New York weather · seasonal range",
    description: "See the typical daily low, midpoint, and high for every month.",
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
LABEL title => 'A year of New York temperatures', subtitle => 'Typical daily low-to-high range by month · Central Park, 2024–2025', x => 'Month', y => 'Temperature (°C)'`,
  },
  {
    id: "world-population-map",
    category: "world",
    title: "world population · 2023",
    description: "Explore how the world’s population is distributed across countries.",
    source: "chartize:world_population",
    tags: ["world", "population", "choropleth"],
    query: `SELECT c."geometry" AS "geometry", p."Population" AS "population",
  p."Entity" AS "country", c."CONTINENT" AS "continent"
FROM chartize:world_population AS p
JOIN chartize:natural_earth_countries_110m AS c ON c."ADM0_A3" = p."Code"
WHERE p."Year" = 2023 AND p."Population" > 0

VISUALISE
DRAW spatial
  MAPPING "geometry" AS geometry, "population" AS fill
  SETTING stroke => '#f4f7f6', linewidth => 0.35
SCALE CONTINUOUS fill TO viridis VIA log
LABEL title => 'Where the world’s 8.1 billion people live', subtitle => '2023 United Nations estimates · colour uses a logarithmic scale', fill => 'Population'
PROJECT TO robinson`,
  },
  {
    id: "world-development-bubbles",
    category: "world",
    title: "health, prosperity, and population",
    description: "Compare income, longevity, and population across countries without assuming causation.",
    source: "chartize:world_gdp_per_capita",
    tags: ["GDP", "life expectancy", "bubbles"],
    query: `SELECT g."Entity" AS "country", g."GDP per capita" AS "gdp_per_capita",
  l."Life expectancy" AS "life_expectancy", p."Population" AS "population",
  g."World region according to OWID" AS "region"
FROM chartize:world_gdp_per_capita AS g
JOIN chartize:world_life_expectancy AS l ON g."Code" = l."Code" AND g."Year" = l."Year"
JOIN chartize:world_population AS p ON g."Code" = p."Code" AND g."Year" = p."Year"
WHERE g."Year" = 2023 AND g."Code" IS NOT NULL AND g."GDP per capita" > 0
  AND l."Life expectancy" IS NOT NULL AND p."Population" > 0

VISUALISE
DRAW point
  MAPPING "gdp_per_capita" AS x, "life_expectancy" AS y, "population" AS size, "region" AS fill
  SETTING stroke => '#ffffff', linewidth => 0.5, opacity => 0.78
SCALE x VIA log
SCALE CONTINUOUS size TO (2, 18)
SCALE DISCRETE fill TO tableau10
LABEL title => 'Does prosperity travel with longer lives?', subtitle => 'Countries in 2023 · bubble area shows population · descriptive, not causal', x => 'GDP per person (constant international $)', y => 'Life expectancy (years)', size => 'Population', fill => 'World region'`,
  },
  {
    id: "world-temperature-stripes",
    category: "climate",
    title: "global warming · year by year",
    description: "Follow annual global temperature departures from a recent baseline.",
    source: "chartize:world_temperature_anomalies",
    tags: ["climate", "bar", "diverging"],
    query: `SELECT CAST("Year" AS TEXT) AS "year", "Temperature anomaly" AS "anomaly",
  CASE WHEN "Temperature anomaly" < 0 THEN 'cooler' ELSE 'warmer' END AS "direction"
FROM chartize:world_temperature_anomalies
WHERE "Entity" = 'World' AND "Year" >= 1940
ORDER BY "Year"

VISUALISE
DRAW bar
  MAPPING "year" AS x, "anomaly" AS y, "direction" AS fill
  SETTING position => 'identity'
SCALE DISCRETE fill FROM ('cooler', 'warmer') TO ('#3976c6', '#ee4266')
LABEL title => 'The warming signal, year by year', subtitle => 'Global surface temperature relative to the 1991–2020 average · 1940 onward', x => 'Year', y => 'Temperature anomaly (°C)', fill => 'Relative to baseline'`,
  },
  {
    id: "world-calorie-map",
    category: "food",
    title: "daily food energy · 2023",
    description: "Compare the food energy available per person before household waste.",
    source: "chartize:world_calorie_supply",
    tags: ["food", "world map", "FAO"],
    query: `SELECT c."geometry" AS "geometry", f."Entity" AS "country",
  f."Daily calorie supply per person" AS "calories"
FROM chartize:world_calorie_supply AS f
JOIN chartize:natural_earth_countries_110m AS c ON c."ADM0_A3" = f."Code"
WHERE f."Year" = 2023 AND f."Daily calorie supply per person" IS NOT NULL

VISUALISE
DRAW spatial
  MAPPING "geometry" AS geometry, "calories" AS fill
  SETTING stroke => '#f4f7f6', linewidth => 0.35
SCALE CONTINUOUS fill TO ylgnbu
LABEL title => 'How much food energy is available per person?', subtitle => '2023 supply before household waste · availability, not measured intake', fill => 'kcal / person / day'
PROJECT TO robinson`,
  },
  {
    id: "cocoa-top-countries",
    category: "food",
    title: "cocoa supply · top countries",
    description: "Rank countries by the cocoa-bean food supply available per person.",
    source: "chartize:world_cocoa_supply",
    tags: ["cocoa", "ranking", "fun"],
    query: `SELECT CASE WHEN "Entity" = 'Cote d''Ivoire' THEN 'Côte d’Ivoire' ELSE "Entity" END AS "country",
  "Cocoa beans - Food available for consumption (kilograms per year per capita)" AS "cocoa_kg"
FROM chartize:world_cocoa_supply
WHERE "Year" = 2023 AND "Code" IS NOT NULL
  AND "Cocoa beans - Food available for consumption (kilograms per year per capita)" > 0
ORDER BY "cocoa_kg" DESC
LIMIT 16

VISUALISE
DRAW bar
  MAPPING "country" AS x, "cocoa_kg" AS y
  SETTING fill => '#8f5b47', stroke => '#8f5b47'
SCALE DISCRETE x FROM ('Côte d’Ivoire', 'Luxembourg', 'Iceland', 'Montenegro', 'Israel', 'France', 'United Kingdom', 'Norway', 'Czechia', 'Malta', 'New Zealand', 'Slovenia', 'Latvia', 'Bosnia and Herzegovina', 'Denmark', 'Bahrain')
LABEL title => 'Where cocoa-bean supply is highest', subtitle => '2023 food supply per person · not retail chocolate purchases', x => 'Country', y => 'kg per person per year'`,
  },
  {
    id: "us-land-use-square",
    category: "composition",
    title: "U.S. land use · unit atlas",
    description: "See how major uses divide the contiguous United States into equal-area tiles.",
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
), mainland AS (
  SELECT ST_Intersection(
    ST_GeomFromWKB("geometry"),
    BuildMbr(-125.0, 24.0, -66.0, 50.0)
  ) AS "mainland_geometry"
  FROM chartize:natural_earth_countries_110m
  WHERE "ADM0_A3" = 'USA'
  LIMIT 1
), numbers AS (
  SELECT ROW_NUMBER() OVER () - 1 AS "cell_number"
  FROM chartize:usda_major_land_uses
  LIMIT 1792
), grid AS (
  SELECT CAST("cell_number" % 64 AS INTEGER) AS "grid_column",
    CAST(floor("cell_number" / 64.0) AS INTEGER) AS "grid_row",
    BuildMbr(
      -125.0 + (CAST("cell_number" % 64 AS INTEGER) + 0.08) * 0.921875,
      24.0 + (CAST(floor("cell_number" / 64.0) AS INTEGER) + 0.08) * 0.928571,
      -125.0 + (CAST("cell_number" % 64 AS INTEGER) + 0.92) * 0.921875,
      24.0 + (CAST(floor("cell_number" / 64.0) AS INTEGER) + 0.92) * 0.928571
    ) AS "cell_geometry"
  FROM numbers
), mainland_grid AS (
  SELECT g."grid_column", g."grid_row",
    ST_AsBinary(g."cell_geometry") AS "cell_geometry"
  FROM grid AS g
  CROSS JOIN mainland AS m
  WHERE ST_Contains(m."mainland_geometry", ST_Centroid(g."cell_geometry")) = 1
), ranked_cells AS (
  SELECT *, ROW_NUMBER() OVER (
      ORDER BY "grid_row" DESC, "grid_column"
    ) - 1 AS "cell_index",
    COUNT(*) OVER () AS "cell_count"
  FROM mainland_grid
), assigned_cells AS (
  SELECT printf('%02d', c."grid_column") AS "grid_column",
    printf('%02d', c."grid_row") AS "grid_row", s."land_use",
    ROUND(1000.0 * s."total_acres" / c."cell_count") AS "acres_per_tile"
  FROM ranked_cells AS c
  JOIN segments AS s
    ON c."cell_index" >= floor(c."cell_count" * s."starting_acres" / s."total_acres")
   AND c."cell_index" < floor(c."cell_count" * s."running_acres" / s."total_acres")
)
SELECT * FROM assigned_cells

VISUALISE
DRAW tile
  MAPPING "grid_column" AS x, "grid_row" AS y, "land_use" AS fill
  SETTING stroke => '#ffffff', linewidth => 0.7, opacity => 0.98
SCALE DISCRETE fill FROM ('Grass + range', 'Forest', 'Cropland', 'Parks + special uses', 'Other', 'Urban') TO ('#d4aa55', '#356b59', '#ee4266', '#93b85c', '#c9d0ce', '#6575a4')
LABEL title => 'How the contiguous U.S. uses its land', subtitle => 'Each square represents an equal share of 1.89 billion acres in 2017 · composition, not the tile’s physical location', x => null, y => null, fill => 'Major land use'`,
  },
];

export const EXAMPLE_CATEGORIES: Array<{ id: VisualizationExample["category"]; title: string; description: string }> = [
  { id: "quick", title: "quick starts", description: "clear first charts you can change immediately" },
  { id: "range", title: "ranges + uncertainty", description: "compare estimates without hiding uncertainty" },
  { id: "map", title: "maps", description: "explore patterns across counties and places" },
  { id: "model", title: "models + scenarios", description: "compare trends and ask what might change" },
  { id: "linked", title: "linked sources", description: "connect measures from more than one public source" },
  { id: "transit", title: "New York transit", description: "follow delays, routes, and step-free access" },
  { id: "climate", title: "weather + seasons", description: "read daily weather and longer climate patterns" },
  { id: "world", title: "around the world", description: "compare population, health, and prosperity" },
  { id: "food", title: "food + daily life", description: "explore food availability with careful definitions" },
  { id: "composition", title: "parts of a whole", description: "see how one total divides into meaningful parts" },
];

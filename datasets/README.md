# Recommended warehouse datasets

`recommended.json` is the acquisition manifest. It separates a small automatic starter pack from larger or credentialed datasets.

## Download list

| Priority | Dataset | Why it belongs | Acquisition |
| --- | --- | --- | --- |
| Starter | [Presidential approval daily average](https://github.com/Hackquantumcpp/snoutcounter-backend) | Headline approval/disapproval trend | Automatic |
| Starter | [Individual presidential approval polls](https://github.com/Hackquantumcpp/snoutcounter-backend/tree/main/data) | Pollster, dates, sample, population, sponsor, and raw observations behind the average | Automatic |
| Starter | [2026 generic congressional ballot average](https://github.com/Hackquantumcpp/snoutcounter-backend) | A second current political trend for comparison | Automatic |
| Starter | [Census Vintage 2025 county population](https://www.census.gov/data/datasets/time-series/demo/popest/2020s-counties-total.html) | County totals and components of change from 2020–2025 | Automatic |
| Starter | [2025 state cartographic boundaries](https://www.census.gov/geographies/mapping-files/time-series/geo/cartographic-boundary.2025.html) | Lightweight national state maps | Automatic |
| Starter | [2025 county cartographic boundaries](https://www.census.gov/geographies/mapping-files/time-series/geo/cartographic-boundary.2025.html) | County choropleths joined on five-character GEOID | Automatic |
| Next | [2020–2024 ACS 5-year county profile](https://api.census.gov/data/2024/acs/acs5.html) | Income, poverty, age, education, race, housing, and internet access, with margins of error | Census API key + curated variables |
| Next | [CDC PLACES 2025 county health](https://data.cdc.gov/d/swc5-untb) | Forty modeled public-health measures with confidence intervals | Automatic with `--all` or its manifest ID |
| Next | [MIT Election Lab 2024 precinct returns](https://electionlab.mit.edu/data) | Detailed election results and geographic coverage | Manual Dataverse download; retain DOI and version |
| Later | [EAC 2024 EAVS](https://www.eac.gov/research-and-data/studies-and-reports) | Registration, turnout, mail voting, provisional voting, and election administration | Manual CSV + codebook |
| Later | [BEA county income and GDP](https://www.bea.gov/itable/regional-gdp-and-personal-income) | County economic levels and trends | Curated BEA tables/API |
| Later | [BLS county unemployment](https://www.bls.gov/lau/tables.htm) | Monthly and annual labor-force conditions | Curated BLS files/API |

The machine-readable URLs, slugs, licenses, attribution, refresh cadence, and caveats live in [`recommended.json`](./recommended.json).

## Starter pack

Run the application, then publish the six starter datasets:

```bash
ADMIN_TOKEN=local-dev-token pnpm data:seed
```

This installs:

1. Current presidential approval daily average
2. Individual presidential approval polls
3. 2026 generic congressional ballot average
4. Census Vintage 2025 county population estimates
5. 2025 state cartographic boundaries
6. 2025 county cartographic boundaries

The political data comes from the actively maintained, GPL-3.0 SnoutCounter model repository. The old FiveThirtyEight download URLs are deliberately excluded because they now return an ABC web page instead of CSV data.

Use `pnpm data:seed -- --all` to additionally publish automatic non-starter sources such as CDC PLACES. Pass one or more manifest IDs to select datasets explicitly:

```bash
ADMIN_TOKEN=local-dev-token pnpm data:seed -- cdc_places_county_2025
```

The command skips slugs that are already published. Add `--force` when you intentionally want to download current upstream data and create a new warehouse version.

Read each manifest entry’s notes before automating redistribution. Keep ACS margins of error, PLACES confidence limits, exact election-data versions, and the original source metadata rather than flattening those distinctions away.

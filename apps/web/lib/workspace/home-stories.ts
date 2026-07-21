export interface HomeStoryDefinition {
  id: string;
  section: "signals" | "context" | "everyday";
  columns: number;
  minHeight: number;
  eyebrow: string;
  ask: string;
}

export const HOME_STORIES: readonly HomeStoryDefinition[] = [
  { id: "approval-uncertainty", section: "signals", columns: 7, minHeight: 356, eyebrow: "public opinion", ask: "Search the web for recent presidential approval context, then explain what changed and what this average can establish versus only suggest." },
  { id: "mta-route-delay-map", section: "signals", columns: 5, minHeight: 356, eyebrow: "city motion", ask: "Search current MTA reporting on subway reliability, then explain which services expose the most riders to delay and what I should compare next." },
  { id: "june-temperature-heatmap", section: "context", columns: 5, minHeight: 356, eyebrow: "weather calendar", ask: "Search the web for historical Central Park weather context, then explain which June 2026 days were unusually hot or cool and what pattern this calendar makes visible." },
  { id: "world-development-bubbles", section: "context", columns: 7, minHeight: 356, eyebrow: "linked evidence", ask: "Search the web for country-specific health and economic context, then explain the major outliers without treating prosperity and longevity as a causal relationship." },
  { id: "world-temperature-stripes", section: "context", columns: 12, minHeight: 270, eyebrow: "climate signal", ask: "Search current climate sources, then explain the warming pattern and distinguish an annual anomaly from absolute temperature." },
  { id: "world-population-map", section: "everyday", columns: 5, minHeight: 350, eyebrow: "people + place", ask: "Search the web for geographic and demographic context, then explain why the world’s population is distributed this way and which comparisons are most revealing." },
  { id: "cocoa-top-countries", section: "everyday", columns: 7, minHeight: 350, eyebrow: "food, lightly", ask: "Search the web for cocoa production and food-supply context, then explain why these countries lead cocoa-bean supply per person and what this measure leaves out." },
  { id: "us-land-use-square", section: "everyday", columns: 7, minHeight: 360, eyebrow: "land + composition", ask: "Search current USDA land-use definitions, then explain what this atlas reveals and why each cell should not be read as local land cover." },
  { id: "us-land-use-shares", section: "everyday", columns: 5, minHeight: 360, eyebrow: "the exact shares", ask: "Search current USDA land-use definitions, then explain which uses occupy the largest shares of U.S. land and how to interpret these national categories." },
];

export function homeStoryForExample(id: string | null) {
  if (!id) return undefined;
  return HOME_STORIES.find((story) => story.id === id);
}

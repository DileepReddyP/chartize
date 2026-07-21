export interface HomeStoryDefinition {
  id: string;
  section: "signals" | "context" | "everyday";
  columns: number;
  minHeight: number;
  eyebrow: string;
  ask: string;
}

export const HOME_STORIES: readonly HomeStoryDefinition[] = [
  { id: "approval-uncertainty", section: "signals", columns: 7, minHeight: 356, eyebrow: "public opinion", ask: "What changed in presidential approval, and what can this average establish versus only suggest?" },
  { id: "mta-route-delay-map", section: "signals", columns: 5, minHeight: 356, eyebrow: "city motion", ask: "Which subway services expose the most riders to delay, and what should I compare next?" },
  { id: "june-temperature-heatmap", section: "context", columns: 5, minHeight: 356, eyebrow: "weather calendar", ask: "Which June days were unusually hot or cool, and what pattern does this calendar make visible?" },
  { id: "world-development-bubbles", section: "context", columns: 7, minHeight: 356, eyebrow: "linked evidence", ask: "Explain the major outliers in health versus prosperity without treating the relationship as causal." },
  { id: "world-temperature-stripes", section: "context", columns: 12, minHeight: 270, eyebrow: "climate signal", ask: "Explain the warming pattern and distinguish an annual anomaly from absolute temperature." },
  { id: "world-population-map", section: "everyday", columns: 5, minHeight: 350, eyebrow: "people + place", ask: "Why is the world’s population distributed this way, and which geographic comparisons are most revealing?" },
  { id: "cocoa-top-countries", section: "everyday", columns: 7, minHeight: 350, eyebrow: "food, lightly", ask: "Why do these countries lead cocoa-bean supply per person, and what does this measure leave out?" },
  { id: "us-land-use-square", section: "everyday", columns: 7, minHeight: 360, eyebrow: "land + composition", ask: "What does this land-use atlas reveal, and why should I not read each cell as local land cover?" },
  { id: "us-land-use-shares", section: "everyday", columns: 5, minHeight: 360, eyebrow: "the exact shares", ask: "Which uses occupy the largest shares of U.S. land, and how should I interpret these national categories?" },
];

export function homeStoryForExample(id: string | null) {
  if (!id) return undefined;
  return HOME_STORIES.find((story) => story.id === id);
}

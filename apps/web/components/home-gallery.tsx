import Link from "next/link";
import type { CSSProperties } from "react";
import { VISUALIZATION_EXAMPLES, type VisualizationExample } from "@/lib/ggsql/examples";
import { HOME_STORIES, type HomeStoryDefinition } from "@/lib/workspace/home-stories";
import { ProfileMenu } from "./profile-menu";

const HOME_SECTIONS = [
  { id: "signals", index: "01", eyebrow: "signals in motion" },
  { id: "context", index: "02", eyebrow: "the wider pattern" },
  { id: "everyday", index: "03", eyebrow: "the world in proportion" },
] as const;

const HOME_STORY_ENTRIES = HOME_STORIES.flatMap((definition) => {
  const example = VISUALIZATION_EXAMPLES.find((candidate) => candidate.id === definition.id);
  return example ? [{ definition, example }] : [];
});

const HOME_PREVIEW_ASPECTS: Record<string, string> = {
  "approval-uncertainty": "802 / 232",
  "mta-route-delay-map": "566 / 232",
  "june-temperature-heatmap": "566 / 232",
  "world-development-bubbles": "802 / 232",
  "world-temperature-stripes": "1392 / 160",
  "world-population-map": "566 / 226",
  "cocoa-top-countries": "802 / 226",
  "us-land-use-square": "540 / 236",
  "us-land-use-shares": "566 / 236",
};

function explorerHref(example: VisualizationExample, ask = false) {
  const query = new URLSearchParams({ example: example.id });
  if (ask) query.set("ai", "general");
  return `/explore?${query}`;
}

function HomeStory({ definition, example }: {
  definition: HomeStoryDefinition;
  example: VisualizationExample;
}) {
  const style = {
    "--story-columns": definition.columns,
    "--story-height": `${definition.minHeight}px`,
    "--story-preview-aspect": HOME_PREVIEW_ASPECTS[example.id],
  } as CSSProperties;
  return (
    <article className="home-story" data-story-id={example.id} style={style}>
      <header>
        <div><span>{definition.eyebrow}</span><h2>{example.title}</h2></div>
        <small>{example.tags.join(" · ")}</small>
      </header>
      <div className="home-story-chart">
        <img
          className="home-story-preview"
          src={`/home-previews/${example.id}.svg`}
          alt={`${example.title}. ${example.description}`}
          loading={definition.section === "signals" ? "eager" : "lazy"}
          decoding="async"
        />
      </div>
      <footer>
        <p>{example.description}</p>
        <div>
          <a href={explorerHref(example)}>open in explorer <span aria-hidden="true">↗</span></a>
          <a className="ask" href={explorerHref(example, true)}><span aria-hidden="true">✦</span> ask chartize</a>
        </div>
      </footer>
    </article>
  );
}

export function HomeGallery() {
  return (
    <main className="home-page">
      <div className="home-canvas">
        <section className="home-proposition" aria-labelledby="home-proposition-heading">
          <Link className="home-proposition-brand" href="/" aria-label="Chartize home">
            <span className="brand-mark" aria-hidden="true" />
            <b>chartize</b>
          </Link>
          <h1 id="home-proposition-heading">turn data into graphs, charts, and maps. then ask what they mean</h1>
          <div className="home-proposition-actions"><a className="home-proposition-action" href="/explore?new=blank">start blank <span aria-hidden="true">→</span></a><ProfileMenu /></div>
        </section>
        {HOME_SECTIONS.map((section) => (
          <section key={section.id} className={`home-editorial-section section-${section.id}`} aria-labelledby={`home-${section.id}-heading`}>
            <header className="home-editorial-heading">
              <h2 id={`home-${section.id}-heading`}>{section.index} / {section.eyebrow}</h2>
            </header>
            <div className="home-story-grid" aria-label={`${section.eyebrow} visualizations`}>
              {HOME_STORY_ENTRIES.filter(({ definition }) => definition.section === section.id).map(({ definition, example }) => (
                <HomeStory key={example.id} definition={definition} example={example} />
              ))}
            </div>
          </section>
        ))}
        <footer className="home-footer"><span>Chartize</span><Link href="/about">about</Link></footer>
      </div>
    </main>
  );
}

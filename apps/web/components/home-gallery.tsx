"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { BrowserVisualizationSpecSchema } from "@/lib/local/worker-protocol";
import { createIsolatedBrowserRuntime } from "@/lib/local/browser-runtime";
import { VISUALIZATION_EXAMPLES, type VisualizationExample } from "@/lib/ggsql/examples";
import { HOME_STORIES, type HomeStoryDefinition } from "@/lib/workspace/home-stories";
import { StaticChartPreview } from "./static-chart-preview";

const HOME_SECTIONS = [
  { id: "signals", index: "01", eyebrow: "signals in motion" },
  { id: "context", index: "02", eyebrow: "the wider pattern" },
  { id: "everyday", index: "03", eyebrow: "the world in proportion" },
] as const;

type StoryState = { status: "queued" | "loading" | "ready" | "error"; spec: Record<string, unknown> | null; error: string };
const MTA_HOME_VIEWPORT = { zoom: 1.25, panX: 0, panY: 0.05 } as const;

function HomeStory({ definition, example, state, onOpen, onAsk, onError }: {
  definition: HomeStoryDefinition;
  example: VisualizationExample;
  state: StoryState;
  onOpen: () => void;
  onAsk: () => void;
  onError: (message: string) => void;
}) {
  const reportError = useCallback((message: string) => onError(message), [onError]);
  const presentedSpec = useMemo(() => {
    if (!state.spec || example.id !== "mta-route-delay-map") return state.spec;
    const config = (state.spec.config ?? {}) as Record<string, unknown>;
    const legend = (config.legend ?? {}) as Record<string, unknown>;
    return {
      ...state.spec,
      config: {
        ...config,
        legend: {
          ...legend,
          gradientLength: 112,
          gradientThickness: 9,
          labelFontSize: 8,
          titleFontSize: 10,
          offset: 5,
        },
      },
    };
  }, [example.id, state.spec]);
  const style = {
    "--story-columns": definition.columns,
    "--story-height": `${definition.minHeight}px`,
  } as CSSProperties;
  return (
    <article className="home-story" data-story-id={example.id} style={style}>
      <header>
        <div><span>{definition.eyebrow}</span><h2>{example.title}</h2></div>
        <small>{example.tags.join(" · ")}</small>
      </header>
      <div className="home-story-chart">
        {presentedSpec ? (
          <StaticChartPreview
            spec={presentedSpec}
            label={`${example.title}. ${example.description}`}
            {...(example.id === "mta-route-delay-map" ? { mapViewport: MTA_HOME_VIEWPORT } : {})}
            onError={reportError}
          />
        ) : state.status === "error" ? (
          <div className="home-story-error"><b>view unavailable</b><span>{state.error}</span></div>
        ) : (
          <div className="home-story-loading" role="status"><span className="spinner" /><span>{state.status === "queued" ? "waiting its turn…" : "building this view…"}</span></div>
        )}
      </div>
      <footer>
        <p>{example.description}</p>
        <div>
          <button type="button" onClick={onOpen}>open in explorer <span aria-hidden="true">↗</span></button>
          {definition.ask && <button className="ask" type="button" onClick={onAsk}><span aria-hidden="true">✦</span> ask chartize</button>}
        </div>
      </footer>
    </article>
  );
}

export function HomeGallery() {
  const stories = useMemo(() => HOME_STORIES.flatMap((definition) => {
    const example = VISUALIZATION_EXAMPLES.find((candidate) => candidate.id === definition.id);
    return example ? [{ definition, example }] : [];
  }), []);
  const [storyState, setStoryState] = useState<Record<string, StoryState>>(() => Object.fromEntries(
    stories.map(({ example }) => [example.id, { status: "queued", spec: null, error: "" } satisfies StoryState]),
  ));

  useEffect(() => {
    let cancelled = false;
    const runtime = createIsolatedBrowserRuntime();
    const load = async () => {
      await runtime.initialize("chartize-home", process.env.NEXT_PUBLIC_SPATIALITE_WASM_URL ?? "/wasm/mod_spatialite.wasm");
      for (const { example } of stories) {
        if (cancelled) break;
        const workspaceId = `home-${example.id}`;
        setStoryState((current) => ({ ...current, [example.id]: { status: "loading", spec: null, error: "" } }));
        try {
          const spec = BrowserVisualizationSpecSchema.parse(await runtime.run(workspaceId, example.query));
          if (!cancelled) setStoryState((current) => ({ ...current, [example.id]: { status: "ready", spec, error: "" } }));
        } catch (cause) {
          const error = cause instanceof Error ? cause.message : String(cause);
          if (!cancelled) setStoryState((current) => ({ ...current, [example.id]: { status: "error", spec: null, error } }));
        } finally {
          // The returned Vega spec owns its inline rows. Releasing each WASM
          // context before loading the next story keeps the homepage bounded
          // to one transient query workspace instead of eight live engines.
          if (!cancelled) await runtime.release(workspaceId).catch(() => undefined);
        }
      }
    };
    void load().catch((cause) => {
      const error = cause instanceof Error ? cause.message : String(cause);
      if (!cancelled) setStoryState((current) => Object.fromEntries(Object.entries(current).map(([id, value]) => [
        id,
        value.status === "ready" ? value : { status: "error", spec: null, error },
      ])));
    });
    return () => {
      cancelled = true;
      runtime.destroy();
    };
  }, [stories]);

  const openStory = (example: VisualizationExample, ask?: string) => {
    const query = new URLSearchParams({ example: example.id });
    if (ask) query.set("ai", "general");
    // A document navigation is deliberate here. It immediately disposes the
    // gallery's preview worker and gives the editor a clean runtime; the URL
    // carries everything Explorer needs to reconstruct the handoff.
    window.location.assign(`/explore?${query}`);
  };
  const reportError = useCallback((id: string, error: string) => {
    setStoryState((current) => ({ ...current, [id]: { status: "error", spec: null, error } }));
  }, []);

  return (
    <main className="home-page">
      <div className="home-canvas">
        <section className="home-proposition" aria-labelledby="home-proposition-heading">
          <Link className="home-proposition-brand" href="/" aria-label="Chartize home">
            <span className="brand-mark" aria-hidden="true" />
            <b>chartize</b>
          </Link>
          <h1 id="home-proposition-heading">turn data into graphs, charts, and maps. then ask what they mean</h1>
          <button type="button" onClick={() => window.location.assign("/explore?new=blank")}>start blank <span aria-hidden="true">→</span></button>
        </section>
        {HOME_SECTIONS.map((section) => (
          <section key={section.id} className={`home-editorial-section section-${section.id}`} aria-labelledby={`home-${section.id}-heading`}>
            <header className="home-editorial-heading">
              <h2 id={`home-${section.id}-heading`}>{section.index} / {section.eyebrow}</h2>
            </header>
            <div className="home-story-grid" aria-label={`${section.eyebrow} visualizations`}>
              {stories.filter(({ definition }) => definition.section === section.id).map(({ definition, example }) => (
                <HomeStory
                  key={example.id}
                  definition={definition}
                  example={example}
                  state={storyState[example.id]!}
                  onOpen={() => openStory(example)}
                  onAsk={() => openStory(example, definition.ask)}
                  onError={(message) => reportError(example.id, message)}
                />
              ))}
            </div>
          </section>
        ))}
        <footer className="home-footer"><span>Chartize</span><Link href="/about">about</Link></footer>
      </div>
    </main>
  );
}

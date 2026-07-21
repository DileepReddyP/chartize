"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { BrowserVisualizationSpecSchema } from "@/lib/local/worker-protocol";
import { initializeBrowserRuntime, releaseBrowserWorkspace, runWorkspaceGgsql } from "@/lib/local/browser-runtime";
import { VISUALIZATION_EXAMPLES, type VisualizationExample } from "@/lib/ggsql/examples";
import { workspaceInputForExample } from "@/lib/workspace/example-workspace";
import { useChartizeWorkspace } from "@/lib/workspace/store";
import { ChartView } from "./chart-view";

interface HomeStoryDefinition {
  id: string;
  section: "signals" | "context" | "everyday";
  columns: number;
  minHeight: number;
  eyebrow: string;
  ask?: string;
}

const HOME_STORIES: HomeStoryDefinition[] = [
  { id: "approval-uncertainty", section: "signals", columns: 7, minHeight: 356, eyebrow: "public opinion", ask: "What changed in presidential approval, and what can this average establish versus only suggest?" },
  { id: "mta-route-delay-map", section: "signals", columns: 5, minHeight: 356, eyebrow: "city motion", ask: "Which subway services expose the most riders to delay, and what should I compare next?" },
  { id: "world-population-map", section: "context", columns: 5, minHeight: 356, eyebrow: "people + place", ask: "Why is the world’s population distributed this way, and which geographic comparisons are most revealing?" },
  { id: "world-development-bubbles", section: "context", columns: 7, minHeight: 356, eyebrow: "linked evidence", ask: "Explain the major outliers in health versus prosperity without treating the relationship as causal." },
  { id: "world-temperature-stripes", section: "context", columns: 12, minHeight: 270, eyebrow: "climate signal", ask: "Explain the warming pattern and distinguish an annual anomaly from absolute temperature." },
  { id: "june-temperature-heatmap", section: "everyday", columns: 5, minHeight: 350, eyebrow: "weather calendar" },
  { id: "cocoa-top-countries", section: "everyday", columns: 7, minHeight: 350, eyebrow: "food, lightly", ask: "Why do these countries lead cocoa-bean supply per person, and what does this measure leave out?" },
  { id: "us-land-use-square", section: "everyday", columns: 12, minHeight: 360, eyebrow: "land + composition", ask: "What does this land-use atlas reveal, and why should I not read each tile as its physical location?" },
];

const HOME_SECTIONS = [
  { id: "signals", index: "01", eyebrow: "signals in motion" },
  { id: "context", index: "02", eyebrow: "the wider pattern" },
  { id: "everyday", index: "03", eyebrow: "the surprisingly measurable" },
] as const;

type StoryState = { status: "queued" | "loading" | "ready" | "error"; spec: Record<string, unknown> | null; error: string };

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
          <ChartView
            spec={presentedSpec}
            interactive={false}
            mapMode={/\bDRAW\s+spatial\b/i.test(example.query)}
            mapViewport={example.id === "mta-route-delay-map" ? { zoom: 1.25, panX: 0, panY: 0.05 } : undefined}
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
  const router = useRouter();
  const openWorkspace = useChartizeWorkspace((state) => state.openWorkspace);
  const stories = useMemo(() => HOME_STORIES.flatMap((definition) => {
    const example = VISUALIZATION_EXAMPLES.find((candidate) => candidate.id === definition.id);
    return example ? [{ definition, example }] : [];
  }), []);
  const [storyState, setStoryState] = useState<Record<string, StoryState>>(() => Object.fromEntries(
    stories.map(({ example }) => [example.id, { status: "queued", spec: null, error: "" } satisfies StoryState]),
  ));

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      await initializeBrowserRuntime("chartize-home", process.env.NEXT_PUBLIC_SPATIALITE_WASM_URL ?? "/wasm/mod_spatialite.wasm");
      for (const { example } of stories) {
        if (cancelled) break;
        const workspaceId = `home-${example.id}`;
        setStoryState((current) => ({ ...current, [example.id]: { status: "loading", spec: null, error: "" } }));
        try {
          const spec = BrowserVisualizationSpecSchema.parse(await runWorkspaceGgsql(workspaceId, example.query));
          if (!cancelled) setStoryState((current) => ({ ...current, [example.id]: { status: "ready", spec, error: "" } }));
        } catch (cause) {
          const error = cause instanceof Error ? cause.message : String(cause);
          if (!cancelled) setStoryState((current) => ({ ...current, [example.id]: { status: "error", spec: null, error } }));
        } finally {
          // The returned Vega spec owns its inline rows. Releasing each WASM
          // context before loading the next story keeps the homepage bounded
          // to one transient query workspace instead of eight live engines.
          await releaseBrowserWorkspace(workspaceId).catch(() => undefined);
        }
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
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
    };
  }, [stories]);

  const openStory = (example: VisualizationExample, ask?: string) => {
    openWorkspace(workspaceInputForExample(example));
    if (ask) useChartizeWorkspace.getState().setAiPrompt(ask);
    router.push(`/explore?workspace=active${ask ? "&ai=general" : ""}`);
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
          <button type="button" onClick={() => router.push("/explore")}>start blank <span aria-hidden="true">→</span></button>
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
        <footer className="home-footer"><span>Chartize</span><p>follow the evidence · keep the source close · make the question visible</p><button type="button" onClick={() => router.push("/explore")}>start with a blank grid →</button></footer>
      </div>
    </main>
  );
}

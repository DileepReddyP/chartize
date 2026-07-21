import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const root = new URL("../../", import.meta.url);

async function source(path: string) {
  return readFile(new URL(path, root), "utf8");
}

describe("local-first browser boundary", () => {
  it("keeps storage and backend transport out of the React/Zustand workspace", async () => {
    const [store, runtime, components] = await Promise.all([
      source("lib/workspace/store.ts"),
      source("lib/local/browser-runtime.ts"),
      Promise.all([
        "components/explorer.tsx",
        "components/workspace-code-pane.tsx",
        "components/workspace-data-pane.tsx",
        "components/workspace-result-pane.tsx",
        "components/workspace-ai-overlay.tsx",
      ].map(source)).then((files) => files.join("\n")),
    ]);
    const mainThread = `${store}\n${runtime}\n${components}`;
    expect(mainThread).not.toMatch(/\bfetch\s*\(/);
    expect(mainThread).not.toMatch(/\bindexedDB\b|\bcaches\.|\bDexie\b/);
    expect(mainThread).not.toMatch(/\/engine\/api|\/api\/ai/);
  });

  it("keeps public data routes read-only and route-specific", async () => {
    const [catalog, artifact] = await Promise.all([
      source("app/engine/api/catalog/route.ts"),
      source("app/engine/api/datasets/[slug]/parquet/route.ts"),
    ]);
    expect(catalog).toContain("export async function GET");
    expect(artifact).toContain("export async function GET");
    expect(`${catalog}\n${artifact}`).not.toContain("export async function POST");
    expect(artifact).toContain("activeDatasetArtifact");
  });

  it("serializes homepage charts to SVG and releases their live Vega views", async () => {
    const [gallery, preview] = await Promise.all([
      source("components/home-gallery.tsx"),
      source("components/static-chart-preview.tsx"),
    ]);
    expect(gallery).toContain("StaticChartPreview");
    expect(gallery).not.toContain("<ChartView");
    expect(gallery).toContain("createIsolatedBrowserRuntime");
    expect(gallery).not.toContain("requestAnimationFrame");
    expect(gallery).not.toContain("router.push");
    expect(gallery).toContain("window.location.assign");
    expect(gallery).toContain('/explore?new=blank');
    expect(gallery).toContain('href="/about"');
    expect(gallery).not.toContain("follow the evidence");
    expect(preview).toContain("view.toSVG()");
    expect(preview).toContain("embedded.finalize()");
    expect(preview).not.toContain("requestAnimationFrame");
  });

  it("turns the homepage blank intent into a fresh, refresh-stable workspace", async () => {
    const lifecycle = await source("components/use-workspace-lifecycle.ts");
    expect(lifecycle).toContain('search.get("new") === "blank"');
    expect(lifecycle).toContain("await state.restoreWorkspaceSession().catch(() => false)");
    expect(lifecycle).toContain("openWorkspace(undefined, { run: false })");
    expect(lifecycle).toContain('searchParams.delete("new")');
    expect(lifecycle.indexOf('search.get("new") === "blank"')).toBeLessThan(lifecycle.indexOf("restoreWorkspaceSession()"));
  });
});

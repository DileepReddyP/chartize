import { readFile, readdir } from "node:fs/promises";
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

  it("serves pre-rendered homepage charts without starting the browser data runtime", async () => {
    const [gallery, previews] = await Promise.all([
      source("components/home-gallery.tsx"),
      readdir(new URL("public/home-previews/", root)),
    ]);
    expect(gallery).not.toContain('"use client"');
    expect(gallery).toContain("/home-previews/");
    expect(gallery).toContain("<img");
    expect(gallery).not.toContain("<ChartView");
    expect(gallery).not.toContain("createIsolatedBrowserRuntime");
    expect(gallery).not.toContain("StaticChartPreview");
    expect(gallery).not.toContain("window.location.assign");
    expect(gallery).toContain('<a href={explorerHref(example)}>');
    expect(gallery).not.toContain('<Link href={explorerHref(example)}>');
    expect(gallery).toContain('/explore?new=blank');
    expect(gallery).toContain('href="/about"');
    expect(gallery).not.toContain("follow the evidence");
    expect(previews.filter((name) => name.endsWith(".svg"))).toHaveLength(9);
  });

  it("turns the homepage blank intent into a fresh, refresh-stable workspace", async () => {
    const lifecycle = await source("components/use-workspace-lifecycle.ts");
    expect(lifecycle).toContain('search.get("new") === "blank"');
    expect(lifecycle).toContain("await state.restoreWorkspaceSession().catch(() => false)");
    expect(lifecycle).toContain("openWorkspace(undefined, { run: false, replacePristineBootstrap: true })");
    expect(lifecycle).toContain('searchParams.delete("new")');
    expect(lifecycle.indexOf('search.get("new") === "blank"')).toBeLessThan(lifecycle.indexOf("restoreWorkspaceSession()"));
  });

  it("keeps a first-time direct explorer session blank", async () => {
    const lifecycle = await source("components/use-workspace-lifecycle.ts");
    expect(lifecycle).not.toContain('slug === "presidential_approval_average"');
    expect(lifecycle).not.toContain("state.catalogDatasets[0]");
  });

  it("restores saved workspaces before consuming a homepage example", async () => {
    const lifecycle = await source("components/use-workspace-lifecycle.ts");
    const exampleBranch = lifecycle.slice(
      lifecycle.indexOf("} else if (homeExample)"),
      lifecycle.indexOf('} else if (search.get("workspace") === "active")'),
    );
    expect(exampleBranch).toContain("await state.restoreWorkspaceSession().catch(() => false)");
    expect(exampleBranch).toContain("replacePristineBootstrap: true");
    expect(exampleBranch).toContain('searchParams.delete("example")');
  });
});

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

  it("keeps the public engine proxy read-only and route-limited", async () => {
    const proxy = await source("app/engine/[...path]/route.ts");
    expect(proxy).toContain("export const GET = proxy");
    expect(proxy).not.toContain("export const POST");
    expect(proxy).toContain('path[1] === "catalog"');
    expect(proxy).toContain('path[3] === "parquet"');
  });
});

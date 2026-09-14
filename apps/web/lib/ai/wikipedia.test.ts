import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { retrieveWikipediaArticle, searchWikipedia } from "./wikipedia";

describe("Wikipedia tools", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("searches only English Wikipedia and returns clean, bounded snippets", async () => {
    const fetchMock = vi.fn(async (_url: URL | RequestInfo) => Response.json({ query: { search: [{ title: "History", snippet: "<span>History</span> &amp; context" }] } }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await searchWikipedia({ query: "history" });
    const url = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(url.origin).toBe("https://en.wikipedia.org");
    expect(url.searchParams.get("srlimit")).toBe("5");
    expect(result.results[0]?.snippet).toBe("History & context");
  });

  it("retrieves an article in bounded slices with attribution and a next offset", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ query: { pages: [{ title: "History", pageid: 1, extract: "x".repeat(15_000), lastrevid: 123 }] } })));
    const article = await retrieveWikipediaArticle({ title: "History", offset: 0 });
    expect(article.text).toHaveLength(12_000);
    expect(article.nextOffset).toBe(12_000);
    expect(article.revisionUrl).toContain("oldid=123");
    expect(article.attribution).toContain("Wikipedia contributors");
  });
});

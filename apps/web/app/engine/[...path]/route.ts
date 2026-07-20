import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ path: string[] }> };

async function proxy(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  const catalog = path.length === 2 && path[0] === "api" && path[1] === "catalog";
  const dataset = path.length === 4
    && path[0] === "api"
    && path[1] === "datasets"
    && /^[a-z0-9_]+$/.test(path[2] ?? "")
    && path[3] === "parquet";
  if (!catalog && !dataset) return Response.json({ error: "Not found." }, { status: 404 });
  const base = (process.env.ENGINE_URL ?? "http://127.0.0.1:8787").replace(/\/$/, "");
  const target = `${base}/${path.map(encodeURIComponent).join("/")}${request.nextUrl.search}`;
  const headers = new Headers();
  for (const name of ["accept"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  try {
    const response = await fetch(target, { method: "GET", headers, cache: "no-store" });
    const responseHeaders = new Headers();
    for (const name of ["content-type", "content-length", "cache-control", "etag", "last-modified"]) {
      const value = response.headers.get(name);
      if (value) responseHeaders.set(name, value);
    }
    return new Response(response.body, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch {
    return Response.json({ error: "The Chartize data service is unavailable." }, { status: 502 });
  }
}

export const GET = proxy;

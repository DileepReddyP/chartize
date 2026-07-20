import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import { activeDatasetArtifact, dataServiceErrorResponse } from "@/lib/server/data-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ slug: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const version = new URL(request.url).searchParams.get("version") ?? "";
    const artifact = await activeDatasetArtifact(slug, version);
    const body = Readable.toWeb(createReadStream(artifact.path)) as ReadableStream<Uint8Array>;
    return new Response(body, {
      headers: {
        "content-type": "application/vnd.apache.parquet",
        "content-length": String(artifact.size),
        "cache-control": "private, max-age=31536000, immutable",
        etag: `"${artifact.version}"`,
      },
    });
  } catch (cause) {
    return dataServiceErrorResponse(cause);
  }
}

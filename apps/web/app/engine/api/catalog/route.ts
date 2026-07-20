import { dataServiceErrorResponse, listDatasets } from "@/lib/server/data-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json(await listDatasets(), {
      headers: { "cache-control": "private, no-store" },
    });
  } catch (cause) {
    return dataServiceErrorResponse(cause);
  }
}

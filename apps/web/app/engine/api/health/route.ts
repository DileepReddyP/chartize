import { dataServiceErrorResponse, dataServiceHealth } from "@/lib/server/data-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json(await dataServiceHealth(), { headers: { "cache-control": "no-store" } });
  } catch (cause) {
    return dataServiceErrorResponse(cause);
  }
}

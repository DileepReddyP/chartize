import { assertAdminRequest, dataServiceErrorResponse, rollbackDataset } from "@/lib/server/data-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ slug: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    await assertAdminRequest(request);
    const { slug } = await context.params;
    return Response.json(await rollbackDataset(slug));
  } catch (cause) {
    return dataServiceErrorResponse(cause, "Dataset rollback failed.");
  }
}

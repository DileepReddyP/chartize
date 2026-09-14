import { assertAdminRequest, dataServiceErrorResponse, publishDataset } from "@/lib/server/data-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    await assertAdminRequest(request);
    return Response.json(await publishDataset(await request.formData()));
  } catch (cause) {
    return dataServiceErrorResponse(cause, "Dataset import failed.");
  }
}

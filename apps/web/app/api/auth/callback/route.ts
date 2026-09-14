import { finishLogin } from "@/lib/auth/atproto";
import { publicOrigin } from "@/lib/auth/session";

export const runtime = "nodejs";

export async function GET(request: Request) {
  let success = false;
  try { await finishLogin(new URL(request.url).searchParams); success = true; }
  catch { success = false; }
  return new Response(null, {
    status: 303,
    headers: { location: `${publicOrigin()}/login/complete?status=${success ? "confirmed" : "incomplete"}`, "cache-control": "no-store", "referrer-policy": "no-referrer" },
  });
}

import { z } from "zod";
import { completeLogin, oauthClient, startLogin } from "@/lib/auth/atproto";
import { AuthError, assertSameOrigin, chatUser, logout, readJson } from "@/lib/auth/session";
import { withPublicProfile } from "@/lib/auth/public-profile";
import { withAdminRole } from "@/lib/auth/admin";

export const runtime = "nodejs";
type Context = { params: Promise<{ action: string }> };
const json = (value: unknown, status = 200) => Response.json(value, { status, headers: { "cache-control": "no-store" } });
/** Converts authentication failures into public status codes and messages. */
function failure(error: unknown) {
  return error instanceof AuthError ? json({ error: error.message }, error.status)
    : json({ error: "Login could not be completed. Please try again." }, 503);
}

export async function GET(_request: Request, context: Context) {
  try {
    const { action } = await context.params;
    if (action === "session") return json({ user: withAdminRole(await withPublicProfile(await chatUser())) });
    if (action === "client-metadata.json" || action === "jwks.json") {
      const client = await oauthClient();
      return Response.json(action === "jwks.json" ? client.jwks : client.clientMetadata, { headers: { "cache-control": "public, max-age=300" } });
    }
    return json({ error: "Not found." }, 404);
  } catch (error) { return failure(error); }
}

export async function POST(request: Request, context: Context) {
  try {
    assertSameOrigin(request);
    const { action } = await context.params;
    if (action === "login") {
      const body = z.object({ provider: z.literal("atproto") }).safeParse(await readJson(request, 2000));
      if (!body.success) throw new AuthError("Choose a supported login provider.");
      return json({ url: await startLogin(request.signal) });
    }
    if (action === "complete") return json({ user: withAdminRole(await completeLogin()) });
    if (action === "logout") { await logout(); return json({ user: null }); }
    return json({ error: "Not found." }, 404);
  } catch (error) { return failure(error); }
}

import { AiStreamEventSchema, AiTurnEnvelopeSchema } from "@chartize/contracts";
import { z } from "zod";
import { publicAiError } from "@/lib/ai/model-output";
import { completeAiTurn } from "@/lib/ai/turn";
import { AuthError, assertSameOrigin, chatUser, readJson } from "@/lib/auth/session";
import { reserveAiRequest } from "@/lib/auth/ai-access";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body;
  let access;
  try {
    assertSameOrigin(request);
    const user = await chatUser();
    if (!user) throw new AuthError("Sign in to use Chartize AI. Your workspace stays in this browser.", 401);
    if (request.headers.get("x-chartize-profile") !== user.did) throw new AuthError("Your profile changed. Reload Chartize before sending another message.", 409);
    body = AiTurnEnvelopeSchema.parse(await readJson(request));
    access = reserveAiRequest(user.did, !body.turnId);
  } catch (error) {
    return Response.json({ error: error instanceof AuthError ? error.message : error instanceof z.ZodError ? "Invalid AI request." : "Chartize AI is unavailable right now." }, {
      status: error instanceof AuthError ? error.status : error instanceof z.ZodError ? 400 : 503,
      headers: { "cache-control": "no-store", ...(error instanceof AuthError && error.status === 429 ? { "retry-after": "60" } : {}) },
    });
  }
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(300_000)]);
  const options = { owner: access.owner, signal };
  if (!request.headers.get("accept")?.includes("application/x-ndjson")) {
    try { return Response.json(await completeAiTurn(body, options), { headers: { "cache-control": "no-store" } }); }
    catch (error) { return Response.json({ error: publicAiError(error) }, { status: 503, headers: { "cache-control": "no-store" } }); }
    finally { access.release(); }
  }
  const controller = new AbortController();
  const encoder = new TextEncoder();
  let closed = false;
  return new Response(new ReadableStream<Uint8Array>({
    start(stream) {
      const send = (event: unknown) => {
        if (!closed) stream.enqueue(encoder.encode(`${JSON.stringify(AiStreamEventSchema.parse(event))}\n`));
      };
      void completeAiTurn(body, { ...options, signal: AbortSignal.any([signal, controller.signal]), onProgress: (message) => send({ type: "progress", message }) })
        .then((response) => send({ type: "result", response }))
        .catch((error) => send({ type: "error", error: publicAiError(error) }))
        .finally(() => { access.release(); if (!closed) { closed = true; stream.close(); } });
    },
    cancel() { closed = true; controller.abort(); },
  }), { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store, no-transform", "x-accel-buffering": "no" } });
}

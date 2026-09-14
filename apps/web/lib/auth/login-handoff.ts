const channelName = "chartize-login";

/** Returns a successful provider popup to its originating tab before hydration. */
export const loginReturnScript = `try{const c=new BroadcastChannel('${channelName}');c.postMessage('complete');c.close()}catch{}try{window.close()}catch{}setTimeout(()=>window.location.replace('/login/complete?status=return'),500)`;

/** Checks a pending login on a timer and whenever the originating tab resumes. */
export function watchLoginCompletion(complete: (signal: AbortSignal) => Promise<boolean>, onError: (error: unknown) => void) {
  const controller = new AbortController();
  const started = Date.now();
  let timer: ReturnType<typeof setTimeout>;
  let inFlight = false;
  let queued = false;
  let finished = false;

  const poll = async () => {
    if (finished) return;
    if (inFlight) { queued = true; return; }
    clearTimeout(timer);
    inFlight = true;
    try {
      if (await complete(controller.signal)) { finished = true; return; }
      if (Date.now() - started > 10 * 60_000) throw new Error("Login expired. Try again.");
    } catch (error) {
      finished = true;
      if (!controller.signal.aborted) onError(error);
    } finally {
      inFlight = false;
      if (!finished) timer = setTimeout(poll, queued ? 0 : 2000);
      queued = false;
    }
  };
  const resume = () => { if (document.visibilityState === "visible") void poll(); };
  const channel = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel(channelName);
  if (channel) channel.onmessage = (event) => { if (event.data === "complete") void poll(); };
  window.addEventListener("focus", resume);
  window.addEventListener("pageshow", resume);
  document.addEventListener("visibilitychange", resume);
  timer = setTimeout(poll, 1000);

  return () => {
    finished = true;
    controller.abort();
    clearTimeout(timer);
    window.removeEventListener("focus", resume);
    window.removeEventListener("pageshow", resume);
    document.removeEventListener("visibilitychange", resume);
    channel?.close();
  };
}

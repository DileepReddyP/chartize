import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { watchLoginCompletion } from "./login-handoff";

let channel: { onmessage?: (event: { data: string }) => void; close: () => void };
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("window", new EventTarget());
  vi.stubGlobal("document", Object.assign(new EventTarget(), { visibilityState: "visible" }));
  vi.stubGlobal("BroadcastChannel", class {
    onmessage?: (event: { data: string }) => void;
    close = vi.fn();
    constructor() { channel = this; }
  });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

it("serializes popup, focus and visibility notifications around a pending completion", async () => {
  let resolve!: (complete: boolean) => void;
  const complete = vi.fn().mockImplementationOnce(() => new Promise<boolean>((done) => { resolve = done; })).mockResolvedValue(true);
  const error = vi.fn();
  const stop = watchLoginCompletion(complete, error);
  try {
    await vi.advanceTimersByTimeAsync(1000);
    window.dispatchEvent(new Event("focus"));
    document.dispatchEvent(new Event("visibilitychange"));
    channel.onmessage?.({ data: "complete" });
    expect(complete).toHaveBeenCalledTimes(1);
    resolve(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(complete).toHaveBeenCalledTimes(2);
    window.dispatchEvent(new Event("pageshow"));
    await vi.advanceTimersByTimeAsync(5000);
    expect(complete).toHaveBeenCalledTimes(2);
    expect(error).not.toHaveBeenCalled();
  } finally { stop(); }
});

it("aborts and removes wake listeners when login is cancelled", async () => {
  let signal!: AbortSignal;
  let reject!: (error: Error) => void;
  const error = vi.fn();
  const complete = vi.fn((pending: AbortSignal) => {
    signal = pending;
    return new Promise<boolean>((_, fail) => { reject = fail; });
  });
  const stop = watchLoginCompletion(complete, error);
  await vi.advanceTimersByTimeAsync(1000);
  stop();
  expect(signal.aborted).toBe(true);
  expect(channel.close).toHaveBeenCalledOnce();
  reject(new Error("aborted"));
  window.dispatchEvent(new Event("focus"));
  document.dispatchEvent(new Event("visibilitychange"));
  await vi.advanceTimersByTimeAsync(5000);
  expect(complete).toHaveBeenCalledOnce();
  expect(error).not.toHaveBeenCalled();
});

it("expires pending logins even when BroadcastChannel is unavailable", async () => {
  vi.stubGlobal("BroadcastChannel", undefined);
  const error = vi.fn();
  const complete = vi.fn().mockResolvedValue(false);
  const stop = watchLoginCompletion(complete, error);
  try {
    vi.setSystemTime(Date.now() + 10 * 60_000);
    await vi.advanceTimersByTimeAsync(1000);
    expect(error).toHaveBeenCalledWith(expect.objectContaining({ message: "Login expired. Try again." }));
    await vi.advanceTimersByTimeAsync(5000);
    expect(complete).toHaveBeenCalledOnce();
  } finally { stop(); }
});

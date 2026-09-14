"use client";

import { useEffect, useRef, useState } from "react";
import { watchLoginCompletion } from "@/lib/auth/login-handoff";
import type { ChatUser } from "./profile-provider";

/** Runs one browser-bound provider login across the profile menu and chat gate. */
export function useAtprotoLogin(onSignedIn: (user: ChatUser) => Promise<void>) {
  const [status, setStatus] = useState<"idle" | "starting" | "waiting">("idle");
  const [error, setError] = useState("");
  const [url, setUrl] = useState("");
  const popup = useRef<Window | null>(null);
  const request = useRef<AbortController | null>(null);

  useEffect(() => () => { request.current?.abort(); popup.current?.close(); }, []);

  useEffect(() => {
    if (status !== "waiting") return;
    return watchLoginCompletion(async (signal) => {
      const response = await fetch("/api/auth/complete", { method: "POST", signal });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Login expired. Try again.");
      if (!result.user) return false;
      try { popup.current?.close(); } catch { /* The provider window may already be closed. */ }
      await onSignedIn(result.user);
      setStatus("idle");
      return true;
    }, (failure) => {
      setError(failure instanceof Error ? failure.message : "Login failed.");
      setStatus("idle");
    });
  }, [status, onSignedIn]);

  const start = async () => {
    if (request.current || status !== "idle") return;
    const controller = new AbortController();
    request.current = controller;
    setStatus("starting");
    setError("");
    popup.current = window.open("about:blank", "chartize-sign-in", "popup,width=600,height=760");
    if (popup.current) popup.current.opener = null;
    try {
      const response = await fetch("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ provider: "atproto" }), signal: AbortSignal.any([controller.signal, AbortSignal.timeout(50_000)]) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Couldn't start login.");
      setUrl(result.url);
      if (popup.current && !popup.current.closed) popup.current.location.href = result.url;
      setStatus("waiting");
    } catch (failure) {
      popup.current?.close();
      if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "Couldn't start login.");
      setStatus("idle");
    } finally { request.current = null; }
  };

  const cancel = () => { request.current?.abort(); popup.current?.close(); setStatus("idle"); setError(""); };
  return { status, error, url, start, cancel };
}

import "server-only";

import { authStore } from "./store";
import { AuthError, hashToken } from "./session";

const globals = globalThis as typeof globalThis & { chartizeActiveAi?: Set<string> };
const active = globals.chartizeActiveAi ??= new Set<string>();
function limit(name: string, fallback: number) {
  const value = Number(process.env[name] ?? fallback);
  return Number.isSafeInteger(value) && value >= 0 ? value : fallback;
}

/** Reserves request concurrency and persistent per-account/site usage allowances. */
export function reserveAiRequest(did: string, newTurn: boolean) {
  const owner = hashToken(did);
  if (active.has(owner)) throw new AuthError("Your other AI request is still running.", 429);
  if (active.size >= 4) throw new AuthError("Chartize AI is busy. Try again shortly.", 429);
  const day = new Date().toISOString().slice(0, 10);
  const minute = Math.floor(Date.now() / 60_000);
  const limits = [{ key: `minute:${owner}:${minute}`, max: 20, ttl: 120_000 }];
  if (newTurn) limits.push(
    { key: `day:${owner}:${day}`, max: limit("CHARTIZE_AI_USER_DAILY_TURNS", 50), ttl: 172_800_000 },
    { key: `day:all:${day}`, max: limit("CHARTIZE_AI_DAILY_TURNS", 300), ttl: 172_800_000 },
  );
  if (!authStore().reserve(limits)) throw new AuthError("The AI usage limit has been reached. You can keep exploring locally and try chat again later.", 429);
  active.add(owner);
  return { owner, release: () => { active.delete(owner); } };
}

"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { z } from "zod";
import { configureBrowserProfile } from "@/lib/local/browser-runtime";
import { BrowserProfileIdSchema } from "@/lib/local/worker-protocol";
import { useChartizeWorkspace } from "@/lib/workspace/store";
import { useAtprotoLogin } from "./use-atproto-login";
import { useProfileAppearance, type ThemeMode } from "./use-profile-appearance";

const ChatUserSchema = z.object({ did: BrowserProfileIdSchema.refine((id) => id !== "anonymous"), handle: z.string().min(1), avatar: z.url({ protocol: /^https$/ }).max(2048).optional(), isAdmin: z.boolean() });
export type ChatUser = z.infer<typeof ChatUserSchema>;

interface ProfileContextValue {
  user: ChatUser | null | undefined;
  ready: boolean;
  switching: boolean;
  error: string;
  theme: ThemeMode;
  resolvedTheme: "light" | "dark";
  setTheme: (theme: ThemeMode) => void;
  refresh: () => Promise<void>;
  setUser: (user: ChatUser) => Promise<void>;
  signOut: () => Promise<void>;
  login: ReturnType<typeof useAtprotoLogin>;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

/** Flushes the current profile's restored session before an account transition. */
async function saveCurrentProfile() {
  const workspace = useChartizeWorkspace.getState();
  if (workspace.workspaceSessionReady) await workspace.persistWorkspaceSession();
}

/** Shares verified identity, profile transitions and appearance across the studio. */
export function ProfileProvider({ children }: { children: ReactNode }) {
  const [user, setIdentity] = useState<ChatUser | null>();
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState("");
  const { theme, resolvedTheme, setTheme, restoreAppearance } = useProfileAppearance();
  const activeProfile = useRef<string | undefined>(undefined);
  const changing = useRef(false);
  const sequence = useRef(0);
  const channel = useRef<BroadcastChannel | null>(null);

  const applyIdentity = useCallback(async (next: ChatUser | null, announce = false) => {
    if (changing.current) return;
    const profileId = next?.did ?? "anonymous";
    if (activeProfile.current !== undefined && activeProfile.current !== profileId) {
      changing.current = true;
      setSwitching(true);
      try {
        await saveCurrentProfile();
        const workspace = useChartizeWorkspace.getState();
        const signingIn = activeProfile.current === "anonymous" && next !== null;
        const carryWorkspace = signingIn && workspace.workspaceSessionReady;
        if (carryWorkspace) await workspace.adoptAnonymousWorkspace(profileId);
        if (announce) channel.current?.postMessage("session-changed");
        const destination = signingIn && !workspace.workspaceSessionReady
          ? window.location.href
          : `${window.location.pathname}${carryWorkspace && workspace.aiOpen ? "?ai=resume" : ""}`;
        window.location.replace(destination);
      } catch (failure) {
        changing.current = false;
        setSwitching(false);
        throw new Error(`Couldn't save your workspace. ${failure instanceof Error ? failure.message : "Please try again."}`);
      }
      return;
    }
    configureBrowserProfile(profileId);
    if (activeProfile.current === undefined) restoreAppearance(profileId);
    activeProfile.current = profileId;
    setIdentity(next);
    setError("");
  }, [restoreAppearance]);

  const refresh = useCallback(async () => {
    const request = ++sequence.current;
    try {
      const response = await fetch("/api/auth/session", { cache: "no-store", signal: AbortSignal.timeout(10_000) });
      if (!response.ok) throw new Error("Couldn't check sign-in. Please try again.");
      const result = z.object({ user: ChatUserSchema.nullable() }).parse(await response.json());
      if (request === sequence.current) await applyIdentity(result.user);
    } catch (failure) {
      if (request !== sequence.current) return;
      if (activeProfile.current === undefined) await applyIdentity(null);
      setError(failure instanceof Error ? failure.message : "Couldn't check sign-in.");
    }
  }, [applyIdentity]);

  useEffect(() => {
    void refresh();
    window.addEventListener("focus", refresh);
    if (typeof BroadcastChannel !== "undefined") {
      channel.current = new BroadcastChannel("chartize-account");
      channel.current.onmessage = () => void refresh();
    }
    return () => { window.removeEventListener("focus", refresh); channel.current?.close(); };
  }, [refresh]);

  const setUser = useCallback(async (next: ChatUser) => {
    sequence.current++;
    await applyIdentity(ChatUserSchema.parse(next), true);
  }, [applyIdentity]);
  const login = useAtprotoLogin(setUser);
  const signOut = async () => {
    sequence.current++;
    setError("");
    setSwitching(true);
    try {
      await saveCurrentProfile();
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("Couldn't sign out. Please try again.");
      await applyIdentity(null, true);
    } catch (failure) {
      setSwitching(false);
      setError(failure instanceof Error ? failure.message : "Couldn't sign out.");
    }
  };

  return <ProfileContext.Provider value={{ user, ready: user !== undefined && !switching, switching, error, theme, resolvedTheme, setTheme, refresh, setUser, signOut, login }}>{children}</ProfileContext.Provider>;
}

/** Reads the studio-wide account and appearance controls. */
export function useProfile() {
  const profile = useContext(ProfileContext);
  if (!profile) throw new Error("Profile controls must be inside ProfileProvider.");
  return profile;
}

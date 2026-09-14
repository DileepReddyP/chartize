"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type ThemeMode = "system" | "light" | "dark";

/** Restores per-profile appearance and follows the system's color scheme. */
export function useProfileAppearance() {
  const profile = useRef<string | undefined>(undefined);
  const [ready, setReady] = useState(false);
  const [theme, setThemeValue] = useState<ThemeMode>("system");
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light");

  const restoreAppearance = useCallback((profileId: string) => {
    profile.current = profileId;
    let preference: ThemeMode = "system";
    try {
      const saved = localStorage.getItem(`chartize:theme:${profileId}`);
      if (saved === "light" || saved === "dark") preference = saved;
      localStorage.setItem("chartize:appearance-profile", profileId);
    } catch { /* Browser appearance storage is optional. */ }
    setThemeValue(preference);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const media = matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const resolved = theme === "system" ? media.matches ? "dark" : "light" : theme;
      document.documentElement.dataset.theme = resolved;
      setResolvedTheme(resolved);
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme, ready]);

  const setTheme = (next: ThemeMode) => {
    setThemeValue(next);
    try { localStorage.setItem(`chartize:theme:${profile.current ?? "anonymous"}`, next); } catch { /* Keep the in-memory preference. */ }
  };

  return { theme, resolvedTheme, setTheme, restoreAppearance };
}

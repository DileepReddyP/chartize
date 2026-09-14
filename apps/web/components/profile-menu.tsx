"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { containFloating } from "@/lib/floating-placement";
import { useChartizeWorkspace } from "@/lib/workspace/store";
import { AiLogin } from "./ai-login";
import { useProfile } from "./profile-provider";
import type { ThemeMode } from "./use-profile-appearance";
import { HeaderButton } from "./header-control";
import { UiIcon } from "./ui-icons";
import { ProfileAvatar } from "./profile-avatar";

const appearances = [
  { theme: "light", icon: "sun", label: "Always light" },
  { theme: "dark", icon: "moon", label: "Always dark" },
  { theme: "system", icon: "monitor", label: "Use system appearance" },
] as const satisfies readonly { theme: ThemeMode; icon: "sun" | "moon" | "monitor"; label: string }[];

/** Account actions and per-profile appearance in a viewport-bounded popover. */
export function ProfileMenu() {
  const profile = useProfile();
  const busy = useChartizeWorkspace((state) => state.aiBusy);
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const id = useId();
  const [position, setPosition] = useState<CSSProperties>({});

  useLayoutEffect(() => {
    if (!open) return;
    const fit = () => {
      const anchor = trigger.current?.getBoundingClientRect();
      const menu = panel.current;
      if (!anchor || !menu) return;
      const viewport = window.visualViewport;
      const left = viewport?.offsetLeft ?? 0;
      const top = viewport?.offsetTop ?? 0;
      const bounds = containFloating({ left: anchor.right - 300, top: anchor.bottom + 8 },
        { width: 300, height: menu.scrollHeight + 4 },
        { left, top, right: left + (viewport?.width ?? innerWidth), bottom: top + (viewport?.height ?? innerHeight) });
      setPosition({ left: bounds.left, top: bounds.top, width: bounds.width, maxHeight: bounds.maxHeight });
    };
    fit();
    const observer = new ResizeObserver(fit);
    if (panel.current) observer.observe(panel.current);
    window.addEventListener("resize", fit);
    window.addEventListener("scroll", fit, true);
    window.visualViewport?.addEventListener("resize", fit);
    window.visualViewport?.addEventListener("scroll", fit);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", fit);
      window.removeEventListener("scroll", fit, true);
      window.visualViewport?.removeEventListener("resize", fit);
      window.visualViewport?.removeEventListener("scroll", fit);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !panel.current?.contains(event.target) && !trigger.current?.contains(event.target)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      setOpen(false);
      trigger.current?.focus();
    };
    document.addEventListener("pointerdown", dismiss, true);
    document.addEventListener("keydown", escape, true);
    panel.current?.querySelector<HTMLButtonElement>("button")?.focus();
    return () => { document.removeEventListener("pointerdown", dismiss, true); document.removeEventListener("keydown", escape, true); };
  }, [open]);

  return <>
    <HeaderButton ref={trigger} className="profile-trigger" label="Profile and appearance" icon={<ProfileAvatar user={profile.user} />} iconOnly aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? id : undefined} title={profile.user?.handle ?? "Profile and appearance"} onClick={() => setOpen(!open)} />
    {open && createPortal(<div ref={panel} id={id} className="profile-menu" role="dialog" aria-label="Profile and appearance" style={position}>
      <header><ProfileAvatar user={profile.user} /><div><b>{profile.user?.handle ?? "profile"}</b>{profile.switching && <small>switching profile…</small>}</div><HeaderButton label="Close profile menu" icon={<UiIcon name="close" />} iconOnly onClick={() => { setOpen(false); trigger.current?.focus(); }} /></header>
      <div className="profile-appearance" role="group" aria-labelledby={`${id}-appearance`}>
        <span id={`${id}-appearance`}>appearance</span>
        <div>{appearances.map(({ theme, icon, label }) => <HeaderButton key={theme} icon={<UiIcon name={icon} />} label={theme === "system" && profile.theme === "system" ? `${label} (currently ${profile.resolvedTheme})` : label} iconOnly aria-pressed={profile.theme === theme} disabled={!profile.ready} onClick={() => profile.setTheme(theme)} />)}</div>
      </div>
      {profile.user ? <div className="profile-actions">
        {profile.error && <p role="alert">{profile.error}</p>}
        {profile.user.isAdmin && <Link className="accent-action" href="/admin" prefetch={false} onClick={() => setOpen(false)}>admin <span aria-hidden="true">↗</span></Link>}
        <button className="accent-action" type="button" disabled={busy || profile.switching} onClick={() => void profile.signOut()}>log out <span aria-hidden="true">↗</span></button>
      </div> : <AiLogin inline />}
    </div>, document.body)}
  </>;
}

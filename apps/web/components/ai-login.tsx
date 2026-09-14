"use client";

import { useProfile } from "./profile-provider";
import { UiIcon } from "./ui-icons";

/** Provider login actions shared by the profile menu and the floating chat gate. */
export function AiLogin({ inline = false, title = "log in to use chartize ai" }: { inline?: boolean; title?: string }) {
  const profile = useProfile();
  const { login } = profile;
  const pending = login.status === "waiting";
  return <div className={inline ? "profile-login" : "ai-login"} role="region" aria-label={inline ? "Log in" : title}><div className="ai-login-card">
    {!inline && <h3>{title}</h3>}
    <div className="login-providers">
      <button className="accent-action provider-login-button" type="button" autoFocus={!inline} disabled={!profile.ready || login.status !== "idle"} onClick={() => void login.start()}>
        <UiIcon name="at" /><span>{!profile.ready ? "checking login…" : login.status === "starting" ? "opening bluesky…" : pending ? "waiting for login…" : "log in with bluesky / atproto"}</span>
      </button>
    </div>
    {pending && <p className="ai-login-pending"><a href={login.url} target="_blank" rel="noreferrer">reopen login</a> · <button type="button" onClick={login.cancel}>cancel</button></p>}
    {(login.error || profile.error) && <p className="ai-login-error" role="alert">{login.error || profile.error}</p>}
  </div></div>;
}

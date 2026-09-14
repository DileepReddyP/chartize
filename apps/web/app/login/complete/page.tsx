import type { Metadata } from "next";
import { EditorialPage } from "@/components/editorial-page";
import { UiIcon } from "@/components/ui-icons";
import { chatUser, publicOrigin } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Login · Chartize", robots: { index: false, follow: false }, referrer: "no-referrer" };

/** Presents the provider handoff result and a route back to the original studio. */
export default async function LoginCompletePage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const confirmed = Boolean(await chatUser()) || (await searchParams).status === "confirmed";
  return <EditorialPage section="back to your workspace" compact>
    <section className={`login-return-panel${confirmed ? " confirmed" : ""}`}>
      <div className="login-return-mark" aria-hidden="true"><UiIcon name={confirmed ? "at" : "close"} /></div>
      <p className="editorial-kicker">bluesky / atproto</p>
      <h1>{confirmed ? "your account is confirmed." : "login wasn’t completed."}</h1>
      <p className="editorial-lede">{confirmed ? "Go back to the Chartize tab you started from to continue your conversation. You can close this window." : "Return to Chartize and try the login button again when you’re ready."}</p>
      <a className="accent-action" href={`${publicOrigin()}/`}>back to chartize <span aria-hidden="true">→</span></a>
    </section>
  </EditorialPage>;
}

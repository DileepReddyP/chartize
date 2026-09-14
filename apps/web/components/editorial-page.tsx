import Link from "next/link";
import type { ReactNode } from "react";
import { ProfileMenu } from "./profile-menu";

/** Shared page frame for project information and account handoffs. */
export function EditorialPage({ section, children, compact = false }: { section: string; children: ReactNode; compact?: boolean }) {
  return <div className={`editorial-page${compact ? " compact" : ""}`}>
    <header className="editorial-masthead">
      <Link className="brand" href="/" aria-label="Chartize home"><span className="brand-mark" aria-hidden="true" /><span>chartize</span></Link>
      <span className="editorial-section-label">{section}</span>
      <nav aria-label="Chartize navigation"><Link href="/">examples</Link><Link className="home-proposition-action" href="/explore">open studio <span aria-hidden="true">→</span></Link><ProfileMenu /></nav>
    </header>
    <main className="editorial-content">{children}</main>
    <footer className="editorial-footer"><span>chartize · data / code / conversation</span><Link href="/about">about the project</Link></footer>
  </div>;
}

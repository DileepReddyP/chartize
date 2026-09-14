import Link from "next/link";
import type { Metadata } from "next";
import { EditorialPage } from "@/components/editorial-page";

export const metadata: Metadata = {
  title: "About Chartize",
  description: "Explore data with GGSQL, charts, maps, and a conversation grounded in what you're looking at.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <EditorialPage section="about the project">
      <section className="editorial-hero">
        <div className="editorial-intro">
          <p className="editorial-kicker">01 / a closer look</p>
          <h1>a studio for data,<br />charts, and questions.</h1>
          <p className="editorial-lede">Open a dataset, shape a chart with GGSQL, and work through the results with Chartize AI. The data, the query, and the conversation stay together as you explore.</p>
          <Link className="accent-action" href="/explore">start exploring <span aria-hidden="true">→</span></Link>
        </div>
        <figure className="editorial-example">
          <figcaption><span>from the studio</span><b>a month of New York weather</b></figcaption>
          <div><img src="/home-previews/june-temperature-heatmap.svg" alt="Calendar heatmap of daily temperatures in New York during June 2026." width="566" height="232" /></div>
          <Link href="/explore?example=june-temperature-heatmap">open this example <span aria-hidden="true">↗</span></Link>
        </figure>
      </section>
      <section className="editorial-details" aria-label="Working in Chartize">
        <article><span className="editorial-kicker">02 / bring a question</span><h2>start with a dataset</h2><p>Try an example or import your own file. Browse the rows, choose a view, and change it as your question takes shape: a calendar of temperatures, a map of subway delays, or something entirely your own.</p></article>
        <article><span className="editorial-kicker">03 / shape the view</span><h2>write the picture in GGSQL</h2><p>GGSQL brings the Grammar of Graphics to SQL. One query describes both the data to select and the chart to draw. Edit the code yourself, or ask Chartize AI to help build and refine it.</p></article>
        <article><span className="editorial-kicker">04 / follow the thought</span><h2>ask about what you see</h2><p>Select a chart mark, a few rows, or a piece of code to give the conversation a starting point. Chartize AI can explain patterns, propose changes, and consult Wikipedia or search the web when a question needs outside context.</p></article>
      </section>
      <section className="editorial-note">
        <h2>your workspace lives in your browser</h2>
        <div><p>Charts, queries, uploads, and conversations are saved locally for each profile. You can explore as a guest; logging in unlocks Chartize AI and opens your account’s local workspaces.</p><p>When you ask the AI a question, relevant code and data context are sent to the AI service to help answer it.</p></div>
      </section>
      <p className="editorial-credit">Inspired by Posit’s GGSQL and the idea that a question should carry its context.</p>
    </EditorialPage>
  );
}

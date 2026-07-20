import Link from "next/link";

export default function AboutPage() {
  return (
    <main className="prose-page">
      <p className="eyebrow">Why this exists</p>
      <h1>Public data should be explorable, inspectable, and yours to question.</h1>
      <p className="lede">
        Chartize joins a self-hosted data catalog with GGSQL and browser-local analysis,
        and a GPT-5.6 copilot. Every picture keeps its query, source, version, and attribution.
      </p>
      <section className="principle-grid">
        <article><b>Private by default</b><p>Local files stay in your browser. AI sees only schema unless you explicitly share samples.</p></article>
        <article><b>Queries are artifacts</b><p>The GGSQL behind every chart is readable, editable, exportable, and reproducible.</p></article>
        <article><b>Built for civic work</b><p>Geographies, FIPS joins, polls, Census tables, and source methodology are first-class.</p></article>
      </section>
      <Link className="primary-button inline-button" href="/explore">Open Chartize →</Link>
    </main>
  );
}

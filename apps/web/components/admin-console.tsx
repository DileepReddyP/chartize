"use client";

import type { DatasetManifest } from "@chartize/contracts";
import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";

export function AdminConsole() {
  const [datasets, setDatasets] = useState<DatasetManifest[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [adminToken, setAdminToken] = useState("");

  const refresh = useCallback(async () => {
    const response = await fetch("/engine/api/catalog", { cache: "no-store" });
    if (!response.ok) throw new Error("The warehouse service is unavailable.");
    setDatasets(await response.json() as DatasetManifest[]);
  }, []);

  useEffect(() => {
    void refresh().catch((error: unknown) => setMessage(error instanceof Error ? error.message : String(error)));
  }, [refresh]);

  async function importDataset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(true);
    setMessage("Uploading, profiling, and publishing…");
    try {
      const response = await fetch("/engine/api/admin/imports", {
        method: "POST",
        headers: { "x-admin-token": adminToken },
        body: new FormData(form),
      });
      const body = await response.json() as DatasetManifest | { error: string };
      if (!response.ok || "error" in body) throw new Error("error" in body ? body.error : "Import failed.");
      setMessage(`Published ${body.title} with ${body.rowCount.toLocaleString()} rows.`);
      form.reset();
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  async function rollback(slug: string) {
    if (!window.confirm(`Roll ${slug} back to its previous published version?`)) return;
    setBusy(true);
    try {
      const response = await fetch(`/engine/api/admin/datasets/${encodeURIComponent(slug)}/rollback`, {
        method: "POST",
        headers: { "x-admin-token": adminToken },
      });
      const body = await response.json() as DatasetManifest | { error: string };
      if (!response.ok || "error" in body) throw new Error("error" in body ? body.error : "Rollback failed.");
      setMessage(`Rolled ${slug} back to version ${body.version}.`);
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="admin-shell">
      <header className="admin-heading">
        <div>
          <a className="eyebrow" href="/explore">Chartize / Explorer</a>
          <h1>Warehouse steward</h1>
          <p>Publish normalized, versioned datasets to the VPS. The original upload is retained for provenance.</p>
        </div>
        <span className="privacy-badge">VPS storage · DuckDB + Parquet</span>
      </header>

      <section className="admin-card">
        <h2>Add or update a dataset</h2>
        <form className="admin-form" onSubmit={importDataset}>
          <label className="wide">Admin token
            <input type="password" value={adminToken} onChange={(event) => setAdminToken(event.target.value)} autoComplete="current-password" required />
          </label>
          <label className="wide">Data file
            <input name="file" type="file" accept=".csv,.tsv,.json,.ndjson,.geojson,.parquet,.gpkg,.fgb,.kml,.shp,.zip" required />
          </label>
          <label>Title<input name="title" placeholder="County population estimates" required /></label>
          <label>Stable slug<input name="slug" pattern="[a-z0-9_]+" placeholder="county_population" required /></label>
          <label className="wide">Description<textarea name="description" rows={3} placeholder="What each row represents and important caveats." /></label>
          <label>Source URL<input name="source_url" type="url" placeholder="https://…" /></label>
          <label>License<input name="license" placeholder="CC0, public domain…" /></label>
          <label className="wide">Attribution<input name="attribution" placeholder="U.S. Census Bureau" /></label>
          <button className="primary-button" disabled={busy}>{busy ? "Publishing…" : "Profile and publish"}</button>
        </form>
        {message && <p className="admin-message" role="status">{message}</p>}
      </section>

      <section className="admin-card">
        <div className="section-heading"><div><p className="eyebrow">Published catalog</p><h2>{datasets.length} datasets</h2></div><button onClick={() => void refresh()} disabled={busy}>Refresh</button></div>
        <div className="dataset-table" role="table">
          {datasets.map((dataset) => (
            <article className="dataset-row" key={dataset.id} role="row">
              <div><strong>{dataset.title}</strong><p>{dataset.description || dataset.slug}</p></div>
              <span>{dataset.rowCount.toLocaleString()} rows</span>
              <span>{dataset.spatial ? "Spatial" : "Tabular"}</span>
              <span>v{dataset.version}</span>
              <button onClick={() => void rollback(dataset.slug)} disabled={busy}>Rollback</button>
            </article>
          ))}
          {!datasets.length && <p className="empty-state">No VPS datasets yet. The browser-local sample remains available in Explorer.</p>}
        </div>
      </section>
    </main>
  );
}

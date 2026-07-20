import { readFile } from "node:fs/promises";

const manifestUrl = new URL("../datasets/recommended.json", import.meta.url);
const manifest = JSON.parse(await readFile(manifestUrl, "utf8"));
const args = new Set(process.argv.slice(2));
const all = args.delete("--all");
const force = args.delete("--force");
const selectedIds = [...args];
const engine = (process.env.ENGINE_URL ?? "http://127.0.0.1:8787").replace(/\/$/, "");
const token = process.env.ADMIN_TOKEN ?? "change-me-in-production";
const candidates = manifest.datasets.filter((dataset) => {
  if (!dataset.automatic || !dataset.url) return false;
  if (selectedIds.length) return selectedIds.includes(dataset.id);
  return all || dataset.starter;
});

if (!candidates.length) {
  throw new Error("No automatic datasets matched. Use --all or pass dataset IDs from datasets/recommended.json.");
}

const health = await fetch(`${engine}/health`).catch(() => null);
if (!health?.ok) throw new Error(`Chartize data service is not reachable at ${engine}. Start pnpm dev first.`);
const catalogResponse = await fetch(`${engine}/api/catalog`);
if (!catalogResponse.ok) throw new Error(`Could not read the Chartize catalog (${catalogResponse.status}).`);
const publishedSlugs = new Set((await catalogResponse.json()).map((dataset) => dataset.slug));
let publishedCount = 0;

for (const dataset of candidates) {
  if (publishedSlugs.has(dataset.slug) && !force) {
    console.log(`Skipping ${dataset.title}; it is already published. Use --force to add a new version.`);
    continue;
  }
  process.stdout.write(`Downloading ${dataset.title}… `);
  const source = await fetch(dataset.url, { headers: { "user-agent": "chartize/0.1" } });
  if (!source.ok) throw new Error(`${dataset.id} download failed with ${source.status}.`);
  const contentType = source.headers.get("content-type") ?? "";
  if (contentType.includes("text/html")) throw new Error(`${dataset.id} returned HTML instead of data; its source URL has changed.`);
  let bytes = new Uint8Array(await source.arrayBuffer());
  if (dataset.encoding) {
    bytes = new TextEncoder().encode(new TextDecoder(dataset.encoding).decode(bytes));
  }
  process.stdout.write(`${(bytes.byteLength / 1024 / 1024).toFixed(1)} MB; publishing… `);

  const form = new FormData();
  form.set("file", new File([bytes], dataset.fileName, { type: contentType || "application/octet-stream" }));
  form.set("title", dataset.title);
  form.set("slug", dataset.slug);
  form.set("description", dataset.description);
  form.set("source_url", dataset.sourcePage);
  form.set("license", dataset.license);
  form.set("attribution", dataset.attribution);
  const published = await fetch(`${engine}/api/admin/imports`, {
    method: "POST",
    headers: { "x-admin-token": token },
    body: form,
  });
  const body = await published.json();
  if (!published.ok) throw new Error(`${dataset.id} import failed: ${body.error ?? published.status}`);
  console.log(`${body.rowCount.toLocaleString()} rows.`);
  publishedCount += 1;
}

console.log(`Published ${publishedCount} datasets. Refresh sources in the explorer.`);

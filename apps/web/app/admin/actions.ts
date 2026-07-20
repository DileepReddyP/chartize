"use server";

import { DatasetManifestSchema, type DatasetManifest } from "@chartize/contracts";
import { z } from "zod";

const AdminTokenSchema = z.string().min(1).max(1000);
const SlugSchema = z.string().regex(/^[a-z0-9_]+$/).max(100);

function engineUrl(path: string) {
  const base = (process.env.ENGINE_URL ?? "http://127.0.0.1:8787").replace(/\/$/, "");
  return `${base}${path}`;
}

async function errorMessage(response: Response, fallback: string) {
  try {
    const body: unknown = await response.json();
    if (typeof body === "object" && body && "error" in body) return String(body.error);
  } catch { /* The data service may return a proxy error. */ }
  return fallback;
}

export async function getAdminCatalog(): Promise<DatasetManifest[]> {
  const response = await fetch(engineUrl("/api/catalog"), { cache: "no-store", headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(await errorMessage(response, "The data service is unavailable."));
  return DatasetManifestSchema.array().parse(await response.json());
}

export async function publishAdminDataset(adminToken: string, formData: FormData) {
  const response = await fetch(engineUrl("/api/admin/imports"), {
    method: "POST",
    headers: { "x-admin-token": AdminTokenSchema.parse(adminToken) },
    body: formData,
    cache: "no-store",
  });
  if (!response.ok) throw new Error(await errorMessage(response, "Import failed."));
  return DatasetManifestSchema.parse(await response.json());
}

export async function rollbackAdminDataset(adminToken: string, slug: string) {
  const parsedSlug = SlugSchema.parse(slug);
  const response = await fetch(engineUrl(`/api/admin/datasets/${encodeURIComponent(parsedSlug)}/rollback`), {
    method: "POST",
    headers: { "x-admin-token": AdminTokenSchema.parse(adminToken) },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(await errorMessage(response, "Rollback failed."));
  return DatasetManifestSchema.parse(await response.json());
}

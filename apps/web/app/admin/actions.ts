"use server";

import { DatasetManifestSchema, type DatasetManifest } from "@chartize/contracts";
import { z } from "zod";
import { listDatasets, publishDataset, rollbackDataset } from "@/lib/server/data-service";
import { requireAdmin } from "@/lib/auth/admin";

const SlugSchema = z.string().regex(/^[a-z0-9_]+$/).max(100);

export async function getAdminCatalog(): Promise<DatasetManifest[]> {
  await requireAdmin();
  return DatasetManifestSchema.array().parse(await listDatasets());
}

export async function publishAdminDataset(formData: FormData) {
  await requireAdmin();
  return DatasetManifestSchema.parse(await publishDataset(formData));
}

export async function rollbackAdminDataset(slug: string) {
  await requireAdmin();
  const parsedSlug = SlugSchema.parse(slug);
  return DatasetManifestSchema.parse(await rollbackDataset(parsedSlug));
}

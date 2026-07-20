"use server";

import { DatasetManifestSchema, type DatasetManifest } from "@chartize/contracts";
import { z } from "zod";
import { assertAdminToken, listDatasets, publishDataset, rollbackDataset } from "@/lib/server/data-service";

const AdminTokenSchema = z.string().min(1).max(1000);
const SlugSchema = z.string().regex(/^[a-z0-9_]+$/).max(100);

export async function getAdminCatalog(): Promise<DatasetManifest[]> {
  return DatasetManifestSchema.array().parse(await listDatasets());
}

export async function publishAdminDataset(adminToken: string, formData: FormData) {
  assertAdminToken(AdminTokenSchema.parse(adminToken));
  return DatasetManifestSchema.parse(await publishDataset(formData));
}

export async function rollbackAdminDataset(adminToken: string, slug: string) {
  const parsedSlug = SlugSchema.parse(slug);
  assertAdminToken(AdminTokenSchema.parse(adminToken));
  return DatasetManifestSchema.parse(await rollbackDataset(parsedSlug));
}

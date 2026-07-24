#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";

const root = resolve(import.meta.dirname, "..");
const sourcePath = resolve(root, "wrangler.base.jsonc");
const outputPath = resolve(root, "wrangler.generated.jsonc");

const required = {
  CLOUDFLARE_D1_DATABASE_ID: process.env.CLOUDFLARE_D1_DATABASE_ID,
  CLOUDFLARE_R2_BUCKET_NAME: process.env.CLOUDFLARE_R2_BUCKET_NAME,
};

const missing = Object.entries(required)
  .filter(([, value]) => !value?.trim())
  .map(([key]) => key);

if (missing.length > 0) {
  console.error(`Missing required Cloudflare configuration: ${missing.join(", ")}`);
  process.exit(1);
}

const baseText = await readFile(sourcePath, "utf8");
const base = JSON.parse(baseText.replace(/,\s*([}\]])/g, "$1"));
const customDomain = process.env.CLOUDFLARE_WORKER_CUSTOM_DOMAIN?.trim();
const generated = {
  ...base,
  ...(customDomain
    ? {
        routes: [
          {
            pattern: customDomain,
            custom_domain: true,
          },
        ],
      }
    : {}),
  d1_databases: [
    {
      binding: "DB",
      database_name: process.env.CLOUDFLARE_D1_DATABASE_NAME?.trim() || "rawaj-marketplace",
      database_id: required.CLOUDFLARE_D1_DATABASE_ID.trim(),
      ...(process.env.CLOUDFLARE_D1_PREVIEW_DATABASE_ID?.trim()
        ? { preview_database_id: process.env.CLOUDFLARE_D1_PREVIEW_DATABASE_ID.trim() }
        : {}),
      migrations_dir: "../d1/migrations",
      migrations_table: "d1_migrations",
    },
  ],
  r2_buckets: [
    {
      binding: "MEDIA",
      bucket_name: required.CLOUDFLARE_R2_BUCKET_NAME.trim(),
      ...(process.env.CLOUDFLARE_R2_PREVIEW_BUCKET_NAME?.trim()
        ? { preview_bucket_name: process.env.CLOUDFLARE_R2_PREVIEW_BUCKET_NAME.trim() }
        : {}),
    },
  ],
};

await writeFile(outputPath, `${JSON.stringify(generated, null, 2)}\n`, "utf8");
console.log(`Generated ${outputPath}`);

#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";

const root = resolve(import.meta.dirname, "..");
const sourcePath = resolve(root, "wrangler.base.jsonc");
const outputPath = resolve(root, "wrangler.generated.jsonc");
const local = process.argv.includes("--local");

const baseText = await readFile(sourcePath, "utf8");
const base = JSON.parse(baseText.replace(/,\s*([}\]])/g, "$1"));

const d1DatabaseId = local
  ? "00000000-0000-0000-0000-000000000000"
  : process.env.CLOUDFLARE_D1_DATABASE_ID?.trim();
const r2BucketName = local ? "rawaj-media-local" : process.env.CLOUDFLARE_R2_BUCKET_NAME?.trim();

if (!d1DatabaseId || !r2BucketName) {
  console.error(
    "Missing required production Cloudflare configuration: CLOUDFLARE_D1_DATABASE_ID, CLOUDFLARE_R2_BUCKET_NAME",
  );
  process.exit(1);
}

const officialOrigins = String(base.vars?.API_ALLOWED_ORIGINS ?? "");
const localOrigins = [officialOrigins, "http://localhost:8080", "http://127.0.0.1:8080"]
  .filter(Boolean)
  .join(",");
const customDomain = local ? null : process.env.CLOUDFLARE_WORKER_CUSTOM_DOMAIN?.trim();

const generated = {
  ...base,
  vars: {
    ...base.vars,
    API_ALLOWED_ORIGINS: local ? localOrigins : officialOrigins,
  },
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
      database_name: process.env.CLOUDFLARE_D1_DATABASE_NAME?.trim() || "rawaj-staging",
      database_id: d1DatabaseId,
      ...(local
        ? {}
        : process.env.CLOUDFLARE_D1_PREVIEW_DATABASE_ID?.trim()
          ? { preview_database_id: process.env.CLOUDFLARE_D1_PREVIEW_DATABASE_ID.trim() }
          : {}),
      migrations_dir: "../d1/migrations",
      migrations_table: "d1_migrations",
    },
  ],
  r2_buckets: [
    {
      binding: "MEDIA",
      bucket_name: r2BucketName,
      ...(!local && process.env.CLOUDFLARE_R2_PREVIEW_BUCKET_NAME?.trim()
        ? { preview_bucket_name: process.env.CLOUDFLARE_R2_PREVIEW_BUCKET_NAME.trim() }
        : {}),
    },
  ],
};

await writeFile(outputPath, `${JSON.stringify(generated, null, 2)}\n`, "utf8");
console.log(`Generated ${outputPath} (${local ? "local" : "production"}).`);

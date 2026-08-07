#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";

const root = resolve(import.meta.dirname, "..");
const sourcePath = resolve(root, "wrangler.base.jsonc");
const outputPath = resolve(root, "wrangler.generated.jsonc");
const local = process.argv.includes("--local");

const EXPECTED_PRODUCTION_D1_NAME = "rawaj-staging";
const EXPECTED_PRODUCTION_D1_ID = "d0e6496c-9f63-48d3-beeb-d2e219500f6a";
const EXPECTED_PRODUCTION_R2_NAME = "rawaj-listing-images-production";
const EXPECTED_FIREBASE_PROJECT_ID = "project-af18fcaf-c46e-4ec5-93a";
const EXPECTED_TURNSTILE_HOSTNAMES = "rawa-j.com,www.rawa-j.com";
const LOCAL_D1_NAME = "rawaj-syria-local";
const LOCAL_R2_NAME = "rawaj-syria-media-local";

const baseText = await readFile(sourcePath, "utf8");
const base = JSON.parse(baseText.replace(/,\s*([}\]])/g, "$1"));

const d1DatabaseId = local
  ? "00000000-0000-0000-0000-000000000000"
  : process.env.CLOUDFLARE_D1_DATABASE_ID?.trim();
const d1DatabaseName = local ? LOCAL_D1_NAME : process.env.CLOUDFLARE_D1_DATABASE_NAME?.trim();
const r2BucketName = local ? LOCAL_R2_NAME : process.env.CLOUDFLARE_R2_BUCKET_NAME?.trim();
const firebaseProjectId = String(base.vars?.FIREBASE_PROJECT_ID ?? "").trim();
const turnstileAllowedHostnames = String(base.vars?.TURNSTILE_ALLOWED_HOSTNAMES ?? "").trim();
const turnstileEnforcement = local
  ? "off"
  : process.env.RAWAJ_TURNSTILE_ENFORCEMENT?.trim().toLowerCase() || "off";

if (!new Set(["off", "enforce"]).has(turnstileEnforcement)) {
  console.error("Invalid RAWAJ_TURNSTILE_ENFORCEMENT; expected 'off' or 'enforce'.");
  process.exit(1);
}

if (!local) {
  const missing = [
    ["CLOUDFLARE_D1_DATABASE_ID", d1DatabaseId],
    ["CLOUDFLARE_D1_DATABASE_NAME", d1DatabaseName],
    ["CLOUDFLARE_R2_BUCKET_NAME", r2BucketName],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (missing.length > 0) {
    console.error(`Missing required Syria production configuration: ${missing.join(", ")}`);
    process.exit(1);
  }

  if (d1DatabaseName !== EXPECTED_PRODUCTION_D1_NAME) {
    console.error("Refusing production render: D1 name is not the Syria production database.");
    process.exit(1);
  }

  if (d1DatabaseId !== EXPECTED_PRODUCTION_D1_ID) {
    console.error("Refusing production render: D1 ID is not the Syria production database.");
    process.exit(1);
  }

  if (r2BucketName !== EXPECTED_PRODUCTION_R2_NAME) {
    console.error("Refusing production render: R2 is not the Syria production bucket.");
    process.exit(1);
  }

  if (firebaseProjectId !== EXPECTED_FIREBASE_PROJECT_ID) {
    console.error("Refusing production render: Firebase project is not the Syria project.");
    process.exit(1);
  }

  if (turnstileAllowedHostnames !== EXPECTED_TURNSTILE_HOSTNAMES) {
    console.error("Refusing production render: Turnstile hostnames are not Syria-scoped.");
    process.exit(1);
  }
}

const officialOrigins = String(base.vars?.API_ALLOWED_ORIGINS ?? "");
const localOrigins = [officialOrigins, "http://localhost:8080", "http://127.0.0.1:8080"]
  .filter(Boolean)
  .join(",");
const customDomain = local ? "" : (process.env.CLOUDFLARE_WORKER_CUSTOM_DOMAIN?.trim() ?? "");
const releaseSha = local ? "local" : process.env.RAWAJ_WORKER_RELEASE_SHA?.trim();
const workerEnvironment = local
  ? "local"
  : process.env.RAWAJ_WORKER_ENVIRONMENT?.trim() || "production";

if (!local && customDomain) {
  console.error(
    "Refusing production render: the Syria Worker must remain on its verified workers.dev path.",
  );
  process.exit(1);
}

if (!local && (!releaseSha || !/^[0-9a-f]{40}$/.test(releaseSha))) {
  console.error("Missing or invalid RAWAJ_WORKER_RELEASE_SHA for production rendering.");
  process.exit(1);
}

const previewD1Id = local ? "" : process.env.CLOUDFLARE_D1_PREVIEW_DATABASE_ID?.trim();
const previewR2Name = local ? "" : process.env.CLOUDFLARE_R2_PREVIEW_BUCKET_NAME?.trim();

if (!local && previewD1Id && previewD1Id === EXPECTED_PRODUCTION_D1_ID) {
  console.error("Refusing production render: preview D1 cannot reuse the Syria production D1 ID.");
  process.exit(1);
}

if (!local && previewR2Name && !previewR2Name.startsWith("rawaj-syria-")) {
  console.error("Refusing production render: preview R2 must be Syria-scoped.");
  process.exit(1);
}

if (!local && previewR2Name === EXPECTED_PRODUCTION_R2_NAME) {
  console.error("Refusing production render: preview R2 cannot reuse Syria production R2.");
  process.exit(1);
}

const generated = {
  ...base,
  vars: {
    ...base.vars,
    API_ALLOWED_ORIGINS: local ? localOrigins : officialOrigins,
    RAWAJ_WORKER_RELEASE_SHA: releaseSha,
    RAWAJ_WORKER_ENVIRONMENT: workerEnvironment,
    FIREBASE_PROJECT_ID: firebaseProjectId,
    TURNSTILE_ENFORCEMENT: turnstileEnforcement,
    TURNSTILE_ALLOWED_HOSTNAMES: turnstileAllowedHostnames,
  },
  d1_databases: [
    {
      binding: "DB",
      database_name: d1DatabaseName,
      database_id: d1DatabaseId,
      ...(previewD1Id ? { preview_database_id: previewD1Id } : {}),
      migrations_dir: "../d1/migrations",
      migrations_table: "d1_migrations",
    },
  ],
  r2_buckets: [
    {
      binding: "MEDIA",
      bucket_name: r2BucketName,
      ...(previewR2Name ? { preview_bucket_name: previewR2Name } : {}),
    },
  ],
};

await writeFile(outputPath, `${JSON.stringify(generated, null, 2)}\n`, "utf8");
console.log(`Generated ${outputPath} (${local ? "local" : "production"}).`);

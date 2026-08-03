#!/usr/bin/env node
import { pathToFileURL } from "node:url";

const EXPECTED = {
  siteUrl: "https://rawa-j.com",
  apiBaseUrl: "https://rawaj-classifieds-hub.allidamech.workers.dev",
};
const PENDING_FIREBASE_PROJECT = "rawaj-syria-auth-pending";
const FOREIGN_MARKET_PREFIX = `rawaj-${["sa", "udi"].join("")}`;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA_PATTERN = /^[0-9a-f]{40}$/;
const LOCAL_D1_PLACEHOLDER = "00000000-0000-0000-0000-000000000000";

export function validateSyriaProviderEnvironment(environment) {
  const env = Object.fromEntries(
    Object.entries(environment).map(([key, value]) => [key, String(value ?? "").trim()]),
  );
  const errors = [];

  const requireExact = (name, expected) => {
    if (!env[name]) errors.push(`${name} is required`);
    else if (env[name] !== expected) errors.push(`${name} must use the Syria-owned value`);
  };

  requireExact("VITE_SITE_URL", EXPECTED.siteUrl);
  requireExact("VITE_PUBLIC_DATA_API_BASE_URL", EXPECTED.apiBaseUrl);

  const d1Id = env.CLOUDFLARE_D1_DATABASE_ID ?? "";
  if (d1Id === LOCAL_D1_PLACEHOLDER) {
    errors.push("CLOUDFLARE_D1_DATABASE_ID cannot use the local placeholder");
  } else if (!UUID_PATTERN.test(d1Id)) {
    errors.push("CLOUDFLARE_D1_DATABASE_ID must be a valid provider UUID");
  }

  for (const name of ["CLOUDFLARE_D1_DATABASE_NAME", "CLOUDFLARE_R2_BUCKET_NAME"]) {
    const value = env[name] ?? "";
    if (!value) errors.push(`${name} is required`);
    else if (value.toLowerCase().includes(FOREIGN_MARKET_PREFIX)) {
      errors.push(`${name} cannot reference another market resource`);
    }
  }

  if (!SHA_PATTERN.test(env.RAWAJ_WORKER_RELEASE_SHA ?? "")) {
    errors.push("RAWAJ_WORKER_RELEASE_SHA must be an exact 40-character commit SHA");
  }

  const webFirebaseProject = env.VITE_SYRIA_FIREBASE_PROJECT_ID ?? "";
  const workerFirebaseProject = env.SYRIA_FIREBASE_PROJECT_ID ?? "";
  if (!webFirebaseProject || !workerFirebaseProject) {
    errors.push("Syria Firebase project IDs are required for web and Worker");
  } else if (webFirebaseProject !== workerFirebaseProject) {
    errors.push("Web and Worker Firebase project IDs must match");
  }

  if (
    [webFirebaseProject, workerFirebaseProject].some(
      (projectId) =>
        projectId === PENDING_FIREBASE_PROJECT ||
        projectId.toLowerCase().startsWith(FOREIGN_MARKET_PREFIX),
    )
  ) {
    errors.push("A dedicated Syria Firebase project is required");
  }

  return errors;
}

function run() {
  const errors = validateSyriaProviderEnvironment(process.env);
  if (errors.length > 0) {
    console.error("Syria provider preflight failed:");
    for (const error of errors) console.error(`- ${error}`);
    process.exit(1);
  }
  console.log("Syria provider preflight passed without exposing configuration values.");
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) run();

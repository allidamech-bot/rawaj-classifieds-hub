#!/usr/bin/env node

import { appendFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import process from "node:process";

const API_BASE = "https://api.cloudflare.com/client/v4";
const options = parseArguments(process.argv.slice(2));
const accountId = requiredEnvironment("CLOUDFLARE_ACCOUNT_ID");
const apiToken = requiredEnvironment("CLOUDFLARE_API_TOKEN");
const outputPath = resolve(
  options.output ??
    `artifacts/cloudflare/resources-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
);

validateAccountId(accountId);
validateResourceName(options.databaseName, "D1 database", 1, 64);
validateResourceName(options.bucketName, "R2 bucket", 3, 64);

const headers = {
  Authorization: `Bearer ${apiToken}`,
  "Content-Type": "application/json",
};

const token = await cloudflareRequest("/user/tokens/verify", { method: "GET" });
if (token.status !== "active") {
  throw new Error(`Cloudflare API token is not active (status: ${token.status ?? "unknown"}).`);
}

const existingDatabases = await listD1Databases();
const matchingDatabases = existingDatabases.filter((database) => database.name === options.databaseName);
if (matchingDatabases.length > 1) {
  throw new Error(`Multiple D1 databases named ${options.databaseName} were returned.`);
}

let database = matchingDatabases[0] ?? null;
let databaseAction = database ? "reused" : "planned";
if (!database && options.apply) {
  database = await cloudflareRequest(`/accounts/${accountId}/d1/database`, {
    method: "POST",
    body: JSON.stringify({ name: options.databaseName }),
  });
  databaseAction = "created";
}

let bucket = await getR2Bucket(options.bucketName);
let bucketAction = bucket ? "reused" : "planned";
if (!bucket && options.apply) {
  bucket = await cloudflareRequest(`/accounts/${accountId}/r2/buckets`, {
    method: "POST",
    body: JSON.stringify({
      name: options.bucketName,
      locationHint: options.locationHint,
      storageClass: "Standard",
    }),
  });
  bucketAction = "created";
}

const manifest = {
  version: 1,
  generatedAt: new Date().toISOString(),
  mode: options.apply ? "apply" : "plan",
  accountId,
  destructiveOperations: false,
  resources: {
    d1: {
      action: databaseAction,
      name: options.databaseName,
      id: database?.uuid ?? database?.id ?? null,
      createdAt: database?.created_at ?? null,
      jurisdiction: database?.jurisdiction ?? null,
    },
    r2: {
      action: bucketAction,
      name: options.bucketName,
      createdAt: bucket?.creation_date ?? bucket?.creationDate ?? null,
      location: bucket?.location ?? options.locationHint,
      jurisdiction: bucket?.jurisdiction ?? "default",
      storageClass: bucket?.storage_class ?? bucket?.storageClass ?? "Standard",
    },
  },
};

if (options.apply && !manifest.resources.d1.id) {
  throw new Error("Cloudflare did not return a D1 database identifier.");
}

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
await publishGitHubOutputs(manifest);

console.log(JSON.stringify(manifest, null, 2));
console.error(`Cloudflare resource manifest written to ${outputPath}`);

async function listD1Databases() {
  const databases = [];
  let page = 1;
  while (true) {
    const response = await cloudflareEnvelope(
      `/accounts/${accountId}/d1/database?page=${page}&per_page=100`,
      { method: "GET" },
    );
    databases.push(...(Array.isArray(response.result) ? response.result : []));
    const totalPages = Number(response.result_info?.total_pages ?? 1);
    if (!Number.isFinite(totalPages) || page >= totalPages) break;
    page += 1;
  }
  return databases;
}

async function getR2Bucket(name) {
  const path = `/accounts/${accountId}/r2/buckets/${encodeURIComponent(name)}`;
  const response = await fetch(`${API_BASE}${path}`, { method: "GET", headers });
  if (response.status === 404) return null;
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.success) {
    throw cloudflareError(path, response.status, payload);
  }
  return payload.result;
}

async function cloudflareRequest(path, init) {
  const envelope = await cloudflareEnvelope(path, init);
  return envelope.result;
}

async function cloudflareEnvelope(path, init) {
  const response = await fetch(`${API_BASE}${path}`, { ...init, headers: { ...headers, ...init.headers } });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.success) {
    throw cloudflareError(path, response.status, payload);
  }
  return payload;
}

function cloudflareError(path, status, payload) {
  const details = Array.isArray(payload?.errors)
    ? payload.errors
        .map((error) => [error?.code, error?.message].filter(Boolean).join(": "))
        .filter(Boolean)
        .join("; ")
    : "";
  return new Error(`Cloudflare request ${path} failed with ${status}${details ? `: ${details}` : ""}`);
}

async function publishGitHubOutputs(manifest) {
  const output = process.env.GITHUB_OUTPUT?.trim();
  if (!output) return;
  const values = {
    d1_database_id: manifest.resources.d1.id ?? "",
    d1_database_name: manifest.resources.d1.name,
    r2_bucket_name: manifest.resources.r2.name,
    resource_manifest: outputPath,
  };
  await appendFile(
    output,
    Object.entries(values)
      .map(([key, value]) => `${key}=${String(value).replace(/\r?\n/g, "")}`)
      .join("\n") + "\n",
    "utf8",
  );
}

function parseArguments(args) {
  const parsed = {
    apply: false,
    databaseName: "rawaj-marketplace-staging",
    bucketName: "rawaj-media",
    locationHint: "weur",
    output: null,
  };

  for (const argument of args) {
    if (argument === "--apply") parsed.apply = true;
    else if (argument.startsWith("--database-name=")) {
      parsed.databaseName = argument.slice("--database-name=".length).trim();
    } else if (argument.startsWith("--bucket-name=")) {
      parsed.bucketName = argument.slice("--bucket-name=".length).trim();
    } else if (argument.startsWith("--location-hint=")) {
      parsed.locationHint = argument.slice("--location-hint=".length).trim();
    } else if (argument.startsWith("--output=")) {
      parsed.output = argument.slice("--output=".length).trim();
    } else {
      throw new Error(`Unsupported argument: ${argument}`);
    }
  }

  if (!new Set(["apac", "eeur", "enam", "weur", "wnam", "oc"]).has(parsed.locationHint)) {
    throw new Error("--location-hint must be one of apac, eeur, enam, weur, wnam, or oc.");
  }
  return parsed;
}

function validateAccountId(value) {
  if (!/^[a-f0-9]{32}$/i.test(value)) {
    throw new Error("CLOUDFLARE_ACCOUNT_ID must be a 32-character account identifier.");
  }
}

function validateResourceName(value, label, minimum, maximum) {
  if (value.length < minimum || value.length > maximum) {
    throw new Error(`${label} name must contain between ${minimum} and ${maximum} characters.`);
  }
  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(value) && value.length > 1) {
    throw new Error(`${label} name must use lowercase letters, numbers, and hyphens.`);
  }
}

function requiredEnvironment(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

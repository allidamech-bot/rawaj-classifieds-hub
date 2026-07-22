#!/usr/bin/env node

import { createHash, createHmac } from "node:crypto";
import { appendFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const SOURCE_BUCKET = "listing-images";
const R2_REGION = process.env.R2_REGION?.trim() || "auto";
const EMPTY_SHA256 = sha256Hex(Buffer.alloc(0));

const options = parseArguments(process.argv.slice(2));
const supabaseUrl = requiredEnvironment("SUPABASE_URL");
const supabaseServiceRoleKey = requiredEnvironment("SUPABASE_SERVICE_ROLE_KEY");
const manifestPath = resolve(
  options.manifest ??
    `artifacts/cloudflare/listing-images-r2-${new Date().toISOString().replace(/[:.]/g, "-")}.jsonl`,
);

const r2Config = options.apply
  ? {
      accountId: requiredEnvironment("R2_ACCOUNT_ID"),
      accessKeyId: requiredEnvironment("R2_ACCESS_KEY_ID"),
      secretAccessKey: requiredEnvironment("R2_SECRET_ACCESS_KEY"),
      bucket: requiredEnvironment("R2_BUCKET_NAME"),
      endpoint: requiredEnvironment("R2_ENDPOINT").replace(/\/$/, ""),
      region: R2_REGION,
    }
  : null;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

await mkdir(dirname(manifestPath), { recursive: true });
await writeFile(manifestPath, "", "utf8");
await writeManifest({
  recordType: "migration-header",
  generatedAt: new Date().toISOString(),
  mode: options.apply ? "apply" : "dry-run",
  sourceBucket: SOURCE_BUCKET,
  targetBucket: r2Config?.bucket ?? process.env.R2_BUCKET_NAME?.trim() ?? null,
  databaseMutation: false,
  sourceDeletion: false,
});

let query = supabase
  .from("listing_images")
  .select("id,listing_id,storage_path,created_at")
  .not("storage_path", "like", "r2:%")
  .order("created_at", { ascending: true });

if (options.limit !== null) query = query.limit(options.limit);

const { data, error } = await query;
if (error) throw new Error(`Unable to read listing_images: ${error.message}`);

const rows = (data ?? []).filter(
  (row) =>
    typeof row.id === "string" &&
    typeof row.listing_id === "string" &&
    typeof row.storage_path === "string" &&
    row.storage_path.length > 0,
);

const summary = {
  mode: options.apply ? "apply" : "dry-run",
  discovered: rows.length,
  planned: 0,
  uploaded: 0,
  alreadyPresent: 0,
  failed: 0,
  bytes: 0,
  manifestPath,
};

for (const row of rows) {
  const targetKey = row.storage_path;

  if (!options.apply) {
    summary.planned += 1;
    await writeManifest({
      recordType: "listing-image",
      status: "planned",
      imageId: row.id,
      listingId: row.listing_id,
      sourceBucket: SOURCE_BUCKET,
      sourcePath: row.storage_path,
      targetKey,
      futureStoragePath: `r2:${targetKey}`,
    });
    continue;
  }

  try {
    const { data: sourceBlob, error: downloadError } = await supabase.storage
      .from(SOURCE_BUCKET)
      .download(row.storage_path);

    if (downloadError || !sourceBlob) {
      throw new Error(downloadError?.message ?? "Source object could not be downloaded.");
    }

    const sourceBytes = Buffer.from(await sourceBlob.arrayBuffer());
    const sourceSha256 = sha256Hex(sourceBytes);
    const contentType = sourceBlob.type || "application/octet-stream";
    summary.bytes += sourceBytes.byteLength;

    const existing = await headR2Object(r2Config, targetKey);
    if (existing.exists && existing.sha256 === sourceSha256) {
      summary.alreadyPresent += 1;
      await writeManifest({
        recordType: "listing-image",
        status: "already-present",
        imageId: row.id,
        listingId: row.listing_id,
        sourceBucket: SOURCE_BUCKET,
        sourcePath: row.storage_path,
        targetKey,
        futureStoragePath: `r2:${targetKey}`,
        bytes: sourceBytes.byteLength,
        contentType,
        sha256: sourceSha256,
        verified: true,
      });
      continue;
    }

    if (existing.exists && !options.force) {
      throw new Error(
        "Target object already exists with a different checksum. Re-run with --force only after review.",
      );
    }

    await putR2Object(r2Config, targetKey, sourceBytes, contentType, sourceSha256);
    const verified = await headR2Object(r2Config, targetKey);
    if (!verified.exists || verified.sha256 !== sourceSha256) {
      throw new Error("R2 checksum verification failed after upload.");
    }

    summary.uploaded += 1;
    await writeManifest({
      recordType: "listing-image",
      status: "uploaded",
      imageId: row.id,
      listingId: row.listing_id,
      sourceBucket: SOURCE_BUCKET,
      sourcePath: row.storage_path,
      targetKey,
      futureStoragePath: `r2:${targetKey}`,
      bytes: sourceBytes.byteLength,
      contentType,
      sha256: sourceSha256,
      verified: true,
    });
  } catch (migrationError) {
    summary.failed += 1;
    await writeManifest({
      recordType: "listing-image",
      status: "failed",
      imageId: row.id,
      listingId: row.listing_id,
      sourceBucket: SOURCE_BUCKET,
      sourcePath: row.storage_path,
      targetKey,
      futureStoragePath: `r2:${targetKey}`,
      error: migrationError instanceof Error ? migrationError.message : String(migrationError),
    });
  }
}

await writeManifest({
  recordType: "migration-summary",
  generatedAt: new Date().toISOString(),
  ...summary,
});

console.log(JSON.stringify(summary, null, 2));
if (summary.failed > 0) process.exitCode = 1;

async function putR2Object(config, key, body, contentType, sha256) {
  const response = await signedR2Fetch(config, key, "PUT", body, {
    "cache-control": "public, max-age=31536000, immutable",
    "content-type": contentType,
    "x-amz-meta-sha256": sha256,
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`R2 PUT failed with ${response.status}${detail ? `: ${detail}` : ""}`);
  }
}

async function headR2Object(config, key) {
  const response = await signedR2Fetch(config, key, "HEAD", undefined, {});
  if (response.status === 404) return { exists: false, sha256: null };
  if (!response.ok) throw new Error(`R2 HEAD failed with ${response.status}`);
  return {
    exists: true,
    sha256: response.headers.get("x-amz-meta-sha256"),
  };
}

async function signedR2Fetch(config, key, method, body, extraHeaders) {
  const now = new Date();
  const amzDate = formatAmzDate(now);
  const dateStamp = amzDate.slice(0, 8);
  const url = new URL(objectUrl(config, key));
  const payloadHash = body ? sha256Hex(body) : EMPTY_SHA256;
  const canonicalHeadersMap = {
    host: url.host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
    ...extraHeaders,
  };
  const signedHeaderNames = Object.keys(canonicalHeadersMap).sort();
  const canonicalHeaders = signedHeaderNames
    .map((name) => `${name}:${String(canonicalHeadersMap[name]).trim()}\n`)
    .join("");
  const credentialScope = `${dateStamp}/${config.region}/s3/aws4_request`;
  const canonicalRequest = [
    method,
    url.pathname,
    "",
    canonicalHeaders,
    signedHeaderNames.join(";"),
    payloadHash,
  ].join("\n");
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n");
  const signingKey = deriveSigningKey(config.secretAccessKey, dateStamp, config.region);
  const signature = hmacHex(signingKey, stringToSign);
  const authorization =
    `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaderNames.join(";")}, Signature=${signature}`;

  const requestHeaders = new Headers(extraHeaders);
  requestHeaders.set("x-amz-content-sha256", payloadHash);
  requestHeaders.set("x-amz-date", amzDate);
  requestHeaders.set("authorization", authorization);

  return fetch(url, { method, headers: requestHeaders, body });
}

function objectUrl(config, key) {
  const encodedKey = key.split("/").map(encodeURIComponent).join("/");
  return `${config.endpoint}/${encodeURIComponent(config.bucket)}/${encodedKey}`;
}

function deriveSigningKey(secret, dateStamp, region) {
  const dateKey = hmac(Buffer.from(`AWS4${secret}`, "utf8"), dateStamp);
  const regionKey = hmac(dateKey, region);
  const serviceKey = hmac(regionKey, "s3");
  return hmac(serviceKey, "aws4_request");
}

function hmac(key, value) {
  return createHmac("sha256", key).update(value).digest();
}

function hmacHex(key, value) {
  return createHmac("sha256", key).update(value).digest("hex");
}

function sha256Hex(value) {
  return createHash("sha256").update(value).digest("hex");
}

function formatAmzDate(date) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

function requiredEnvironment(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function parseArguments(args) {
  const parsed = {
    apply: false,
    force: false,
    limit: null,
    manifest: null,
  };

  for (const argument of args) {
    if (argument === "--apply") parsed.apply = true;
    else if (argument === "--force") parsed.force = true;
    else if (argument.startsWith("--limit=")) {
      const value = Number.parseInt(argument.slice("--limit=".length), 10);
      if (!Number.isInteger(value) || value < 1) {
        throw new Error("--limit must be a positive integer.");
      }
      parsed.limit = value;
    } else if (argument.startsWith("--manifest=")) {
      parsed.manifest = argument.slice("--manifest=".length).trim();
      if (!parsed.manifest) throw new Error("--manifest requires a file path.");
    } else {
      throw new Error(`Unsupported argument: ${argument}`);
    }
  }

  if (parsed.force && !parsed.apply) throw new Error("--force requires --apply.");
  return parsed;
}

async function writeManifest(record) {
  await appendFile(manifestPath, `${JSON.stringify(record)}\n`, "utf8");
}
